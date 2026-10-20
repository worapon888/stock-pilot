# StockPilot — Enterprise Mobile Inventory Management System

StockPilot is a production-grade, end-to-end mobile inventory management application engineered for real-world warehouse, logistics, and retail operations.

Built with **React Native (Expo SDK 58)** on the mobile frontend and an idiomatic **Golang (Gin + pgx/v5)** modular backend backed by **PostgreSQL 16**, StockPilot enforces strict transaction safety, idempotent API handling, row-level locking (`SELECT ... FOR UPDATE`), and prevention of negative inventory at every layer. The user interface is fully localized in natural Thai and styled with a clean corporate inventory design system.

---

## 📱 Application Screenshots

| 0. Splash Screen (หน้าเริ่มต้น) | 1. Login (เข้าสู่ระบบ) | 2. ADMIN Dashboard (ภาพรวม) |
| :---: | :---: | :---: |
| ![Splash Screen](docs/screenshots/00_splash_screen.png) | ![Login](docs/screenshots/08_login_screen.png) | ![ADMIN Dashboard](docs/screenshots/09_admin_dashboard.png) |

| 3. STAFF Dashboard (จำกัดสิทธิ์) | 4. Stock In/Out (รับเข้า/เบิกออก) | 5. Movement History (ประวัติ) |
| :---: | :---: | :---: |
| ![STAFF Dashboard](docs/screenshots/13_staff_dashboard.png) | ![Stock Adjustment](docs/screenshots/18_staff_stock_in_screen.png) | ![Movements](docs/screenshots/21_staff_movement_history.png) |

| 6. Settings (ข้อมูลผู้ใช้ & สิทธิ์) | 7. Logout Confirmation | 8. Session Restoration |
| :---: | :---: | :---: |
| ![Settings Admin](docs/screenshots/10_settings_admin_profile.png) | ![Logout Dialog](docs/screenshots/11_logout_confirmation.png) | ![Session Restored](docs/screenshots/17_session_restore_on_restart.png) |

---

## 🌟 Key Features

1. **Enterprise Authentication & RBAC (Role-Based Access Control)**:
   - Native Splash startup with secure session restoration via `expo-secure-store`.
   - Signed JWT access tokens (15-min life) + cryptographically random 30-day refresh tokens.
   - Server-side PostgreSQL session persistence with SHA-256 token hashing and rotation.
   - Token reuse detection: if a revoked refresh token is replayed, the entire session family is invalidated.
   - Granular roles: **ADMIN** (full inventory & catalog management) vs **STAFF** (operational stock IN/OUT only; product creation/editing strictly forbidden on backend and hidden in UI).
   - Brute-force rate limiting (15 attempts/minute per IP) and generic failure messages to prevent account enumeration.
   - Modern Thai login UI styled in `#F7FAFC`, `#2457A7`, `#172334` with React Hook Form + Zod validation.

2. **Executive Inventory Dashboard**:
   - Real-time KPI summary cards: Total Products, Total Stock Units, Low Stock Alert Count, and Total Stock Valuation (THB).
   - Dynamic quick-action shortcuts adapting to role: ADMIN sees Intake (`↓ รับเข้าสินค้า`), Dispatch (`↑ เบิกสินค้า`), and Item Registration (`+ เพิ่มสินค้า`), while STAFF only sees Intake and Dispatch.
   - Prioritized low-stock replenishment alert feed with stock-to-minimum ratios (e.g. `4 / 12 ขั้นต่ำ: 12`).
   - Live stream of recent inventory movements.

3. **Catalog & Search Filter System**:
   - Real-time search across product titles and SKU identifiers.
   - Segmented filter chips: All (`ทั้งหมด`), In Stock (`พร้อมขาย`), Low Stock (`ใกล้หมด`), and Out of Stock (`หมดสต๊อก`).
   - Responsive card layouts with role-aware headers (add product button hidden for STAFF).

4. **Product CRUD Lifecycle**:
   - Modal forms powered by React Hook Form + Zod schema validation.
   - Backend-enforced role authorization (`RequireRole(RoleAdmin)` returns HTTP 403 Forbidden for non-admins).
   - Client-side `<ProtectedScreen>` guards preventing unauthorized direct/deep navigation.

