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

## Formatting

This workspace uses Prettier as the single formatter, integrated with ESLint to enforce formatting standards.

- `npm run format` formats the repository in place.
- `npm run format:check` verifies formatting without changing files.
- `npm run lint` runs ESLint with Prettier checks enabled.

Prettier and ESLint are configured to work together seamlessly—ESLint will report Prettier violations, and both tools follow the same formatting rules.
