# Frontend Architecture

## Atomic Design Structure

```
src/components/
├── atoms/        ← Smallest units. Wrap or extend shadcn/ui primitives.
├── molecules/    ← 2–3 atoms combined. No business logic.
├── organisms/    ← Complex sections. Internal state OK. No API calls.
├── templates/    ← Page layout shells. No data, no logic.
└── providers/    ← React context wrappers (e.g. AuthProvider)
```

### Atoms (examples)
Button, Badge, Input, Label, Avatar, Spinner, Separator, Logo

### Molecules (examples)
FormField, StatusBadge, UserAvatar, SearchInput, ConfirmDialog, CopyButton, EmptyState

### Organisms (examples)
Sidebar, Topbar, ProjectCard, ProjectTable, EnvVarsForm, LogsViewer,
TeamMemberList, AddMemberModal, CreateTeamModal, CreateUserModal, DeployButton

### Templates
AuthTemplate — centered card layout (login, change-password)
DashboardTemplate — sidebar + topbar + content area

## Data Flow Rule

```
page → TanStack Query hook → service → lib/api.ts (axios) → backend
```

- **Pages** call hooks to get data, pass as props to components
- **Hooks** (`hooks/`) use TanStack Query (`useQuery` / `useMutation`) wrapping service functions — handle caching, loading, error, polling, invalidation
- **Services** (`services/`) contain all API call functions using the axios instance — one file per resource
- **Components** receive data as props only — never call API directly
- **Store** (`store/`) for global state that persists across pages (auth token, current user)
- **Forms** use `react-hook-form` + `zod` schemas for validation
- **Toasts** use `sonner` — call `toast.success()` / `toast.error()` from hooks after mutations

## File Conventions

Each component in its own folder:
```
components/atoms/Button/index.tsx
components/molecules/FormField/index.tsx
components/organisms/Sidebar/index.tsx
```

## App Router Groups

```
src/app/
├── (auth)/           ← No sidebar: login, change-password
│   └── layout.tsx    ← AuthTemplate
└── (dashboard)/      ← With sidebar: all app pages
    └── layout.tsx    ← DashboardTemplate
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/api.ts` | Axios instance — base URL, JWT interceptor, 401 → logout handler |
| `lib/utils.ts` | `cn()`, `slugify()`, `formatDate()` — date format: DD/MM/YYYY |
| `store/auth.store.ts` | Zustand store — current user, JWT token, login/logout |
| `constants/routes.ts` | All route path constants |
| `constants/status.ts` | Project status labels and badge colors |
| `types/*.types.ts` | TypeScript interfaces matching backend models |
