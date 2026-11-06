# sv

## PocketBase authentication

The client uses the PocketBase `users` auth collection for phone/password sign-up and sign-in. Phone numbers are stored in E.164 format; Vietnamese numbers beginning with `0` are normalized to `+84`.

The migration in `../pb_migrations` adds a unique `phone` field, makes email optional, and switches password authentication to phone. Stop and restart PocketBase from the repository root so it applies the migration before using phone auth. Existing accounts need a phone number added to their record before they can sign in with the new flow.

Copy `.env.example` to `.env` and set `VITE_POCKETBASE_URL` to the PocketBase URL reachable by the browser. The default is `http://127.0.0.1:8090`.

New accounts must be allowed by the `users` collection's create rule. Configure allowed origins in PocketBase when the client is hosted on a different origin.

## Room unlock with ESP32

The migration `../pb_migrations/1793953400_create_room_unlock_collections.js` adds `rooms`, `esp32_devices`, and `unlock_commands`. Restart PocketBase to apply it. The web app uses PocketBase Realtime (SSE): an authenticated user creates an unlock command, and only the ESP32 device assigned to that active room can subscribe to its command events. The web interface reports that a command was sent; the sample does not provide a device-to-web unlock confirmation.

Configure rooms using the PocketBase superuser dashboard:

1. Create a `rooms` record with a name, optional code, the owning `users` record, and `active` enabled.
2. Create an `esp32_devices` auth record for the device. Set its email/password, `room`, and optional device name. Keep the device password private.
3. Sign in to the web app with the room owner account. It can list and unlock only active rooms assigned to that account.

The example firmware is in [`../examples/esp32/room_unlock_sse.ino`](../examples/esp32/room_unlock_sse.ino). It requires ArduinoJson 7, HTTPS with the server's CA certificate, and an ESP32 Arduino board. Set Wi-Fi and device credentials, the room record ID, and the trusted server CA before flashing. The example assumes a fail-safe lock that unlocks when its power is interrupted: connect its supply through the relay's COM and NC contacts, so the lock is powered in the normal state and ESP32 GPIO 26 activates the relay to interrupt power for 10 minutes. Verify the relay module's trigger polarity and the lock's behavior before connecting it to a door.

The device uses a separate PocketBase auth record per room. PocketBase rules scope command creation to the authenticated room owner and realtime command reads to the device's assigned room. Provision device accounts and room ownership through the trusted PocketBase superuser dashboard; do not expose superuser credentials in the client or firmware.

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@1.1.1 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" tailwindcss="plugins:typography,forms" enhanced-img sveltekit-adapter="adapter:auto" paraglide="languageTags:en, vi+demo:no" --install pnpm client
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
