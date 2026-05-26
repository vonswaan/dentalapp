# Von Dental Clinic Management System

Clinic operations with a **simple file database** (all records in one place) or **browser backup** when offline.

## Login accounts

| Role | Username | Password | Access |
|------|----------|----------|--------|
| **Super Admin** | `superadmin` | `superadmin123` | Everything + user management + daily income |
| **Admin** | `admin` | `dental2026` | Clinic settings, dentists, schedules, services, operations |
| **Staff** | `staff` | `staff2026` | Appointments, patients, receipts, med certs, inventory |

Open `admin.html` to sign in.

## Database (simple)

All records are saved in **`database/clinic.json`**:

- patients, appointments, receipts, inventory, users, settings, etc.

**Start with database (recommended):**

```bash
cd dentalcare/api
npm install
npm start
```

Then open:

- Public: http://localhost:3000/index.html  
- Admin: http://localhost:3000/admin.html  

Backup = copy `database/clinic.json`.

See `database/schema.sql` for what fields are stored.

### Without the server

If you only open HTML files or use GitHub Pages, data stays in **browser localStorage** (per device, not shared).

## Modules

- **Public site** — Online booking from available slots
- **Appointments** — Walk-in booking, complete visit + payment
- **Patient records** — Visits and medical notes
- **Receipts & med certificates** — Print documents
- **Inventory** — Stock and medicine billing
- **Daily income** (Super Admin) — Day totals from receipts
- **Clinic settings** — Dentists, schedules, services
- **User access** (Super Admin) — Staff accounts

## GitHub Pages note

Static hosting cannot write `clinic.json`. For a live site with a real shared database, host the `api` folder on a small Node host (Railway, Render, VPS) or keep using localStorage on Pages.
