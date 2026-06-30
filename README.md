# hotel-floor-planner

## Local database

Start PostgreSQL with Docker Compose before running the API:

```bash
npm run db:start
```

The backend uses these defaults when connecting locally:

- `PGHOST=localhost`
- `PGPORT=5432`
- `PGUSER=postgres`
- `PGPASSWORD=postgres`
- `PGDATABASE=hotel_floor_planner`

Use `npm run db:stop` to shut the container down.

## Formatting

This workspace uses Prettier as the single formatter, integrated with ESLint to enforce formatting standards.

- `npm run format` formats the repository in place.
- `npm run format:check` verifies formatting without changing files.
- `npm run lint -- app` runs ESLint with Prettier checks enabled.

Prettier and ESLint are configured to work together seamlessly—ESLint will report Prettier violations, and both tools follow the same formatting rules.
