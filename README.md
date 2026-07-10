# hotel-floor-planner

## Architecture

This project now runs as an Angular app on Firebase Hosting with Firestore and Firebase Auth.

- Frontend: Angular (`apps/app`)
- Hosting: Firebase Hosting
- Data: Firestore
- Auth requirement: Firebase Auth

## Local development

Install dependencies and start the app:

```bash
npm install
npm run start
```

## Local Firebase emulator

The project uses `evolutecx/firebase-emulator` via `docker-compose.emulators.yml`.
In this devcontainer/codespace setup, the emulator stack is started automatically on startup.

Manual commands:

```bash
docker compose -f docker-compose.emulators.yml up -d
docker compose -f docker-compose.emulators.yml down
```

Important local URLs:

- Emulator UI: http://localhost:4000
- Firestore emulator: http://localhost:8080
- Auth emulator: http://localhost:9099

When the app runs on `localhost`/`127.0.0.1`, it connects to these emulators automatically.

## Firebase setup

Install Firebase CLI globally (or use `npx firebase-tools`):

```bash
npm install -g firebase-tools
firebase login
firebase use hotel-floor-planner
```

Deploy commands:

```bash
npm run firebase:deploy
npm run firebase:deploy:hosting
```

## Firestore auth

Firestore rules require authenticated users (`request.auth != null`).
This app uses Google sign-in, so enable the Google provider in Firebase Authentication.

## PWA icons and iOS splash screens

Use this generator to build app icons and iOS startup images:

- https://progressier.com/pwa-icons-and-ios-splash-screen-generator

Suggested workflow for this workspace:

1. Open the generator and upload a high-resolution source image.
2. Generate both:
   - PWA icons (including maskable)
   - iOS splash/startup images
3. Copy generated icon files into:
   - `apps/app/public/icons`
4. Keep `apps/app/public/manifest.webmanifest` in sync with generated icon names/sizes.
5. Add generated iOS splash `<link rel="apple-touch-startup-image" ... />` tags to:
   - `apps/app/src/index.html`
6. Verify locally:
   - Run the app
   - Open Chrome DevTools Application tab and confirm manifest icons are detected
   - Test Add to Home Screen and iOS startup screens on a device/simulator

Notes:

- Keep icon paths rooted at `/icons/...` so they resolve from `public` in Angular builds.
- If you replace existing icon names, update both `manifest.webmanifest` and any explicit favicon/apple-touch links in `index.html`.

## Formatting

This workspace uses Prettier as the single formatter, integrated with ESLint to enforce formatting standards.

- `npm run format` formats the repository in place.
- `npm run format:check` verifies formatting without changing files.
- `npm run lint` runs ESLint with Prettier checks enabled.

Prettier and ESLint are configured to work together seamlessly—ESLint will report Prettier violations, and both tools follow the same formatting rules.
