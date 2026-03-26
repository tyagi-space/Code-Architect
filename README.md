# Code Architect (Vercel)

## Prereqs
- Node.js 18+
- Postgres database

## Local setup
```bash
npm ci
npm run db:push
npm run dev
```

## Vercel deploy (frontend + serverless API)
1. Push this repo to GitHub.
2. Create a new Vercel project from the repo.
3. Set environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `SESSION_COOKIE_SECURE=true` (recommended)
4. Deploy.

Vercel will use:
- Build command: `npm run build:client`
- Output directory: `dist/public`
- API routes: `/api/*` handled by `api/[...path].ts`

## Database migrations
- Push schema (no migration files):
```bash
npm run db:push
```
- Run migrations (if you have migration files):
```bash
npm run db:migrate
```
