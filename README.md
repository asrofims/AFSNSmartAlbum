# AFSNSmartAlbum-Server

> Centralized telemetry, device monitoring, and remote configuration backend for **AFSNSmartAlbum** desktop application.

---

## 🚀 Key Features

1. **Simple, Modern & Mobile-Friendly Dashboard:**
   - Responsive layout: transforms from a detailed data table on desktop to high-contrast touch cards on mobile smartphones.
   - Real-time stats: Total installations, Active today, Active this week, verified Google-linked installations, and blocked devices.
2. **Prisma ORM & MySQL Database:**
   - Safe migrations, type-safe queries, connection pooling, and automatic database seeding.
3. **Default Admin Account:**
   - Automatically seeded on first run (`admin` / `admin123`).
   - Profile settings panel to change username, display name, and password securely (bcrypt hashed).
4. **Desktop Connection & Telemetry Management:**
   - Dedicated **Application Connection Panel** with 1-click **Copy URL** and **Copy API Key**.
   - Remote toggle to enable/disable telemetry ingestion.
   - Remote minimum required app version policy.
   - Device blocking/unblocking with one click.
   - Optional Google desktop account sign-in: verified name, profile photo, and email. See [setup and deployment](docs/google-sign-in.md).
5. **Single-Command Operation:**
   - Run both backend and frontend concurrently in development with `npm run dev`.
   - Build and serve statically with Express in production with `npm start`.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, Prisma ORM
- **Database:** MySQL 8.0+
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Security:** JWT (Admin session), `bcryptjs`, `X-App-Key` header authentication

---

## ⚙️ Configuration (`.env`)

All sensitive database and secret configurations are kept in `.env`:

```env
# Database Connection (MySQL)
DATABASE_URL="mysql://afsnsmartalbumserver:gokil123@192.168.101.9:3306/afsnsmartalbumserver"

# Server Port
PORT=5002

# JWT Secret for Admin Sessions
JWT_SECRET="afsn_smart_album_secure_jwt_secret_key_2026_xyz"

# Default Admin Account (Auto-created during seed)
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_PASSWORD="admin123"

# Desktop App Telemetry Secret Key (Header: X-App-Key)
DEFAULT_APP_KEY="afsn_app_secret_telemetry_key_2026"
```

---

## 📦 Installation & Setup

### 1. Install Dependencies
Run in the root folder:
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Initialize Database & Seed Default Admin
Push the schema to MySQL and auto-create the default admin account:
```bash
npm run db:push
```

### 3. Run Application

#### Development Mode (Vite Hot-Reload + Nodemon):
```bash
npm run dev
```

#### Production Mode (Single Port 5002):
```bash
npm run build
npm start
```
Access the dashboard at `http://localhost:5002`.

---

## 📱 Desktop Integration Quick Reference

AFSNSmartAlbum desktop application pings the server using:

- **Method:** `POST`
- **URL:** `http://<server-ip>:5002/api/telemetry/ping`
- **Headers:**
  - `Content-Type: application/json`
  - `X-App-Key: <APP_API_KEY>`
- **Payload:**
```json
{
  "installationCode": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "installedAt": "2026-09-27T15:00:00Z",
  "appVersion": "1.0.0",
  "osInfo": "Windows 11 Build 22631"
}
```

---

## 📚 Agent Skills

Agent rules and standardized skills are documented in `.agents/skills/`:
- [`ui-design`](.agents/skills/ui-design/SKILL.md): Mobile-first design tokens, touch targets, and responsiveness guidelines.
- [`testing`](.agents/skills/testing/SKILL.md): API endpoint tests, password update verification, and mobile viewport checks.
- [`telemetry-server`](.agents/skills/telemetry-server/SKILL.md): Architecture specifications, Prisma schema, and security rules.
