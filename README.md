# BCAMS Desktop

**Biometric Class Attendance Management System — Desktop Client**

A high-performance Electron + React desktop application built for Nigerian higher education institutions to manage class attendance, campus gate clock events, student/lecturer registries, and biometric enrollment with offline resilience.

---

## 🚀 Key Features

- **Biometric Attendance Capture**: High-speed fingerprint verification workflow with real-time feedback, audible/visual indicators, and scanner hardware simulation.
- **Offline-First Resilience**: Local event buffering, clock drift detection, and automated background sync to the BCAMS backend.
- **Biometric Enrollment Studio**: Multi-finger registration interface with visual hand mapping, quality scoring, and duplicate template detection.
- **Role-Based Access Control (RBAC)**: Dedicated operational views for:
  - **System Admin**: Device pairing, audit trail, global settings, and user permissions.
  - **Academic Admin**: Course offerings, departments, policies, and attendance eligibility reports.
  - **Lecturer**: Course session activation, manual verification override, and live student attendance list.
  - **Gate Officer**: Campus entry/exit monitoring and staff/student clock-in logging.
- **Session Lifecycle Management**: Strict scheduling state machine (`DRAFT` → `AUTHORIZED` → `ACTIVE` → `COMPLETED` / `CANCELLED`).
- **Comprehensive Audit Trail**: Tamper-evident logging of administrative actions, device activations, and manual attendance overrides.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Shell** | Electron 33 |
| **Frontend Framework** | React 18 (TypeScript) |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS 3 + PostCSS |
| **UI Primitives** | Radix UI (`@radix-ui/react-*`) |
| **State Management** | Zustand 5 |
| **Routing** | React Router v6 (`HashRouter` for desktop file protocol compatibility) |
| **Icons** | Lucide React |
| **Testing** | Vitest + Testing Library |

---

## 📂 Project Architecture

```
bcams-desktop/
├── electron/                 # Electron main and preload processes
│   ├── main.js               # Application lifecycle & native window management
│   └── preload.js            # Secure contextBridge IPC bridge
├── src/
│   ├── api/                  # API contracts & mock adapter implementation
│   ├── components/
│   │   ├── common/           # Shared components (DataTable, SyncModal, Badges)
│   │   ├── layout/           # AppShell, Sidebar, Header
│   │   └── ui/               # Radix-based reusable primitives
│   ├── lib/                  # Utility helpers and styling utilities
│   ├── mocks/                # Comprehensive mock data for offline simulation
│   ├── pages/                # Route-level views across all operational modules
│   │   ├── academic/         # Departments and Courses
│   │   ├── attendance/       # Live Capture & Attendance log
│   │   ├── audit/            # Tamper-evident Audit trail
│   │   ├── auth/             # Multi-role Login interface
│   │   ├── dashboard/        # Operational Dashboard
│   │   ├── devices/          # Biometric scanner and kiosk management
│   │   ├── enrollment/       # Multi-finger Biometric Enrollment
│   │   ├── gate/             # Campus Gate clock events
│   │   ├── people/           # Students, Lecturers, and Staff registries
│   │   ├── policies/         # Institutional attendance policies
│   │   ├── reports/          # Attendance analytics & eligibility
│   │   └── sessions/         # Class session tracking
│   ├── services/             # Hardware scanner abstraction (USB/Bluetooth/Mock)
│   ├── stores/               # Zustand stores (AuthStore, SyncStore)
│   ├── styles/               # Global CSS, theme tokens, and animations
│   ├── types/                # Domain models & TypeScript interfaces
│   ├── App.tsx               # Root router and role guard setup
│   └── main.tsx              # Application entrypoint
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚦 Getting Started

### Prerequisites

- Node.js 20.x or 22.x
- npm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bcams-desktop

# Install dependencies
npm install
```

### Development

Run the web frontend standalone in Vite:
```bash
npm run dev
```

Run in full Electron desktop mode:
```bash
npm run electron:dev
```

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

### Production Build

```bash
# Compile renderer and package Electron app
npm run electron:build
```

---

## 👤 Test User Accounts

The mock environment supports one-click role switching with preconfigured accounts:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@university.edu.ng` | `admin123` | Full system access & hardware management |
| **Academic Admin** | `academic.admin@university.edu.ng` | `academic123` | Curricula, policies, and eligibility reports |
| **Lecturer** | `dr.okonkwo@university.edu.ng` | `lecturer123` | Assigned course sessions and attendance capture |
| **Gate Officer** | `gate.officer@university.edu.ng` | `gate123` | Clock-in/out gate terminal |

---

## 📄 License

Proprietary — All rights reserved by the BCAMS Project Team.
