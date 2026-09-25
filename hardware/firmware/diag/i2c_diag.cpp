// 配線確認用: I2C デバイスのアドレス一覧と INT ピン(G36)の状態を表示する
#include <M5Unified.h>
#include <Wire.h>

static const int INT_PIN = 36;

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  pinMode(INT_PIN, INPUT);
  Wire.begin(32, 33);  // Port A: SDA=G32 / SCL=G33
  M5.Display.setFont(&fonts::efontJA_16);
  M5.Display.println("I2C diag (see serial)");
}

void loop() {
  // Port A の I2C
  Serial.println("--- I2C scan (external Port A) ---");
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf("found: 0x%02X\n", a);
      found++;
    }
  }
  if (!found) Serial.println("no I2C device found");

  int last = digitalRead(INT_PIN);
  Serial.printf("INT(G36)=%d  (10秒間、変化を表示)\n", last);
  uint32_t t = millis();
  while (millis() - t < 10000) {
    int v = digitalRead(INT_PIN);
    if (v != last) { Serial.printf("INT changed -> %d\n", v); last = v; }
    delay(5);
  }
}
