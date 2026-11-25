# O2S frontend

Next.js app for the O2S backend (`MamunAG/O2S-backend`, .NET). It was written for the code-crafter NestJS API; the
screens still call code-crafter's paths, and `lib/o2s` translates them to O2S.

## Running

```bash
npm ci
NEXT_PUBLIC_API_URL=http://localhost:5299 npm run dev   # a local O2S backend
```

`NEXT_PUBLIC_API_URL` (in `.env`) is the O2S API: `http://o2s.runasp.net` in production. A site served over HTTPS
can only call an HTTPS API, so turn on SSL for the backend's domain before hosting this app on HTTPS.

## How the O2S bridge works (`lib/o2s`)

`components/o2s-api-bridge.tsx` (mounted in `app/layout.tsx`) wraps `window.fetch` once. For a request to the API:

- the rule for the code-crafter path (`lib/o2s/rules/*.ts`: account, configuration, merchandising, hr) names
  the O2S route; the selected organization becomes the route's `{companyId}`;
- request bodies and queries are mapped (`page` / `limit` -> `pageNumber` / `pageSize`, renamed fields, an
  empty `id` -> 0); an edit (PATCH) reads the stored record, merges the change and PUTs it;
- O2S's `{ IsError, ErrorMessage, Data }` becomes `{ success, message, data }`, its pages `{ items, meta }`,
  numeric ids strings and date-only values `yyyy-MM-dd`; a 401 refreshes the token once.

A new screen can call O2S directly (`/api/v1/{companyId}/...`, envelope `{ IsError, ErrorMessage, Data }`); a
path with no rule is passed through unchanged.

Not in O2S, so the screens say so: restoring deleted records (O2S deletes permanently), the master-data Excel
uploads, salary components (part of the salary structure there).

## Adding components

```bash
npx shadcn@latest add button
```
