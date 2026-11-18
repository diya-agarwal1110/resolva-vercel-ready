RESOLVA — UPGRADED CAMPUS ISSUE RESOLUTION PLATFORM
====================================================

RUN IN VS CODE
1. Extract this ZIP.
2. Open the INNER folder named RESOLVA_Teacher_Final (the folder containing package.json) in VS Code.
3. Open Terminal and run:
      npm.cmd install
      npm.cmd run dev
4. Open the Local URL printed by Vite (normally http://localhost:5173).
Keep the terminal running while using the app.

ACCOUNT REGISTRATION
- On the login screen, choose Student, Admin or Maintenance Staff, then select Create New Account.
- Student and Staff accounts can be self-registered with name, email and password. Each receives a generated ID (STU#### or STF####).
- Admin registration requires the invite code: KIET-RESOLVA-ADMIN-2026. For a different code, set RESOLVA_ADMIN_INVITE before starting the server. Keep this code private.
- New accounts are stored in the users table in resolva.sqlite and remain available after restart. Duplicate email addresses are rejected. Passwords are stored as salted scrypt hashes, not plain text.

DEMO LOGIN ACCOUNTS
Role                  Email                       Password
Student               student@resolva.demo       Student@123
Admin                 admin@resolva.demo         Admin@123
Maintenance Staff     staff@resolva.demo        Staff@123
Choose the matching role card. These are local demo accounts; replace them and add proper user management before any real deployment.

FEATURES
- Existing student/admin/maintenance workflows and seeded incidents retained.
- SQLite persistent database stored in resolva.sqlite beside server.js.
- Login API verifies role + password using Node scrypt password hashes; write APIs require a server-issued bearer token.
- System-calculated impact / priority score (not entered by student).
- Similarity warning checks category + exact location before allowing a separate report.
- Toast notifications for actions and database results.
- Repair after-photo upload in the incident detail drawer; original report evidence remains.
- Analytics page includes browser Print / Save as PDF export.
- Hover hints and existing confirmation workflow retained.

DATABASE / FILE NOTES
- First run creates resolva.sqlite and seeds three sample incidents.
- Do not delete resolva.sqlite if you want to retain data.
- Evidence images are stored as data URLs inside incident records; use small images (under 1.8 MB for repair photos) to avoid oversized local database records.
- Notifications are currently in-app toast popups, not email/SMS/push notifications.
- PDF export uses the browser print dialog: choose “Save as PDF”.

SECURITY LIMITATIONS
This is an academic local-demo implementation. Demo credentials are intentionally shown above. Sessions are held in server memory and reset when the server restarts. Admin self-registration is protected by a local invite code; change it using RESOLVA_ADMIN_INVITE before sharing the app. Add HTTPS, rate limiting, secure session expiry and production secrets before public deployment. Do not enter real sensitive student data in this demo.
