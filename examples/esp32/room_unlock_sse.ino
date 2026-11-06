#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <cstring>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* PB_HOST = "pocketbase.example.com";
const uint16_t PB_PORT = 443;
const char* PB_ROOT_CA = R"PEM(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_YOUR_SERVER_CA_CERTIFICATE
-----END CERTIFICATE-----
)PEM";

const char* DEVICE_EMAIL = "esp32-room1@example.invalid";
const char* DEVICE_PASSWORD = "REPLACE_WITH_DEVICE_PASSWORD";
const char* ROOM_ID = "REPLACE_WITH_ROOM_RECORD_ID";

constexpr uint8_t RELAY_PIN = 26;
constexpr bool RELAY_ACTIVE_HIGH = true;
constexpr unsigned long UNLOCK_DURATION_MS = 10UL * 60UL * 1000UL;

unsigned long relayOffAt = 0;
bool relayIsActive = false;

String pocketBaseUrl() {
	return "https://" + String(PB_HOST) + ":" + String(PB_PORT);
}

void setRelay(bool active) {
	const uint8_t onLevel = RELAY_ACTIVE_HIGH ? HIGH : LOW;
	const uint8_t offLevel = RELAY_ACTIVE_HIGH ? LOW : HIGH;
	digitalWrite(RELAY_PIN, active ? onLevel : offLevel);
	relayIsActive = active;
}

void updateRelay() {
	if (relayIsActive && static_cast<long>(millis() - relayOffAt) >= 0) {
		setRelay(false);
	}
}

bool authenticateDevice(String& token) {
	WiFiClientSecure client;
	client.setCACert(PB_ROOT_CA);

	HTTPClient http;
	if (!http.begin(client, pocketBaseUrl() + "/api/collections/esp32_devices/auth-with-password")) {
		Serial.println("Could not initialize PocketBase authentication request.");
		return false;
	}

	http.addHeader("Content-Type", "application/json");
	JsonDocument request;
	request["identity"] = DEVICE_EMAIL;
	request["password"] = DEVICE_PASSWORD;
	String body;
	serializeJson(request, body);

	const int status = http.POST(body);
	const String response = http.getString();
	http.end();
	if (status < 200 || status >= 300) {
		Serial.printf("PocketBase authentication failed (HTTP %d).\n", status);
		return false;
	}

	JsonDocument result;
	const DeserializationError error = deserializeJson(result, response);
	if (error || result["token"].isNull()) {
		Serial.println("PocketBase authentication response did not contain a token.");
		return false;
	}

	token = result["token"].as<String>();
	return true;
}

bool subscribeToCommands(const String& token, const String& clientId) {
	WiFiClientSecure client;
	client.setCACert(PB_ROOT_CA);

	HTTPClient http;
	if (!http.begin(client, pocketBaseUrl() + "/api/realtime")) {
		Serial.println("Could not initialize PocketBase subscription request.");
		return false;
	}

	http.addHeader("Authorization", token);
	http.addHeader("Content-Type", "application/json");
	JsonDocument request;
	request["clientId"] = clientId;
	JsonArray subscriptions = request["subscriptions"].to<JsonArray>();
	subscriptions.add("unlock_commands/*");
	String body;
	serializeJson(request, body);

	const int status = http.POST(body);
	http.end();
	if (status < 200 || status >= 300) {
		Serial.printf("PocketBase SSE subscription failed (HTTP %d).\n", status);
		return false;
	}

	Serial.println("Subscribed to room unlock events.");
	return true;
}

void handleUnlockEvent(const String& data) {
	JsonDocument event;
	const DeserializationError error = deserializeJson(event, data);
	if (error) {
		Serial.println("Ignoring malformed PocketBase realtime event.");
		return;
	}

	const char* action = event["action"];
	const char* roomId = event["record"]["room"];
	if (!action || !roomId || strcmp(action, "create") != 0 || String(ROOM_ID) != String(roomId)) {
		return;
	}

	setRelay(true);
	relayOffAt = millis() + UNLOCK_DURATION_MS;
	Serial.println("Unlock started for 10 minutes.");
}

void listenForUnlockCommands(const String& token) {
	WiFiClientSecure streamClient;
	streamClient.setCACert(PB_ROOT_CA);

	HTTPClient http;
	if (!http.begin(streamClient, pocketBaseUrl() + "/api/realtime")) {
		Serial.println("Could not initialize PocketBase SSE connection.");
		return;
	}

	http.setTimeout(15000);
	http.addHeader("Authorization", token);
	http.addHeader("Accept", "text/event-stream");
	const int status = http.GET();
	if (status != HTTP_CODE_OK) {
		Serial.printf("PocketBase SSE connection failed (HTTP %d).\n", status);
		http.end();
		return;
	}

	WiFiClient* stream = http.getStreamPtr();
	stream->setTimeout(1000);
	String eventName;
	String eventData;
	Serial.println("Connected to PocketBase SSE.");

	while (WiFi.status() == WL_CONNECTED && stream->connected()) {
		updateRelay();
		if (!stream->available()) {
			delay(10);
			continue;
		}

		String line = stream->readStringUntil('\n');
		line.trim();
		if (line.isEmpty()) {
			if (eventName == "PB_CONNECT") {
				JsonDocument connectEvent;
				if (deserializeJson(connectEvent, eventData)) {
					Serial.println("Invalid PocketBase SSE connection event.");
					http.end();
					return;
				}
				const String clientId = connectEvent["clientId"].as<String>();
				if (clientId.isEmpty() || !subscribeToCommands(token, clientId)) {
					http.end();
					return;
				}
			} else if (eventName.startsWith("unlock_commands/")) {
				handleUnlockEvent(eventData);
			}
			eventName = "";
			eventData = "";
		} else if (line.startsWith("event:")) {
			eventName = line.substring(6);
			eventName.trim();
		} else if (line.startsWith("data:")) {
			if (!eventData.isEmpty()) eventData += '\n';
			eventData += line.substring(5);
			eventData.trim();
		}
	}

	http.end();
	Serial.println("PocketBase SSE disconnected.");
}

void setup() {
	Serial.begin(115200);
	pinMode(RELAY_PIN, OUTPUT);
	setRelay(false);

	WiFi.mode(WIFI_STA);
	WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
	while (WiFi.status() != WL_CONNECTED) {
		delay(500);
		Serial.print('.');
	}
	Serial.println("\nWi-Fi connected.");
}

void loop() {
	updateRelay();
	if (WiFi.status() != WL_CONNECTED) {
		WiFi.reconnect();
		delay(1000);
		return;
	}

	String token;
	if (authenticateDevice(token)) {
		listenForUnlockCommands(token);
	}
	delay(1500);
}
