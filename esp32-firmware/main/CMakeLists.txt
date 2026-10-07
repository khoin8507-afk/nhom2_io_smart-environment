set(IDF_TARGET esp32s3)
idf_component_register(SRCS "main.c" "dht22.c"
                    INCLUDE_DIRS "."
                    PRIV_REQUIRES json mqtt esp_wifi nvs_flash esp_netif esp_driver_gpio esp_timer protocol_examples_common)
