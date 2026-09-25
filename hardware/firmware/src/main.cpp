#include <M5Unified.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_VL53L5CX.h>
#include "config.h"
#include "heart.h"

enum LikeState { LIKE_NONE, LIKE_SENDING, LIKE_OK, LIKE_ERROR };

static String currentImageId = "";
static uint32_t nextPollSec = INITIAL_POLL_SEC;
static uint32_t lastSentAt = 0;
static bool hasSent = false;
static uint32_t lastPollAt = 0;
static LikeState likeState = LIKE_NONE;
static uint32_t likeStateAt = 0;
static Adafruit_VL53L5CX tof;
static bool tofReady = false;

static const int IMG_H = 240;
static const uint32_t LIKE_MSG_MS = 3000;
static const uint32_t HEART_MS = 1500;
static const int HEART_X = 4, HEART_Y = IMG_H - HEART_H - 4;

static uint8_t* imgBuf = nullptr;  // 表示中のJPEG（ハート消去時の再描画用）
static size_t imgLen = 0;
static uint32_t heartShownAt = 0;
static bool heartShown = false;

static int tofMinMm = -1;  // 直近の有効な最短距離（-1: 有効な測定なし）

// 4x4(16ゾーン)のうち、どのゾーンを見るか。
// 中央2x2 = 5,6,9,10。視野は対角63度なので、全ゾーンだと横の壁にも反応する。
#if DETECT_CENTER_ONLY
static const uint8_t ZONES[] = {5, 6, 9, 10};
#else
static const uint8_t ZONES[] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};
#endif
static const int ZONE_COUNT = sizeof(ZONES) / sizeof(ZONES[0]);

// テストモード(next_poll_sec<=5)では抑制も5秒に短縮する
static uint32_t suppressMs() { return nextPollSec <= 5 ? 5000UL : DETECT_SUPPRESS_MS; }

static bool tofDetected() {
  VL53L5CX_ResultsData r;
  if (!tofReady || !tof.getRangingData(&r)) return false;
  tofMinMm = -1;
  for (int k = 0; k < ZONE_COUNT; k++) {
    uint8_t i = ZONES[k];
    uint8_t st = r.target_status[i];
    if ((st == 5 || st == 9) && r.distance_mm[i] > 0 && (tofMinMm < 0 || r.distance_mm[i] < tofMinMm)) tofMinMm = r.distance_mm[i];
  }
  return tofMinMm >= 0 && tofMinMm <= DETECT_DISTANCE_MM;
}

static void initTof() {
  Wire.begin(TOF_SDA_PIN, TOF_SCL_PIN);
  Wire.setClock(400000);
  Serial.println("[センサー] 初期化中（内蔵ファームの書き込みに数秒かかります）");
  if (!tof.begin(0x29, &Wire, 400000) || !tof.setResolution(16) || !tof.setRangingFrequency(5) || !tof.startRanging()) {
    Serial.println("[センサー] 初期化に失敗しました。配線を確認してください");
    return;
  }
  tofReady = true;
  Serial.println("[センサー] 準備完了");
}

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) delay(200);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[Wi-Fi] 接続しました ip=%s\n", WiFi.localIP().toString().c_str());
    return;
  }
  // status: 1=SSID未発見 4=接続失敗(パスワード違い等) 6=切断
  Serial.printf("[Wi-Fi] 接続に失敗しました status=%d (SSID='%s')\n", WiFi.status(), WIFI_SSID);
  WiFi.disconnect(false);  // 接続試行中はスキャンが失敗するため止める（true だと Wi-Fi 自体が切れる）
  WiFi.mode(WIFI_STA);
  delay(200);
  int n = WiFi.scanNetworks();
  Serial.printf("[Wi-Fi] 見つかったネットワーク: %d 件（2.4GHzのみ）\n", n);
  for (int i = 0; i < n; i++) Serial.printf("  '%s' rssi=%d\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
}

static String url(const String& path) { return String(SERVER_URL) + "/devices/" DEVICE_ID + path; }

static bool beginHttp(HTTPClient& http, WiFiClientSecure& sc, const String& u) {
  if (u.startsWith("https")) { sc.setInsecure(); return http.begin(sc, u); }
  return http.begin(u);
}

static bool postJson(const String& path, const String& body) {
  WiFiClientSecure sc;
  HTTPClient http;
  if (!beginHttp(http, sc, url(path))) return false;
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();
  Serial.printf("[送信] %s → %s (HTTP %d)\n", path.c_str(), code == 200 ? "成功" : "失敗", code);
  return code == 200;
}

static void redrawImage() {
  if (imgBuf) M5.Display.drawJpg(imgBuf, imgLen, 0, 0, 320, 240);
  else M5.Display.fillRect(0, IMG_H - 24, 320, 24, TFT_BLACK);
}

static void showHeart() {
  redrawImage();
  M5.Display.drawPng(HEART_PNG, sizeof(HEART_PNG), HEART_X, HEART_Y);
  heartShown = true; heartShownAt = millis();
}