5. **Transactional Stock Adjustments (IN / OUT)**:
   - **Stock IN (รับเข้า)**: Supplier batch intake and emergency restocks.
   - **Stock OUT (เบิกออก)**: Retail orders, dispatch, and internal consumption.
   - Live projection preview card calculating real-time balance before execution (`คงเหลือเดิม` $\rightarrow$ `คงเหลือหลังทำรายการ`).
   - Interactive Thai confirmation dialog preventing accidental double taps.
   - Backend ACID transaction safety with row locking (`SELECT ... FOR UPDATE`) and idempotency guarantees.

6. **Movement Audit Trail**:
   - Complete historical ledger of every stock transaction.
   - Grouped chronologically by date (`วันที่ (20 ต.ค. 2569)`).
   - Directional color badges, Thai 24h timestamps (`19:34 น.`), quantity deltas (`+58 หน่วย`, `-2 หน่วย`), and audit notes.

7. **Dual Mode: Live API vs Offline Demo**:
   - **Live API Mode**: Secure JWT-authenticated connection to Go REST API and PostgreSQL database with full RBAC enforcement.
   - **Offline Demo Mode**: Isolated zero-backend local sandbox using `AsyncStorage`. Demo mode cannot bypass or authenticate against the live API.
   - Settings screen displays user profile (`ชื่อผู้ใช้งาน`, `อีเมล`, `สิทธิ์การใช้งาน`), live API health check, and secure logout.

---

## 🏗 Architecture & Technology Stack

```mermaid
flowchart TD
    subgraph MobileApp ["Mobile Client (React Native + Expo SDK 58)"]
        UI["Thai Corporate UI Components"]
        Zustand["Zustand State Store"]
        Zod["Zod Validation & Hook Form"]
        Axios["Axios HTTP Client"]
        AsyncStorage["AsyncStorage (Offline Demo)"]
        UI --> Zustand
        UI --> Zod
        Zustand --> Axios
        Zustand -.-> AsyncStorage
    end

    subgraph BackendAPI ["Backend Service (Golang Gin Monolith)"]
        GinRouter["Gin Engine & v1 Router"]
        CorsMW["CORS & Logging Middleware"]
        Handlers["Domain Handlers (Products / Inventory / Dashboard)"]
        TxManager["ACID Transaction & Idempotency Manager"]
        GinRouter --> CorsMW --> Handlers --> TxManager
    end

    subgraph Database ["Data Tier (PostgreSQL 16)"]
        PgxPool["pgxpool Connection Pool"]
        TableProd[("products table (Row Locks)")]
        TableMov[("stock_movements table (Audit & Idempotency)")]
        TxManager --> PgxPool
        PgxPool --> TableProd
        PgxPool --> TableMov
    end

    Axios -- "HTTP REST (Port 8080)" --> GinRouter
```

### Mobile Application
- **Framework**: React Native 0.88 with Expo SDK 58
- **Language**: TypeScript (strict mode enabled)
- **Navigation**: React Navigation (Bottom Tabs + Native Stack)
- **State Management**: Zustand v5 (`useAuthStore`, `useInventoryStore`, `useSettingsStore`)
- **Secure Token Storage**: `expo-secure-store` (AES-encrypted hardware-backed keychain)
- **Form Handling & Validation**: React Hook Form + Zod v4
- **Local Persistence**: `@react-native-async-storage/async-storage` (Demo sandbox only)
- **UI Design System**: Corporate Thai palette (Deep Navy `#183B66`, Primary Blue `#2457A7`, Surface `#F6F8FA`, Semantic Emerald `#258568`, Crimson `#C65B58`, Amber `#C58A2F`)

### Backend API
- **Language**: Golang 1.25
- **Web Framework**: Gin Web Framework (`v1.10.0`)
- **Database Driver**: `jackc/pgx/v5` (`v5.6.0`) with `pgxpool` connection management
- **Authentication**: JWT (`golang-jwt/jwt/v5`), bcrypt (`golang.org/x/crypto/bcrypt`), SHA-256 session rotation
- **Architecture**: Modular monolith with domain decoupling:
  - `cmd/api/main.go` — Entrypoint, route composition, graceful shutdown
  - `internal/config` — Environment variables and defaults
  - `internal/database` — pgxpool management, embedded migration runner, development user seeder
  - `internal/auth` — Authentication service, repository, handlers, JWT token manager, rate limiter, and RBAC middleware
  - `internal/products` — Product catalog repository, service, handler (RBAC protected)
  - `internal/inventory` — Stock movement repository, ACID transactions, idempotency engine (RBAC protected)
  - `internal/dashboard` — Analytical aggregations and metrics (RBAC protected)
  - `internal/middleware` — CORS, slog structured logging, panic recovery
  - `internal/response` — Uniform JSON response envelopes
