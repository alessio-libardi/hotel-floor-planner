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
