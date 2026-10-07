#ifndef DHT22_H
#define DHT22_H

#include <stdint.h>
#include "driver/gpio.h"

// Initialize DHT22 on the given GPIO pin
void dht22_init(gpio_num_t pin);

// Read temperature and humidity
// Returns 0 on success
int dht22_read(float *temperature, float *humidity);

#endif