- **Database**: PostgreSQL 16 with ACID transactions, foreign keys, and indexes

---

## 🗄️ Database Schema & Entity Relationships

```mermaid
erDiagram
    users ||--o{ refresh_sessions : "has sessions"
    users {
        uuid id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        varchar role "ADMIN | STAFF"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_sessions {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        varchar client_ip
        text user_agent
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    products ||--o{ stock_movements : "audited by"
    products {
        uuid id PK
        varchar sku UK
        varchar name
        numeric price
        integer stock_quantity
        integer min_stock
        timestamptz created_at
        timestamptz updated_at
    }

    stock_movements {
        uuid id PK
        uuid product_id FK
        varchar type "IN | OUT"
        integer quantity
        text note
        varchar idempotency_key UK
        timestamptz created_at
    }
```

### Table Definitions & Constraints
1. **`users`**:
   - `id`: UUID Primary Key (`gen_random_uuid()`)
   - `full_name`: Full display name of the operator
   - `email`: Unique email address used for login authentication
   - `password_hash`: Bcrypt hashed password (`bcrypt.DefaultCost = 10`)
   - `role`: Role constraint (`CHECK (role IN ('ADMIN', 'STAFF'))`)
   - `is_active`: Boolean flag allowing immediate deactivation of accounts
   - `created_at` / `updated_at`: Audit timestamps
2. **`refresh_sessions`**:
   - `id`: UUID Primary Key
   - `user_id`: Foreign Key referencing `users(id) ON DELETE CASCADE`
   - `token_hash`: Unique SHA-256 digest of rotating refresh token (plaintext is never stored)
   - `client_ip` / `user_agent`: Security audit metadata
   - `expires_at`: Absolute session expiry timestamp (default 7-30 days)
   - `revoked_at`: Timestamp set upon explicit logout or token rotation/replay invalidation
3. **`products`**:
   - `id`: UUID Primary Key
   - `sku`: Unique uppercase inventory SKU (e.g. `SKU-LOGI-MX3`)
   - `name`: Product catalog name
   - `price`: Unit price in THB (`CHECK (price >= 0)`)
   - `stock_quantity`: Real-time on-hand stock (`CHECK (stock_quantity >= 0)`)
   - `min_stock`: Replenishment safety stock threshold (`CHECK (min_stock >= 0)`)
4. **`stock_movements`**:
   - `id`: UUID Primary Key
   - `product_id`: Foreign Key referencing `products(id) ON DELETE CASCADE`
   - `type`: Movement direction (`CHECK (type IN ('IN', 'OUT'))`)
   - `quantity`: Quantity adjusted (`CHECK (quantity > 0)`)
   - `note`: Audit justification note (e.g. "Supplier batch receiving", "Order dispatch")
   - `idempotency_key`: Unique client idempotency key preventing duplicate adjustments

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

### 1. Authentication Startup Flow

```
App Launch
    │
    ▼
Native Splash Screen (SplashScreen.tsx)
    │
    ▼
Restore Secure Session (expo-secure-store)
    │
    ▼
Check Authentication Status
    ├── Valid Session ──────────────────────► MainTabs (Dashboard)
    │
    └── No Session / Expired Session
             │
             ▼
          Login Screen (Thai UI)
             │
       Authenticate via Go API (POST /api/v1/auth/login)
             │
             ▼
          MainTabs (Dashboard)
```

- **Zero Flash of Login Screen**: The splash screen securely loads tokens and verifies session health before making navigation decisions.
- **Hardware-Backed Storage**: Access and refresh tokens are stored exclusively via `expo-secure-store` (Android KeyStore / iOS Keychain). Tokens are **never** stored in plaintext `AsyncStorage`.
- **Single-Flight Axios Interceptor**: When access tokens expire (HTTP 401), the interceptor locks subsequent requests using a mutex promise, requests a new token pair via `POST /api/v1/auth/refresh`, updates the secure store, and automatically replays the original failed request once.
- **Network Resiliency**: Transient network errors do **not** force an immediate logout; sessions are only cleared when a server explicitly rejects refresh credentials.

