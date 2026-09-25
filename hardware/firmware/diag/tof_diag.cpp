// 電力不足かどうかの切り分け（Wi-Fi なし）。
// 測定周波数を 1Hz → 5Hz → 15Hz と上げ、消費電流と停止までの持続時間の関係を見る。
//   周波数が高いほど早く止まる → 電力不足
//   周波数に関係なく同じ所で止まる → 電力以外の原因
#include <M5Unified.h>
#include <Wire.h>
#include <Adafruit_VL53L5CX.h>
#include "vl53l5cx_api.h"
#include "config.h"

static Adafruit_VL53L5CX tof;
static const uint8_t FREQS[] = {1, 5, 15};
static const int PHASE_MAX = 3;
static const uint32_t PHASE_MS = 30000;

static int phase = 0;
static uint32_t phaseStart, frames, errors, framesBeforeFirstError;
static bool sawError;

static void startPhase(int p) {
  phase = p;
  frames = errors = framesBeforeFirstError = 0;
  sawError = false;
  uint8_t f = FREQS[p - 1];
  Serial.printf("\n===== 段階%d: %uHz で30秒 =====\n", p, f);
  Wire.end();
  Wire.begin(TOF_SDA_PIN, TOF_SCL_PIN);
  Wire.setClock(400000);
  if (!tof.begin(0x29, &Wire, 400000)) { Serial.println("[init] 初期化に失敗"); }
  else {
    tof.setResolution(16);                 // 4x4
    tof.setRangingFrequency(f);
    Serial.printf("[init] 測距開始=%s\n", tof.startRanging() ? "成功" : "失敗");
  }
  phaseStart = millis();
}

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  delay(500);
  Serial.println("\n===== 電力不足の切り分けテスト =====");
  startPhase(1);
}

void loop() {
  M5.update();

  static uint32_t lastCheck = 0;
  if (millis() - lastCheck >= 50) {
    lastCheck = millis();
    uint8_t ready = 0;
    uint8_t st = vl53l5cx_check_data_ready(tof.getConfig(), &ready);
    uint8_t* tb = tof.getConfig()->temp_buffer;
    if (st != VL53L5CX_STATUS_OK) {
      errors++;
      if (!sawError) {
        sawError = true;
        framesBeforeFirstError = frames;
        Serial.printf("[停止] %lu フレーム目で異常 (%lu ms 経過) raw=%02X %02X %02X %02X\n",
                      (unsigned long)frames, (unsigned long)(millis() - phaseStart),
                      tb[0], tb[1], tb[2], tb[3]);
      }
    } else if (ready) {
      VL53L5CX_ResultsData r;
      vl53l5cx_get_ranging_data(tof.getConfig(), &r);
      int mn = -1;
      for (int i = 0; i < 16; i++) {
        uint8_t s = r.target_status[i];
        if ((s == 5 || s == 9) && r.distance_mm[i] > 0 && (mn < 0 || r.distance_mm[i] < mn)) mn = r.distance_mm[i];
      }
      frames++;
      if (frames % 10 == 1) Serial.printf("[測距] %lu フレーム目 最短=%d mm\n", (unsigned long)frames, mn);
    }
  }

  if (millis() - phaseStart > PHASE_MS) {
    Serial.printf("--- 段階%d(%uHz) 結果: 成功 %lu フレーム / 異常 %lu 回 / 停止まで %lu フレーム ---\n",
                  phase, FREQS[phase - 1], (unsigned long)frames, (unsigned long)errors,
                  sawError ? (unsigned long)framesBeforeFirstError : (unsigned long)frames);
    if (phase < PHASE_MAX) { tof.stopRanging(); startPhase(phase + 1); }
    else {
      Serial.println("\n===== 全段階終了 =====");
      Serial.println("周波数が高いほど早く止まるなら電力不足。関係なければ別原因。");
      while (true) delay(1000);
    }
  }
  delay(2);
}
