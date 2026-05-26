# Von Dental Clinic Management System

Full clinic operations in the browser with **localStorage**.

## Login accounts

| Role | Username | Password | Access |
|------|----------|----------|--------|
| **Super Admin** | `superadmin` | `superadmin123` | Everything + user management |
| **Admin** | `admin` | `dental2026` | Clinic settings, dentists, schedules, services, operations |
| **Staff** | `staff` | `staff2026` | Appointments, patients, receipts, med certs, inventory |

Open `admin.html` to sign in.

## Modules

- **Public site** — Online booking from available slots only
- **Appointments** — Staff can add walk-in appointments with manual patient entry
- **Patient records** — Full medical record & visit log
- **Receipts & med certificates** — Create and print
- **Inventory** — Stock in/out with audit log
- **Clinic settings** (Admin+) — Clinic details, dentists, weekly schedules, services
- **User access** (Super Admin) — Add/edit/disable users and roles

## Quick start

```bash
cd dentalcare
npx serve .
```

- Public: http://localhost:3000  
- Admin: http://localhost:3000/admin.html  

## Super admin tasks

1. **User access** — Create accounts for reception, dentists, managers
2. **Clinic settings** — Update name, address, phone, booking slot interval
3. **Dentists & schedules** — Edit profile, license, which days/hours they work
4. **Services** — Add or update treatments and prices (shown on public site)
