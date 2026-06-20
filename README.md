# TerraXpert Pricing API

NestJS API for Mexico Hass observations, USDA references, DPI and TerraXpert pricing.

## Run

```bash
npm install
cp .env.example .env
npm run start:dev
```

API base URL: `http://localhost:4173/api/v1`. Swagger is available at `/docs`.

## Architecture

- `src/domain`: pure pricing models and calculations, with no framework dependency.
- `src/application`: use cases and ports owned by the business rules.
- `src/infrastructure`: NestJS HTTP, MongoDB and USDA adapters.

MongoDB credentials remain in the ignored `.env`. Set `API_WRITE_KEY` in production;
when configured, write endpoints require the `x-api-key` header.

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/export-reference`
- `GET|POST /api/v1/market-observations`
- `POST /api/v1/market-pulses`
- `POST /api/v1/pricing/calculate`
- `GET /api/v1/pricing/current`
- `GET /api/v1/pricing/history`

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
