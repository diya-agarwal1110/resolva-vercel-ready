RESOLVA — VERCEL DEPLOYMENT PACKAGE
====================================

This version keeps the existing React/Vite interface and moves the API to
Vercel serverless functions. PostgreSQL (Vercel Postgres or Neon) is used
because Vercel's serverless filesystem is temporary; the original SQLite
file cannot safely store production registrations/incidents on Vercel.

DEPLOY TO VERCEL
1. Extract this ZIP.
2. Push the INNER project folder (the folder containing package.json) to a
   GitHub repository.
3. In Vercel, choose Add New -> Project and import that repository.
4. Framework preset: Vite. Build command: npm run build.
   Output directory: dist. Install command: npm install.
5. Create a PostgreSQL database:
   - Vercel Storage -> Create Database -> Postgres (if available), or
   - create a Neon PostgreSQL project at https://neon.tech.
6. In Vercel Project -> Settings -> Environment Variables, add:
   POSTGRES_URL = the pooled PostgreSQL connection string
   RESOLVA_ADMIN_INVITE = a long, private administrator invite code
   Add them for Production (and Preview if you use preview deployments).
   If your provider gives only DATABASE_URL, the API also accepts that name.
7. Redeploy after adding environment variables.
8. Open https://YOUR-PROJECT.vercel.app/api/health.
   Expected response includes: {"ok":true,"database":"PostgreSQL",...}

DATABASE
- On first API request, tables are created automatically and sample incidents
  plus three demo accounts are seeded (only if their email addresses are absent).
- New registrations and incident changes persist in PostgreSQL across deploys.
- The old resolva.sqlite file is deliberately not used by the Vercel API.
- Do not commit database URLs, passwords, or invite codes to GitHub.

DEMO SIGN-IN
Student: student@resolva.demo / Student@123
Admin: admin@resolva.demo / Admin@123
Staff: staff@resolva.demo / Staff@123

IMPORTANT SECURITY BEFORE PUBLIC USE
- Demo accounts are included to preserve the supplied academic demo experience.
  Change/remove these accounts and their passwords before sharing publicly.
- Set RESOLVA_ADMIN_INVITE to a unique secret in Vercel. Admin registration
  is rejected if this environment variable is not configured.
- Use a strong database password, keep secrets only in Vercel environment
  variables, and rotate demo credentials before real student data is entered.
- This is an academic starter, not a fully audited production service.
  Add rate limiting, account recovery, audit logs, and stricter role-based
  authorization before institutional deployment.

LOCAL DEVELOPMENT
The original Express + SQLite local backend is retained for local testing:
  npm install
  npm run dev
Vite serves the UI and proxies /api to localhost:4000.
The Vercel deployment uses /api/[...path].js and PostgreSQL instead.
