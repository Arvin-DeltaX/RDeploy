# Code Conventions

## General

- TypeScript strict mode everywhere — no `any`
- Use `UUID` for all primary keys
- Use `kebab-case` for URL slugs
- API routes prefixed with `/api/`
- Environment variables in `UPPER_SNAKE_CASE`

## Backend

- Use Prisma for all database operations — no raw SQL
- Use bcrypt for password hashing
- Use JWT for authentication tokens (7 day expiry, no refresh tokens)
- Use zod for all request body validation in routes
- Use AES-256-GCM (`utils/encryption.ts`) for encrypting env var values and GitHub tokens
- Services contain business logic — routes only handle HTTP in/out
- Middleware handles auth and permission checks
- Always return consistent error shape:
  ```json
  { "error": "message here" }
  ```
- Always return consistent success shape:
  ```json
  { "data": { ... } }
  ```

## Frontend

- Use `lib/api.ts` (axios instance) for all HTTP calls — never use fetch or raw axios directly in components
- Use TanStack Query (`useQuery` / `useMutation`) in hooks for all data fetching — never fetch in components or pages
- Use `react-hook-form` + `zod` for all forms
- Use `sonner` (`toast.success` / `toast.error`) for user feedback after mutations
- Use Zustand for global state — no prop drilling for auth
- Use `cn()` from `lib/utils.ts` for conditional Tailwind classes
- Component folders use PascalCase: `Button/`, `FormField/`
- Hook files use camelCase with `use` prefix: `useAuth.ts`, `useProjects.ts`
- Service files use camelCase with `.service.ts` suffix: `auth.service.ts`
- Type files use camelCase with `.types.ts` suffix: `user.types.ts`

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | PascalCase | `ProjectCard` |
| Hooks | camelCase + use prefix | `useProjects` |
| Services | camelCase + .service | `projects.service.ts` |
| Types | camelCase + .types | `project.types.ts` |
| Constants | camelCase + .ts | `routes.ts` |
| DB tables | PascalCase (Prisma) | `TeamMember` |
| API routes | kebab-case | `/api/team-members` |
| URL slugs | kebab-case | `my-project` |
| Env vars | UPPER_SNAKE_CASE | `JWT_SECRET` |
