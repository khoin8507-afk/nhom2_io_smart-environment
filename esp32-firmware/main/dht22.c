#include "dht22.h"

#include "esp_timer.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

static gpio_num_t dht_pin = GPIO_NUM_NC;
static portMUX_TYPE dht_mux = portMUX_INITIALIZER_UNLOCKED;

static int wait_while_level(int level, int timeout_us)
{
    int64_t started_at = esp_timer_get_time();
    while (gpio_get_level(dht_pin) == level) {
        if (esp_timer_get_time() - started_at > timeout_us) {
            return -1;
        }
    }
    return (int)(esp_timer_get_time() - started_at);
}

void dht22_init(gpio_num_t pin)
{
    dht_pin = pin;
    gpio_config_t config = {
        .pin_bit_mask = 1ULL << pin,
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&config);
    gpio_set_level(dht_pin, 1);
}

int dht22_read(float *temperature, float *humidity)
{
    if (dht_pin == GPIO_NUM_NC || temperature == NULL || humidity == NULL) {
        return -1;
    }
    uint8_t data[5] = {0};

    gpio_set_direction(dht_pin, GPIO_MODE_OUTPUT_OD);
    gpio_set_level(dht_pin, 0);
    vTaskDelay(pdMS_TO_TICKS(18));
    gpio_set_level(dht_pin, 1);
    esp_rom_delay_us(30);
    gpio_set_direction(dht_pin, GPIO_MODE_INPUT);

    portENTER_CRITICAL(&dht_mux);
    if (wait_while_level(1, 120) < 0 || wait_while_level(0, 120) < 0 ||
        wait_while_level(1, 120) < 0) {
        portEXIT_CRITICAL(&dht_mux);
        return -2;
    }

    for (int bit = 0; bit < 40; bit++) {
        if (wait_while_level(0, 80) < 0) {
            portEXIT_CRITICAL(&dht_mux);
            return -3;
        }
        int high_time = wait_while_level(1, 100);
        if (high_time < 0) {
            portEXIT_CRITICAL(&dht_mux);
            return -4;
        }
        data[bit / 8] <<= 1;
        if (high_time > 40) {
            data[bit / 8] |= 1;
        }
    }
    portEXIT_CRITICAL(&dht_mux);

    if ((uint8_t)(data[0] + data[1] + data[2] + data[3]) != data[4]) {
        return -5;
    }
    uint16_t raw_humidity = ((uint16_t)data[0] << 8) | data[1];
    uint16_t raw_temperature = ((uint16_t)(data[2] & 0x7F) << 8) | data[3];
    *humidity = raw_humidity / 10.0f;
    *temperature = raw_temperature / 10.0f;
    if (data[2] & 0x80) {
        *temperature = -*temperature;
    }
    return 0;
}