---

### 2. Role-Based Access Control (RBAC) Permission Matrix

StockPilot enforces RBAC at the **backend API layer** as well as dynamically adapting the mobile interface:

| Permission / Action | ADMIN (ผู้ดูแลระบบ) | STAFF (พนักงาน) | Enforcing Backend Middleware |
| :--- | :---: | :---: | :--- |
| **View Dashboard Metrics** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **View Products Catalog** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **View Product Details** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **Create New Product** | ✅ Allowed | ❌ **Forbidden (403)** | `RequireAuth()`, `RequireRole("ADMIN")` |
| **Edit Existing Product** | ✅ Allowed | ❌ **Forbidden (403)** | `RequireAuth()`, `RequireRole("ADMIN")` |
| **Stock IN (รับเข้า)** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **Stock OUT (เบิกออก)** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **View Movement History** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |
| **View User Profile & Role** | ✅ Allowed | ✅ Allowed | `RequireAuth()` |

#### Frontend Enforcement
- In `DashboardScreen`, `ProductsScreen`, and `ProductDetailScreen`, product addition and modification actions are completely hidden for users with the `STAFF` role.
- Screen routes such as `CreateEditProductScreen` are wrapped in `<ProtectedScreen allowedRoles={['ADMIN']}>` to prevent unauthorized manual or deep-link navigation.

---

### 3. Development Users & Seeding

For local development and testing, StockPilot provides automatic, idempotent seeding of development accounts on server boot (disabled in production):

| Role (บทบาท) | Thai Title | Email | Default Password |
| :--- | :--- | :--- | :--- |
| **ADMIN** | ผู้ดูแลระบบ | `admin@stockpilot.com` | `Admin@123456` |
| **STAFF** | พนักงาน | `staff@stockpilot.com` | `Staff@123456` |

#### Environment Configuration (`backend/.env`):
```env
# Server & Database
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/stockpilot?sslmode=disable
APP_ENV=development

# JWT & Authentication Security
JWT_SECRET=super-secret-stockpilot-jwt-signing-key-for-dev-min32bytes
JWT_ACCESS_DURATION_MINUTES=15
JWT_REFRESH_DURATION_DAYS=30

# Development Seed Accounts
DEV_ADMIN_EMAIL=admin@stockpilot.com
DEV_ADMIN_PASSWORD=Admin@123456
DEV_STAFF_EMAIL=staff@stockpilot.com
DEV_STAFF_PASSWORD=Staff@123456
```

---

## 🔒 Inventory Transaction Safety & Concurrency

Stock adjustments implement strict concurrency and idempotency semantics:

```
[Incoming Request] (POST /api/v1/products/:id/stock-in or stock-out)
        │
        ▼
1. Begin PostgreSQL Transaction (ReadCommitted)
        │
        ▼
2. Check Idempotency Key in `stock_movements`
   ├── Exists with MATCHING payload  ──► Return existing movement (Replayed HTTP 200)
   ├── Exists with DIFFERENT payload ──► Rollback & Return HTTP 409 Conflict
   └── Does Not Exist                ──► Continue
        │
        ▼
3. Acquire Product Row Lock:
   `SELECT ... FROM products WHERE id = $1 FOR UPDATE`
        │
        ▼
4. Validate Requested Quantity (must be > 0)
        │
        ▼
5. Prevent Negative Inventory:
   If OUT and `current_stock < requested_quantity` ──► Rollback & Return HTTP 422 Unprocessable Entity
        │
        ▼
6. Compute and Update Stock:
   `UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2`
        │
        ▼
7. Insert Audit Record into `stock_movements`:
   `INSERT INTO stock_movements (...) VALUES (...)`
        │
        ▼
8. Commit Transaction (Atomic release of row lock)
```

### Concurrency Stress Testing
Tested under concurrent load using 10 concurrent goroutines vying simultaneously for a limited inventory pool. Thanks to `SELECT ... FOR UPDATE`, operations are strictly serialized at the row level without deadlocks, preventing overselling or negative inventory.

