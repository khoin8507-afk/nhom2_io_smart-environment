# Database schema

## `devices`

- `device_id`: mã thiết bị duy nhất.
- `status`: `ONLINE` hoặc `OFFLINE`.
- `led_state`, `led_auto_mode`: trạng thái và chế độ đèn.
- `buzzer_state`: trạng thái còi.
- `relay_state`: trạng thái relay làm mát.
- `last_seen_at`, `created_at`, `updated_at`: thời gian hệ thống.

## `telemetry`

- `device_id`, `temperature`, `humidity`, `illuminance`.
- `led_state`, `led_auto_mode`, `buzzer_state`, `relay_state`.
- `recorded_at`, `received_at`.

Schema cũ vẫn giữ cột `soil_moisture` dạng nullable để migration tương thích với database đã tồn tại, nhưng firmware, backend entity và giao diện không còn sử dụng cột này.

## `commands`

Lưu action, JSON payload, người gửi và vòng đời `PENDING` → `SENT` → `ACKNOWLEDGED`/`REJECTED`, hoặc `FAILED`/`TIMEOUT`.

## `users` và `roles`

Ba role được seed sẵn: `ROLE_ADMIN`, `ROLE_OPERATOR`, `ROLE_VIEWER`.
