import os
import time
import json
import random
import datetime
import paho.mqtt.client as mqtt

BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", 1883))
NUM_DEVICES = int(os.getenv("NUM_DEVICES", 1))
DEVICE_ID = os.getenv("DEVICE_ID", "esp32-002")

class Device:
    def __init__(self, device_id):
        self.device_id = device_id
        self.led_state = False
        self.led_auto = True
        self.buzzer_state = False
        self.relay_state = False
        self.client = mqtt.Client(client_id=f"simulator-{self.device_id}")
        
        # Last Will and Testament
        lwm_topic = f"iot/{self.device_id}/status"
        lwm_payload = json.dumps({
            "deviceId": self.device_id,
            "status": "OFFLINE",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        self.client.will_set(lwm_topic, lwm_payload, qos=1, retain=True)

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
    def connect(self):
        while True:
            try:
                print(f"[{self.device_id}] Connecting to {BROKER}:{PORT}...")
                self.client.connect(BROKER, PORT, 60)
                self.client.loop_start()
                break
            except Exception as e:
                print(f"[{self.device_id}] Connection failed: {e}. Retrying in 5 seconds...")
                time.sleep(5)

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[{self.device_id}] Connected successfully.")
            # Publish ONLINE status
            status_topic = f"iot/{self.device_id}/status"
            status_payload = json.dumps({
                "deviceId": self.device_id,
                "status": "ONLINE",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
            self.client.publish(status_topic, status_payload, qos=1, retain=True)
            
            # Subscribe to command
            command_topic = f"iot/{self.device_id}/command"
            self.client.subscribe(command_topic, qos=1)
            print(f"[{self.device_id}] Subscribed to {command_topic}")
        else:
            print(f"[{self.device_id}] Connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode('utf-8')
        print(f"[{self.device_id}] Received message on {topic}: {payload}")
        
        try:
            data = json.loads(payload)
            command_id = data.get("commandId")
            action = data.get("action")
            
            if action == "LED_ON":
                self.led_state = True
                self.led_auto = False
            elif action == "LED_OFF":
                self.led_state = False
                self.led_auto = False
            elif action == "LED_AUTO":
                self.led_auto = True
            elif action == "BUZZER_ON":
                self.buzzer_state = True
            elif action == "BUZZER_OFF":
                self.buzzer_state = False
            else:
                raise ValueError(f"Unsupported action: {action}")
                
            # Publish ACK
            ack_topic = f"iot/{self.device_id}/command/ack"
            ack_payload = json.dumps({
                "commandId": command_id,
                "deviceId": self.device_id,
                "action": action,
                "status": "ACKNOWLEDGED",
                "led": self.led_state,
                "ledAuto": self.led_auto,
                "buzzer": self.buzzer_state,
                "relay": self.relay_state,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
            self.client.publish(ack_topic, ack_payload, qos=1)
            print(f"[{self.device_id}] Sent ACK for command {command_id}")
            
        except Exception as e:
            print(f"[{self.device_id}] Error processing message: {e}")

    def publish_telemetry(self):
        temp = round(random.uniform(25.0, 35.0), 1)
        hum = round(random.uniform(50.0, 80.0), 1)
        ill = random.choice([0.0, 1000.0])
        if self.led_auto:
            self.led_state = ill == 0.0
        self.relay_state = temp > 30.0
        
        telemetry_topic = f"iot/{self.device_id}/telemetry"
        telemetry_payload = json.dumps({
            "deviceId": self.device_id,
            "temperature": temp,
            "humidity": hum,
            "illuminance": ill,
            "led": self.led_state,
            "ledAuto": self.led_auto,
            "buzzer": self.buzzer_state,
            "relay": self.relay_state,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        self.client.publish(telemetry_topic, telemetry_payload, qos=0)
        print(f"[{self.device_id}] Published telemetry: T={temp}C, H={hum}%, L={ill}lx")

if __name__ == "__main__":
    devices = []
    for i in range(NUM_DEVICES):
        device_id = DEVICE_ID if i == 0 else f"esp32-{i + 2:03d}"
        device = Device(device_id)
        device.connect()
        devices.append(device)
        
    try:
        while True:
            time.sleep(5)
            for device in devices:
                device.publish_telemetry()
    except KeyboardInterrupt:
        print("Shutting down...")
        for device in devices:
            device.client.loop_stop()
            device.client.disconnect()
