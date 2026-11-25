---
# React + TanStack Router Starter

Opinionated React starter using **Vite**, **TanStack Router (File Routes)**, **TanStack Query**, **shadcn/ui**, **Tailwind CSS v4**, **Zustand**, and **Bun**.

This project is designed for **large, scalable admin dashboards** with strict structure, routing discipline, and reusable screen patterns.
---

## Prerequisites

### Bun (required)

This project uses **Bun** as both the package manager and runtime.

#### Install Bun

**macOS / Linux**

```bash
curl -fsSL https://bun.sh/install | bash
```

Restart your terminal and verify:

```bash
bun --version
```

**Windows**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Restart PowerShell and verify:

```powershell
bun --version
```

---

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Create `.env.local`:

```env
VITE_API_BASE_URL=https://<your-supabase>.supabase.co
VITE_API_KEY=<your-supabase-anon-key>
VITE_OSS_TRANSLATE_SESSION_PERCENT=10
MODE=development
```

### 3. Run development server

```bash
bun dev
```

### 4. Build the project

```bash
bun run build
```

---

## Project Structure

```text
src/
├─ main.tsx                 # App bootstrap (router + providers)
├─ routes.ts                # Virtual route config
├─ routeTree.gen.ts         # Generated – DO NOT EDIT
├─ pages/                   # File-based routes
│  ├─ auth/                 # Login / forgot password
│  ├─ middlewares/          # Route guards
│  ├─ app/(_authenticated)/ # Protected area
│  ├─ error/                # Error pages
│  └─ public/               # Public pages
├─ components/
│  ├─ ui/                   # shadcn primitives
│  └─ screens-component/    # Screen-level UI (web/mobile)
├─ hooks/
│  ├─ apis/                 # TanStack Query APIs
│  └─ store/                # Zustand stores
├─ layouts/                 # App shell layouts
├─ config/                  # env + request wrapper
├─ lib/utils/               # Utilities
└─ styles/                  # Tailwind + theme tokens
```

---

## Routing System

- Uses **TanStack Router + virtual routes**
- Routes defined in `src/routes.ts`
- Generated tree in `routeTree.gen.ts` (do not edit)

### Middlewares

| Middleware            | Purpose                                 |
| --------------------- | --------------------------------------- |
| restrict-login-signup | Prevent logged-in users from auth pages |
| authenticate          | Protects authenticated routes           |
| require-admin         | Admin-only routes                       |

### Protected Layout

```text
src/pages/app/(_authenticated)/layout.tsx
```

Wraps sidebar + header + `<Outlet />`.

---

## API Layer

- All API calls go through `request()` from:

  ```ts
  src / config / request.ts;
  ```

- Automatically injects:
  - `apikey`
  - `Authorization`
  - handles expiry + logout

- Use **TanStack Query** for all data fetching.

---

## Screen Scaffolding (Highly Recommended)

To keep routing, screens, and APIs consistent, this project includes a **screen scaffolding script**.

### Script Location

```text
/scripts/scaffold-screen.ts
```

### Register Script

Add to `package.json`:

```json
{
	"scripts": {
		"new:screen": "bun scripts/scaffold-screen.ts"
	}
}
```

---

## What the Script Generates

### Screen UI

```text
src/components/screens-component/<screen-name>/
├─ components/
│  └─ index.ts
├─ web-layout/
│  └─ index.tsx
├─ mob-layout/
│  └─ index.tsx
└─ index.ts
```

### Page Route (unless --no-pages)

```text
src/pages/<parent>/<screen-name>/
├─ index.tsx
└─ routes.ts
```

### API Layer (with --api)

```text
src/hooks/apis/<screen-name>/
├─ queries.ts
├─ mutations.ts
├─ type.ts
└─ index.ts
```

Also auto-updates:

```ts
src / hooks / apis / index.ts;
```

```ts
export * from "./<screen-name>";
```

---

## Screen Script Usage

### Basic screen

```bash
bun run new:screen netskill-lp-modules
```

### Screen with API hooks

```bash
bun run new:screen assessment-performance-report --api
```

### Create under authenticated area

```bash
bun run new:screen my-screen --parent=app/(_authenticated)
```

### Create under reports

IMPORTANT: zsh requires escaping parentheses.

```bash
bun run new:screen learning-path-report --api --parent=app/\(_authenticated\)/reports
```

### Create under settings

```bash
bun run new:screen platform-customization --parent=app/\(_authenticated\)/settings
```

### Skip page creation (UI only)

```bash
bun run new:screen my-shared-screen --no-pages
```

### Force overwrite existing files

```bash
bun run new:screen my-screen --force
```

### Combine flags

```bash
bun run new:screen completion-ratio \
  --api \
  --force \
  --parent=app/\(_authenticated\)/reports
```

---

## zsh Users: IMPORTANT

zsh treats parentheses as glob patterns.

Always escape or quote paths containing:

```text
(_authenticated)
```

Correct examples:

```bash
--parent=app/\(_authenticated\)/reports
```

or

```bash
--parent="app/(_authenticated)/reports"
```

---

## Generated Page Pattern

```tsx
import { ScreenWebLayout } from "@/components/screens-component/screen/web-layout";
import { ScreenMobileLayout } from "@/components/screens-component/screen/mob-layout";
import { useIsMobile } from "@/hooks/use-mobile";

function Screen() {
	const isMobile = useIsMobile();
	return isMobile ? <ScreenMobileLayout /> : <ScreenWebLayout />;
}

export default Screen;
```

---

## Scripts Reference

| Command            | Description              |
| ------------------ | ------------------------ |
| bun dev            | Start dev server         |
| bun run build      | Typecheck + build        |
| bun preview        | Preview production build |
| bun lint           | Run ESLint               |
| bun run lint:fix   | Auto-fix lint            |
| bun run typecheck  | TypeScript check         |
| bun run new:screen | Scaffold new screen      |

---

## Rules & Best Practices

- Do not edit `routeTree.gen.ts`
- Always use the screen scaffold script
- Screens live in `screens-component`
- Pages are thin route wrappers only
- APIs must live under `hooks/apis`
- Prefer query + mutation hooks
- Do not place logic inside layouts

---

## Staff portal (`platform/`)

`platform/` is a separate small app, the staff portal at https://platform.amulai.in. It has nothing to do with the farmer chat
app above: no shared code, no build step, its own `Dockerfile` and image (`amul-platform`).

- Static files served by nginx as a non-root user on port 8080 (`platform/nginx.conf`, `/healthz` for probes).
- Sign-in is an oauth2-proxy sidecar in front of it (Keycloak realm `amul`). The page reads the signed-in user from
  `/oauth2/userinfo` and signs out through `/oauth2/sign_out`, which also ends the Keycloak session.
- Tiles come from `platform/apps.json`. Each entry: `id`, `name`, `description`, `url`, `role`. `role` is `any` (every
  signed-in user), `<client>:<role>` (that Keycloak client role), or `<client>:*` (any role of that client). oauth2-proxy
  lists the user's Keycloak roles in `groups` as `role:<client>:<role>`. Adding an app is one entry. A hidden tile is a
  convenience, not access control: each app checks access itself.
- Run locally: `docker build -t amul-platform platform/ && docker run --rm -p 8080:8080 amul-platform`. Without the proxy,
  `/oauth2/userinfo` is missing, so the page shows its error line; the tiles need a real sign-in.
- Deployment and build: the `amul-platform` Deployment and `scripts/run-amul-platform-build.sh` in the infra repo
  (kaniko, build context `platform/`).
