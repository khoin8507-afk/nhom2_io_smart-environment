# MQTT contract

Mọi thành phần dùng chung tiền tố topic `iot` và `deviceId` mặc định `esp32-002`.

## Telemetry

- Topic: `iot/{deviceId}/telemetry`
- QoS: 0
- Chiều: ESP32 → EMQX → Spring Boot

```json
{
  "deviceId": "esp32-002",
  "temperature": 31.2,
  "humidity": 67.2,
  "illuminance": 0,
  "led": true,
  "ledAuto": true,
  "buzzer": false,
  "relay": true
}
```

`illuminance` là giá trị quy ước từ ngõ digital của cảm biến: `0` khi tối và `1000` khi có ánh sáng. Firmware không cần gửi `timestamp`; backend sẽ ghi thời điểm nhận theo đồng hồ máy chủ.

## Command

- Topic: `iot/{deviceId}/command`
- QoS: 1
- Chiều: Spring Boot → EMQX → ESP32

```json
{
  "commandId": "uuid-string",
  "action": "LED_AUTO",
  "timestamp": "2026-10-07T06:30:00Z"
}
```

Các action hợp lệ:

- `LED_ON`: bật đèn và chuyển sang chế độ tay.
- `LED_OFF`: tắt đèn và chuyển sang chế độ tay.
- `LED_AUTO`: tự bật đèn khi cảm biến báo tối.
- `BUZZER_ON`: bật còi.
- `BUZZER_OFF`: tắt còi.

Relay không nhận lệnh từ web. Firmware tự bật relay active-low khi nhiệt độ lớn hơn `30°C`.

## Command acknowledgement

- Topic: `iot/{deviceId}/command/ack`
- QoS: 1
- Chiều: ESP32 → EMQX → Spring Boot

```json
{
  "commandId": "uuid-string",
  "deviceId": "esp32-002",
  "action": "BUZZER_ON",
  "status": "ACKNOWLEDGED",
  "led": true,
  "ledAuto": true,
  "buzzer": true,
  "relay": false
}
```

## Device status

- Topic: `iot/{deviceId}/status`
- QoS: 1
- Retained: `true`

Khi kết nối, ESP32 gửi `ONLINE`. MQTT Last Will gửi `OFFLINE` nếu thiết bị mất kết nối:

```json
{
  "deviceId": "esp32-002",
  "status": "ONLINE"
}
```
