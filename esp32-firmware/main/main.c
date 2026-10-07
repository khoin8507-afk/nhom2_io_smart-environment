#include <inttypes.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "dht22.h"
#include "driver/gpio.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "mqtt_client.h"
#include "nvs_flash.h"
#include "protocol_examples_common.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "IOT_ESP32";

#define DEVICE_ID "esp32-002"
#define MQTT_BROKER_URL "mqtt://192.168.100.146:1883"

#define DHT_PIN GPIO_NUM_3
#define LED_PIN GPIO_NUM_2
#define BUZZER_PIN GPIO_NUM_7
#define RELAY_PIN GPIO_NUM_16
#define LIGHT_DO_PIN GPIO_NUM_10

#define RELAY_ACTIVE_LEVEL 0
#define BUZZER_ACTIVE_LEVEL 1
#define LIGHT_DARK_LEVEL 1
#define RELAY_TEMPERATURE_THRESHOLD_C 30.0f

static volatile bool led_state = false;
static volatile bool led_auto_mode = true;
static volatile bool buzzer_state = false;
static volatile bool relay_state = false;
static esp_mqtt_client_handle_t mqtt_client;

static void set_led(bool enabled)
{
    led_state = enabled;
    gpio_set_level(LED_PIN, enabled ? 1 : 0);
}

static void set_buzzer(bool enabled)
{
    buzzer_state = enabled;
    gpio_set_level(BUZZER_PIN, enabled ? BUZZER_ACTIVE_LEVEL : !BUZZER_ACTIVE_LEVEL);
}

static void set_relay(bool enabled)
{
    relay_state = enabled;
    gpio_set_level(RELAY_PIN, enabled ? RELAY_ACTIVE_LEVEL : !RELAY_ACTIVE_LEVEL);
}

static bool is_dark(void)
{
    return gpio_get_level(LIGHT_DO_PIN) == LIGHT_DARK_LEVEL;
}

static void publish_command_ack(esp_mqtt_client_handle_t client, const char *command_id,
                                const char *action, const char *status)
{
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return;
    }
    if (command_id != NULL) {
        cJSON_AddStringToObject(root, "commandId", command_id);
    }
    cJSON_AddStringToObject(root, "deviceId", DEVICE_ID);
    cJSON_AddStringToObject(root, "action", action != NULL ? action : "UNKNOWN");
    cJSON_AddStringToObject(root, "status", status);
    cJSON_AddBoolToObject(root, "led", led_state);
    cJSON_AddBoolToObject(root, "ledAuto", led_auto_mode);
    cJSON_AddBoolToObject(root, "buzzer", buzzer_state);
    cJSON_AddBoolToObject(root, "relay", relay_state);

    char *payload = cJSON_PrintUnformatted(root);
    if (payload != NULL) {
        char topic[96];
        snprintf(topic, sizeof(topic), "iot/%s/command/ack", DEVICE_ID);
        esp_mqtt_client_publish(client, topic, payload, 0, 1, 0);
        free(payload);
    }
    cJSON_Delete(root);
}

static void handle_command(esp_mqtt_client_handle_t client, const char *payload)
{
    cJSON *root = cJSON_Parse(payload);
    if (root == NULL) {
        ESP_LOGW(TAG, "Ignored invalid command JSON");
        return;
    }

    const cJSON *action_json = cJSON_GetObjectItemCaseSensitive(root, "action");
    const cJSON *id_json = cJSON_GetObjectItemCaseSensitive(root, "commandId");
    const char *action = cJSON_IsString(action_json) ? action_json->valuestring : NULL;
    const char *command_id = cJSON_IsString(id_json) ? id_json->valuestring : NULL;
    bool accepted = true;

    if (action == NULL) {
        accepted = false;
    } else if (strcmp(action, "LED_ON") == 0) {
        led_auto_mode = false;
        set_led(true);
    } else if (strcmp(action, "LED_OFF") == 0) {
        led_auto_mode = false;
        set_led(false);
    } else if (strcmp(action, "LED_AUTO") == 0) {
        led_auto_mode = true;
        set_led(is_dark());
    } else if (strcmp(action, "BUZZER_ON") == 0) {
        set_buzzer(true);
    } else if (strcmp(action, "BUZZER_OFF") == 0) {
        set_buzzer(false);
    } else {
        accepted = false;
    }

    publish_command_ack(client, command_id, action, accepted ? "ACKNOWLEDGED" : "REJECTED");
    ESP_LOGI(TAG, "Command %s: %s", action != NULL ? action : "(missing)",
             accepted ? "accepted" : "rejected");
    cJSON_Delete(root);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id,
                               void *event_data)
{
    (void)handler_args;
    (void)base;
    esp_mqtt_event_handle_t event = event_data;
    esp_mqtt_client_handle_t client = event->client;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED: {
        ESP_LOGI(TAG, "MQTT connected");
        char topic[96];
        char payload[128];
        snprintf(topic, sizeof(topic), "iot/%s/status", DEVICE_ID);
        snprintf(payload, sizeof(payload), "{\"deviceId\":\"%s\",\"status\":\"ONLINE\"}", DEVICE_ID);
        esp_mqtt_client_publish(client, topic, payload, 0, 1, 1);
        snprintf(topic, sizeof(topic), "iot/%s/command", DEVICE_ID);
        esp_mqtt_client_subscribe(client, topic, 1);
        break;
    }
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "MQTT disconnected");
        break;
    case MQTT_EVENT_DATA:
        if (event->data_len > 0 && event->data_len < 512) {
            char payload[512];
            snprintf(payload, sizeof(payload), "%.*s", event->data_len, event->data);
            handle_command(client, payload);
        }
        break;
    default:
        break;
    }
}

