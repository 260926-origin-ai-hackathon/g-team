#include <M5Unified.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"

enum LikeState { LIKE_NONE, LIKE_SENDING, LIKE_OK, LIKE_ERROR };

static String currentImageId = "";
static uint32_t nextPollSec = INITIAL_POLL_SEC;
static uint32_t lastSentAt = 0;
static bool hasSent = false;
static uint32_t lastPollAt = 0;
static LikeState likeState = LIKE_NONE;
static uint32_t likeStateAt = 0;
static volatile bool pirFlag = false;

static const int IMG_H = 240;
static const uint32_t LIKE_MSG_MS = 3000;

void IRAM_ATTR onPir() { pirFlag = true; }

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) delay(200);
  Serial.printf("[wifi] %s\n", WiFi.status() == WL_CONNECTED ? "connected" : "failed");
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
  Serial.printf("[post] %s -> %d\n", path.c_str(), code);
  return code == 200;
}

static void drawLikeOverlay() {
  const char* msg = nullptr;
  if (likeState == LIKE_SENDING) msg = "<3 A  送信中";
  else if (likeState == LIKE_OK) msg = "<3 A  送信済";
  else if (likeState == LIKE_ERROR) msg = "送信できませんでした";
  if (!msg) return;
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
  if (ok) M5.Display.drawJpg(buf, len, 0, 0, 320, 240);
  free(buf);
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
  if (code != 200) { Serial.printf("[poll] %d\n", code); http.end(); return; }  // 間隔維持で再試行
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) return;
  nextPollSec = doc["next_poll_sec"] | nextPollSec;
  if (doc["changed"] | false) {
    String id = doc["image_id"].as<String>();
    String u = doc["url"].as<String>();
    if (fetchAndDraw(u)) currentImageId = id;  // 失敗時は前画像を維持し次回再試行
    else Serial.println("[poll] image fetch failed");
  }
}

static void handleLike() {
  likeState = LIKE_SENDING; likeStateAt = millis();
  drawLikeOverlay();
  JsonDocument d;
  d["image_id"] = currentImageId;
  String body; serializeJson(d, body);
  likeState = postJson("/likes", body) ? LIKE_OK : LIKE_ERROR;  // 結果確定後に表示
  likeStateAt = millis();
  drawLikeOverlay();
}

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  M5.Display.fillScreen(TFT_BLACK);
  pinMode(PIR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), onPir, RISING);
  connectWifi();
  poll();
}

void loop() {
  M5.update();

  if (WiFi.status() != WL_CONNECTED) connectWifi();

  if (pirFlag) {
    pirFlag = false;
    uint32_t now = millis();
    if (!hasSent || now - lastSentAt >= DETECT_SUPPRESS_MS) {
      lastSentAt = now; hasSent = true;
      // 送信失敗時もリトライしない
      postJson("/detections", "{}");
    }
  }

  if (M5.BtnA.wasPressed() && currentImageId.length()) handleLike();

  if (likeState == LIKE_OK && millis() - likeStateAt > LIKE_MSG_MS) {
    likeState = LIKE_NONE;
    // 画像を再描画できないため次回changedまで残さず、オーバーレイ領域のみ消去
    M5.Display.fillRect(0, IMG_H - 24, 320, 24, TFT_BLACK);
  }

  if (millis() - lastPollAt >= nextPollSec * 1000UL) poll();
  delay(10);
}