---

## 📁 Repository Structure

```
stock-pilot/
├── mobile/                      # React Native Expo Application
│   ├── src/
│   │   ├── api/                 # Axios clients (products, inventory, dashboard)
│   │   ├── components/          # Clean corporate UI components (Header, StatCard, MovementCard, etc.)
│   │   ├── constants/           # Theme tokens, colors, radius, spacing, API config
│   │   ├── data/                # Initial seed data for offline demo
│   │   ├── navigation/          # Bottom Tabs and Native Stack navigators
│   │   ├── schemas/             # Zod validation schemas with Thai error messages
│   │   ├── screens/             # Dashboard, Products, StockAdjustment, Movements, Settings, Detail
│   │   ├── store/               # Zustand state stores (inventory & settings)
│   │   └── types/               # TypeScript interfaces
│   ├── assets/                  # App icons and splash assets
│   ├── app.json                 # Expo configuration
│   ├── eas.json                 # EAS build configuration
│   └── package.json
│
├── backend/                     # Golang REST API
│   ├── cmd/api/main.go          # Server entrypoint and graceful shutdown
│   ├── internal/
│   │   ├── config/              # Environment loading
│   │   ├── database/            # pgxpool and embedded migration runner
│   │   ├── dashboard/           # Metrics calculation handler
│   │   ├── inventory/           # Stock IN/OUT ACID transaction safety & idempotency
│   │   ├── middleware/          # CORS, logger, recovery
│   │   ├── products/            # Catalog CRUD
│   │   └── response/            # Standard JSON envelopes
│   ├── migrations/              # SQL schema migration files
│   ├── tests/                   # Integration and concurrency test suite
│   ├── Dockerfile
│   ├── go.mod
│   └── .env.example
│
├── docs/
│   └── screenshots/             # Application screenshots for portfolio presentation
│
├── docker-compose.yml           # Multi-container PostgreSQL and backend definition
├── .gitignore                   # Excludes envs, credentials, node_modules, build artifacts
└── README.md
```

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js**: v18+ (tested on Node v22.19.0, npm 11.7.0)
- **Go**: v1.22+ (tested on Go 1.25.6)
- **PostgreSQL**: Local service or Docker
- **Android SDK / Emulator** (tested on Android 13 API 33)

---

### Step 1: Start PostgreSQL

#### Option A: Docker Compose
```bash
docker compose up -d postgres
```

#### Option B: Native PostgreSQL
Ensure PostgreSQL is running on port `5432` with a database named `stockpilot`:
```bash
# Windows PowerShell
& "C:\Program Files\PostgreSQL\16\bin\postgres.exe" -D "$env:LOCALAPPDATA\stockpilot_pgdata" -p 5432
```

---

### Step 2: Run the Golang Backend

```bash
cd backend
copy .env.example .env
go run ./cmd/api
```

The server automatically applies migrations, seeds initial catalog data if empty, and listens on `http://localhost:8080`.

Verify the health check:
```bash
curl http://localhost:8080/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "database": "connected",
    "environment": "development",
    "service": "stockpilot-api",
    "status": "ok",
    "version": "1.0.0"
  }
}
```

---

### Step 3: Run the React Native Mobile App

In a separate terminal:
```bash
cd mobile
npm install
npx expo start --android
```

---

## 📱 Android Connectivity Guide

### 1. Android Emulator Setup
The Android Emulator cannot connect directly to `localhost` on the host machine. Instead:
- Use `http://10.0.2.2:8080/api/v1` as the API Base URL (default for emulator).
- Or run `adb reverse` to map ports directly:
  ```bash
  adb reverse tcp:8080 tcp:8080
  adb reverse tcp:8082 tcp:8082
  ```

### 2. Physical Android Device Setup
To run on a real physical Android device connected via Wi-Fi:
1. Ensure your computer and Android phone are on the **same Wi-Fi network**.
2. Find your computer's local LAN IP (e.g. `192.168.1.150` via `ipconfig`).
3. Ensure Windows Firewall permits incoming TCP connections on port `8080`.
4. Open the StockPilot app, navigate to **Settings (ตั้งค่าระบบ)**, and set the API Base URL to:
   ```
   http://192.168.1.150:8080/api/v1
   ```
