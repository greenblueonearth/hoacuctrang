# sv

## PocketBase authentication

The client uses the PocketBase `users` auth collection for phone/password sign-up and sign-in. Phone numbers are stored in E.164 format; Vietnamese numbers beginning with `0` are normalized to `+84`.

The migration in `../pb_migrations` adds a unique `phone` field, makes email optional, and switches password authentication to phone. Stop and restart PocketBase from the repository root so it applies the migration before using phone auth. Existing accounts need a phone number added to their record before they can sign in with the new flow.

Copy `.env.example` to `.env` and set `VITE_POCKETBASE_URL` to the PocketBase URL reachable by the browser. The default is `http://127.0.0.1:8090`.

New accounts must be allowed by the `users` collection's create rule. Configure allowed origins in PocketBase when the client is hosted on a different origin.

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
