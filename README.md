# MUTMLSA Backend (Phase 1)

Minimal Express + Postgres API that powers two things on the MUTMLSA
site: the **membership application form** and the **contact form**.
No admin dashboard, no user accounts — submissions are saved to the
database and (optionally) emailed to the committee inbox.

## What it does

- `POST /api/membership/apply` — saves a membership application, emails a notification
- `POST /api/contact` — saves a contact message, emails a notification
- `GET /api/membership` and `GET /api/contact` — view all submissions (password-protected, for you)

## Local setup

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL at minimum — get one free from Render or Railway's Postgres add-on
npm run dev
```

The server auto-creates its two tables on startup — no manual migrations.

## Deploying (Render or Railway, free tier)

1. Push this folder to its own GitHub repo (or a `backend/` folder in your existing repo).
2. Create a free Postgres database on Render/Railway — copy its connection string into `DATABASE_URL`.
3. Create a new Web Service pointing at this folder, with:
   - Build command: `npm install`
   - Start command: `npm start`
4. Set the environment variables from `.env.example` in the service's dashboard (`DATABASE_URL`, `ADMIN_PASSWORD` at minimum).
5. Once deployed, set `FRONTEND_URL` to your live site's URL so CORS allows it.

**Free-tier note:** free Postgres instances on these platforms can expire
or need periodic activity to stay alive — if applications suddenly stop
saving, check the database status in your host's dashboard first.

## Viewing submissions

Since there's no admin UI yet, view submissions with a request that
includes your admin password:

```bash
curl -H "x-admin-password: YOUR_ADMIN_PASSWORD" https://your-backend-url/api/membership
curl -H "x-admin-password: YOUR_ADMIN_PASSWORD" https://your-backend-url/api/contact
```

Or use a tool like Postman/Insomnia and add that header. You can also
just browse the two tables directly in your Postgres provider's data
viewer (Render and Railway both have one built in).

## Email notifications

Uses [Resend](https://resend.com) (free tier is generous for this
volume). If `RESEND_API_KEY` is left blank, the server still works —
submissions save to the database, you just won't get an email ping and
will need to check the tables periodically instead.

## Connecting the frontend

In your React app, point the join/contact forms at:

```
POST https://your-backend-url/api/membership/apply
POST https://your-backend-url/api/contact
```

with a JSON body of `{ fullName, email, yearOfStudy, phone, message }`
for membership, or `{ fullName, email, message }` for contact.

## Phase 2 (later, not built yet)

If you eventually want committee members to edit the roster/events
without touching code, or want to track membership fee status — this
same database can be extended with new tables and routes rather than
rebuilding anything here.
