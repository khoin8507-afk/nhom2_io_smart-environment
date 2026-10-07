# IoT Smart Environment

Hệ thống giám sát môi trường gồm ESP32-S3, EMQX MQTT, Spring Boot, PostgreSQL và React.

## Phần cứng

| Thiết bị | Chân | Hoạt động |
|---|---:|---|
| DHT22 | GPIO 3 | Đo nhiệt độ và độ ẩm không khí |
| Đèn LED | GPIO 2 | Tự bật khi tối; có chế độ điều khiển tay từ web |
| Cảm biến ánh sáng DO | GPIO 10 | Mức HIGH được xem là trời tối |
| Buzzer | GPIO 7 | Bật/tắt từ web qua MQTT |
| Relay | GPIO 16 | Active-low, tự bật khi nhiệt độ > 30°C |

Không còn sử dụng cảm biến độ ẩm đất.

## Chạy Docker

Mở Docker Desktop, sau đó chạy tại thư mục gốc:

```bash
docker compose up --build -d
docker compose ps
```

Các địa chỉ:

- Web: http://localhost
- Backend/Swagger: http://localhost:8080/swagger-ui/index.html
- EMQX Dashboard: http://localhost:18083 (`admin` / `public`)
- MQTT từ ESP32: IP LAN của máy chạy Docker, cổng `1883`

Tài khoản web:

- `admin` / `Admin@123`
- `operator` / `Operator@123`
- `viewer` / `Viewer@123` (chỉ xem)

Để thử không cần ESP32:

```bash
docker compose --profile simulator up --build -d
```

Simulator mặc định dùng đúng `deviceId=esp32-002` và cùng contract `iot/...` với firmware.

## Nạp firmware ESP-IDF

Sửa `MQTT_BROKER_URL` trong `esp32-firmware/main/main.c` thành IP LAN của máy chạy Docker. Cấu hình Wi-Fi trong ESP-IDF rồi build/flash:

```bash
cd esp32-firmware
idf.py menuconfig
idf.py build
idf.py -p COMx flash monitor
```

Firmware Arduino thay thế nằm tại `esp32-firmware/esp32-firmware.ino`; cần sửa Wi-Fi và IP MQTT trước khi nạp. Chỉ sử dụng một trong hai bản firmware.

## Luồng dữ liệu

ESP32 gửi telemetry lên `iot/esp32-002/telemetry`. Backend lưu PostgreSQL và cung cấp REST API cho React. Web gửi lệnh tới backend, backend publish `iot/esp32-002/command`, ESP32 thực thi rồi ACK tại `iot/esp32-002/command/ack`.

Chi tiết payload xem tại [MQTT contract](docs/mqtt-contract.md).

## Dừng hệ thống

```bash
docker compose down
```

Thêm `-v` chỉ khi muốn xóa toàn bộ dữ liệu PostgreSQL và EMQX.