static void mqtt_app_start(void)
{
    static char lwt_topic[96];
    static char lwt_payload[128];
    snprintf(lwt_topic, sizeof(lwt_topic), "iot/%s/status", DEVICE_ID);
    snprintf(lwt_payload, sizeof(lwt_payload),
             "{\"deviceId\":\"%s\",\"status\":\"OFFLINE\"}", DEVICE_ID);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URL,
        .session.last_will = {
            .topic = lwt_topic,
            .msg = lwt_payload,
            .qos = 1,
            .retain = 1,
        },
    };
    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}

static void hardware_init(void)
{
    gpio_config_t outputs = {
        .pin_bit_mask = (1ULL << LED_PIN) | (1ULL << BUZZER_PIN) | (1ULL << RELAY_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&outputs));

    gpio_config_t light_input = {
        .pin_bit_mask = 1ULL << LIGHT_DO_PIN,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&light_input));

    set_led(false);
    set_buzzer(false);
    set_relay(false);
    dht22_init(DHT_PIN);
}

static void telemetry_task(void *pv_parameters)
{
    (void)pv_parameters;
    char topic[96];
    char payload[384];
    snprintf(topic, sizeof(topic), "iot/%s/telemetry", DEVICE_ID);

    while (1) {
        bool dark = is_dark();
        if (led_auto_mode) {
            set_led(dark);
        }

        float temperature = 0.0f;
        float humidity = 0.0f;
        int dht_result = dht22_read(&temperature, &humidity);
        if (dht_result == 0) {
            set_relay(temperature > RELAY_TEMPERATURE_THRESHOLD_C);
            float illuminance = dark ? 0.0f : 1000.0f;
            snprintf(payload, sizeof(payload),
                     "{\"deviceId\":\"%s\",\"temperature\":%.1f,\"humidity\":%.1f,"
                     "\"illuminance\":%.1f,\"led\":%s,\"ledAuto\":%s,\"buzzer\":%s,\"relay\":%s}",
                     DEVICE_ID, temperature, humidity, illuminance,
                     led_state ? "true" : "false", led_auto_mode ? "true" : "false",
                     buzzer_state ? "true" : "false", relay_state ? "true" : "false");
            esp_mqtt_client_publish(mqtt_client, topic, payload, 0, 0, 0);
            ESP_LOGI(TAG, "T=%.1fC H=%.1f%% dark=%d LED=%d buzzer=%d relay=%d",
                     temperature, humidity, dark, led_state, buzzer_state, relay_state);
        } else {
            ESP_LOGW(TAG, "DHT22 read failed (%d)", dht_result);
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "Starting %s with ESP-IDF %s", DEVICE_ID, esp_get_idf_version());
    esp_err_t nvs_result = nvs_flash_init();
    if (nvs_result == ESP_ERR_NVS_NO_FREE_PAGES || nvs_result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_result = nvs_flash_init();
    }
    ESP_ERROR_CHECK(nvs_result);
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    ESP_ERROR_CHECK(example_connect());

    hardware_init();
    mqtt_app_start();
    xTaskCreate(telemetry_task, "telemetry_task", 4096, NULL, 5, NULL);
}