static void drawLikeOverlay() {
  const char* msg = nullptr;
  if (likeState == LIKE_SENDING) msg = "<3 A  送信中";
  else if (likeState == LIKE_OK) msg = "<3 A  送信済";
  else if (likeState == LIKE_ERROR) msg = "送信できませんでした";
  if (!msg) return;
  redrawImage();
  M5.Display.fillRect(0, IMG_H - 24, 320, 24, TFT_BLACK);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  M5.Display.setFont(&fonts::efontJA_16);
  M5.Display.setCursor(8, IMG_H - 20);
  M5.Display.print(msg);
}

static bool fetchAndDraw(const String& imgUrl) {
  WiFiClientSecure sc;
  HTTPClient http;
  if (!beginHttp(http, sc, imgUrl)) return false;
  http.setTimeout(15000);
  int code = http.GET();
  if (code != 200) { http.end(); return false; }
  int len = http.getSize();
  if (len <= 0 || len > 150000) { http.end(); return false; }  // 表示用は20〜40KB想定
  uint8_t* buf = (uint8_t*)malloc(len);
  if (!buf) { http.end(); return false; }
  WiFiClient* s = http.getStreamPtr();
  int got = 0;
  uint32_t t = millis();
  while (got < len && millis() - t < 15000) {
    int n = s->readBytes(buf + got, len - got);
    if (n > 0) got += n; else delay(5);
  }
  http.end();
  bool ok = got == len;
  if (ok) {
    M5.Display.drawJpg(buf, len, 0, 0, 320, 240);
    free(imgBuf); imgBuf = buf; imgLen = len; heartShown = false;
  } else free(buf);
  return ok;
}

static void poll() {
  lastPollAt = millis();
  WiFiClientSecure sc;
  HTTPClient http;
  String p = "/display?current=" + currentImageId;
  if (!beginHttp(http, sc, url(p))) return;
  http.setTimeout(8000);
  int code = http.GET();
  Serial.printf("[ポーリング] %s → HTTP %d\n", p.c_str(), code);
  if (code != 200) { http.end(); return; }  // 間隔維持で再試行
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) return;
  nextPollSec = doc["next_poll_sec"] | nextPollSec;
  Serial.printf("[ポーリング] 画像の更新: %s / 次回まで %u 秒\n", (doc["changed"] | false) ? "あり" : "なし", (unsigned)nextPollSec);
  if (doc["changed"] | false) {
    String id = doc["image_id"].as<String>();
    String u = doc["url"].as<String>();
    if (fetchAndDraw(u)) { currentImageId = id; Serial.printf("[表示] 画像を更新しました (%s)\n", id.c_str()); }  // 失敗時は前画像を維持し次回再試行
    else Serial.println("[表示] 画像の取得に失敗しました。次回のポーリングで再試行します");
  }
}

static void handleLike() {
  Serial.println("[いいね] ボタンが押されました → 送信します");
  likeState = LIKE_SENDING; likeStateAt = millis();
  drawLikeOverlay();
  JsonDocument d;
  d["image_id"] = currentImageId;
  String body; serializeJson(d, body);
  likeState = postJson("/likes", body) ? LIKE_OK : LIKE_ERROR;  // 結果確定後に表示
  likeStateAt = millis();
  if (likeState == LIKE_OK) { likeState = LIKE_NONE; showHeart(); }
  else drawLikeOverlay();
}

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  M5.Display.fillScreen(TFT_BLACK);
  connectWifi();
  initTof();
  poll();
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) connectWifi();

  // センサーが3秒以上データを出さなければ測定を再開する
  static uint32_t lastTofDataAt = millis();
  if (tofReady && millis() - lastTofDataAt > 3000) {
    Serial.println("[センサー] データが止まったため、初期化からやり直します");
    tofReady = false;
    Wire.end();
    initTof();
    lastTofDataAt = millis();
  }

  if (tof.isDataReady()) {
    lastTofDataAt = millis();
    static bool suppressLogged = false;
    bool hit = tofDetected();
    static uint32_t lastDistLog = 0;
    if (millis() - lastDistLog >= 1000) {  // 1秒ごとに現在の距離を表示
      lastDistLog = millis();
      if (tofMinMm < 0) Serial.println("[センサー] 有効な測定なし");
      else Serial.printf("[センサー] 最短距離 %d mm（検知距離 %d mm）\n", tofMinMm, DETECT_DISTANCE_MM);
    }
    if (hit) {
      uint32_t now = millis();
      if (!hasSent || now - lastSentAt >= suppressMs()) {
        lastSentAt = now; hasSent = true;
        Serial.printf("[検知] %d mm で物体を検知 → サーバーへ送信します\n", tofMinMm);
        // 送信失敗時もリトライしない
        postJson("/detections", "{}");
      } else if (!suppressLogged) {  // 抑制中のログは1回の検知につき1回だけ
        suppressLogged = true;
        Serial.println("[検知] 検知しましたが、前回送信から抑制時間以内のため送信しません");
      }
    } else {
      suppressLogged = false;
    }
  }

  if (M5.BtnA.wasPressed() && currentImageId.length()) handleLike();

  if (heartShown && millis() - heartShownAt > HEART_MS) {
    heartShown = false;
    redrawImage();
  }

  if (millis() - lastPollAt >= nextPollSec * 1000UL) poll();
  delay(10);
}