5. Tap **"ทดสอบเชื่อมต่อ" (Test Connection)** to verify real-time communication with the Go backend.

---

## 📦 Building Standalone Android APK

StockPilot supports building standalone APKs via native Gradle or EAS Build.

### Local Gradle Build:
```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
```
The resulting APK is generated at:
```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

To install directly to a connected Android device or emulator:
```bash
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📡 REST API Reference

Base URL: `http://localhost:8080/api/v1`

### Authentication Endpoints (Public & Authenticated)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public (Rate Limited) | Authenticate user, returns short-lived JWT + rotating refresh token |
| `POST` | `/auth/refresh` | Public | Rotates refresh token, returns new JWT pair, detects token reuse |
| `POST` | `/auth/logout` | Authenticated | Revokes current server-side refresh session in PostgreSQL |
| `GET` | `/auth/me` | Authenticated | Returns authenticated user profile, email, and assigned role |

### Inventory & Management Endpoints (RBAC Enforced)
| Method | Endpoint | Required Role | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health status and database connectivity check |
| `GET` | `/dashboard/summary` | ADMIN, STAFF | Executive metrics, low-stock alerts, recent movements |
| `GET` | `/products` | ADMIN, STAFF | List products with pagination, search, and stock filters |
| `GET` | `/products/:id` | ADMIN, STAFF | Get single product by UUID |
| `POST` | `/products` | **ADMIN only** | Create a new product (validates unique SKU, price, min stock) |
| `PATCH` | `/products/:id` | **ADMIN only** | Update product attributes |
| `POST` | `/products/:id/stock-in` | ADMIN, STAFF | Receive stock (atomic transaction with idempotency & row locking) |
| `POST` | `/products/:id/stock-out` | ADMIN, STAFF | Dispatch stock (atomic transaction, prevents negative stock) |
| `GET` | `/stock-movements` | ADMIN, STAFF | Query global movement history (filtered by type or product) |
| `GET` | `/products/:id/movements` | ADMIN, STAFF | Query movement audit trail for a specific product |

---

## 🧪 Automated Test Execution

### Backend Tests (Integration, Authentication, RBAC, ACID, Concurrency)
```bash
cd backend
go test -v -count=1 ./tests/...
go vet ./...
gofmt -l .
```
Comprehensive coverage includes:
- **Authentication**: Valid login, invalid password rejection, nonexistent user rejection, inactive user rejection, generic errors to prevent account enumeration.
- **Token Security**: Missing JWT rejection (401), invalid signature rejection (401), expired JWT rejection (401), rate limiting (429).
- **Refresh Token Rotation**: Successful rotation issuing new pairs, database revocation on logout, detection of revoked token reuse revoking session families.
- **RBAC Authorization**: ADMIN access to all endpoints, STAFF access to stock operations & history, STAFF forbidden from creating products (403), STAFF forbidden from editing products (403), unauthenticated inventory requests rejected (401).
- **Transaction Safety**: Atomic stock IN/OUT, negative inventory prevention (422), idempotency key replays & conflict checks, and 10-goroutine concurrent stress testing.

### Mobile Tests (Unit, State Store, Validation, TypeScript)
```bash
cd mobile
npm test
npm run typecheck
```
Comprehensive coverage includes:
- **Auth State & Store**: Session restoration from `expo-secure-store`, login lifecycle, error handling, session clearing on logout.
- **Thai Validation Schemas**: Email formatting, required passwords, Thai error message rendering.
- **Catalog & Movements**: Search filters, stock category classification, adjustment projection calculations.
- **TypeScript**: Strict typechecking with 0 errors (`tsc --noEmit`).

---

## ⚠️ Known Limitations & Future Roadmap

1. **Multi-Warehouse Support**: Current architecture operates on a single central warehouse model. Future iterations will introduce a `warehouses` table with multi-location stock partitioning.
2. **Hardware Barcode Scanner**: The app currently provides text and SKU search. Integrating camera-based QR/EAN-13 scanning via `expo-camera` is planned for physical mobile devices.
3. **Biometric Authentication**: Fingerprint/FaceID unlock via `expo-local-authentication` to complement PIN/password session restoration.

---

## 📜 License
MIT License. Created as an enterprise-grade portfolio project showcasing Full-Stack Mobile and Backend Engineering excellence.
