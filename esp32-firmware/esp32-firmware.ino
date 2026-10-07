#include <ArduinoJson.h>
#include <DHT.h>
#include <PubSubClient.h>
#include <WiFi.h>

const char *ssid = "TEN_WIFI_CUA_BAN";
const char *password = "MAT_KHAU_WIFI";
const char *mqttServer = "192.168.100.146";
const int mqttPort = 1883;
const char *deviceId = "esp32-002";

constexpr int DHT_PIN = 3;
constexpr int LED_PIN = 2;
constexpr int BUZZER_PIN = 7;
constexpr int LIGHT_DO_PIN = 10;
constexpr int RELAY_PIN = 16;
constexpr int RELAY_ACTIVE_LEVEL = LOW;
constexpr int DARK_LEVEL = HIGH;

DHT dht(DHT_PIN, DHT22);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

String telemetryTopic = String("iot/") + deviceId + "/telemetry";
String commandTopic = String("iot/") + deviceId + "/command";
String ackTopic = String("iot/") + deviceId + "/command/ack";
String statusTopic = String("iot/") + deviceId + "/status";

bool ledState = false;
bool ledAuto = true;
bool buzzerState = false;
bool relayState = false;

void setLed(bool enabled) {
  ledState = enabled;
  digitalWrite(LED_PIN, enabled ? HIGH : LOW);
}

void setBuzzer(bool enabled) {
  buzzerState = enabled;
  digitalWrite(BUZZER_PIN, enabled ? HIGH : LOW);
}

void setRelay(bool enabled) {
  relayState = enabled;
  digitalWrite(RELAY_PIN, enabled ? RELAY_ACTIVE_LEVEL : !RELAY_ACTIVE_LEVEL);
}

void publishAck(const String &commandId, const String &action, const char *status) {
  StaticJsonDocument<384> doc;
  doc["commandId"] = commandId;
  doc["deviceId"] = deviceId;
  doc["action"] = action;
  doc["status"] = status;
  doc["led"] = ledState;
  doc["ledAuto"] = ledAuto;
  doc["buzzer"] = buzzerState;
  doc["relay"] = relayState;
  char buffer[384];
  serializeJson(doc, buffer, sizeof(buffer));
  mqtt.publish(ackTopic.c_str(), buffer);
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  StaticJsonDocument<384> doc;
  if (deserializeJson(doc, payload, length)) return;

  String action = doc["action"].as<String>();
  String commandId = doc["commandId"].as<String>();
  bool accepted = true;

  if (action == "LED_ON") {
    ledAuto = false;
    setLed(true);
  } else if (action == "LED_OFF") {
    ledAuto = false;
    setLed(false);
  } else if (action == "LED_AUTO") {
    ledAuto = true;
    setLed(digitalRead(LIGHT_DO_PIN) == DARK_LEVEL);
  } else if (action == "BUZZER_ON") {
    setBuzzer(true);
  } else if (action == "BUZZER_OFF") {
    setBuzzer(false);
  } else {
    accepted = false;
  }
  publishAck(commandId, action, accepted ? "ACKNOWLEDGED" : "REJECTED");
}

void connectWifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String will = String("{\"deviceId\":\"") + deviceId + "\",\"status\":\"OFFLINE\"}";
    if (mqtt.connect(deviceId, nullptr, nullptr, statusTopic.c_str(), 1, true, will.c_str())) {
      String online = String("{\"deviceId\":\"") + deviceId + "\",\"status\":\"ONLINE\"}";
      mqtt.publish(statusTopic.c_str(), online.c_str(), true);
      mqtt.subscribe(commandTopic.c_str(), 1);
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LIGHT_DO_PIN, INPUT);
  setLed(false);
  setBuzzer(false);
  setRelay(false);
  dht.begin();
  connectWifi();
  mqtt.setServer(mqttServer, mqttPort);
  mqtt.setCallback(onMqttMessage);
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  static unsigned long lastPublish = 0;
  if (millis() - lastPublish < 5000) return;
  lastPublish = millis();

  bool dark = digitalRead(LIGHT_DO_PIN) == DARK_LEVEL;
  if (ledAuto) setLed(dark);

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  if (isnan(humidity) || isnan(temperature)) return;
  setRelay(temperature > 30.0F);

  StaticJsonDocument<384> doc;
  doc["deviceId"] = deviceId;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["illuminance"] = dark ? 0 : 1000;
  doc["led"] = ledState;
  doc["ledAuto"] = ledAuto;
  doc["buzzer"] = buzzerState;
  doc["relay"] = relayState;
  char buffer[384];
  serializeJson(doc, buffer, sizeof(buffer));
  mqtt.publish(telemetryTopic.c_str(), buffer);
}
