# Roles & Permissions

## Platform Roles (on User)

| Role  | Description                        |
|-------|------------------------------------|
| owner | Platform owner — full access       |
| admin | Platform administrator — full access |
| user  | Regular user — team-scoped access  |

## Team Roles (on TeamMember)

| Role    | Description                                    |
|---------|------------------------------------------------|
| leader  | Full project management. A team can have zero leaders. |
| elder   | Senior member. Can edit env vars.              |
| member  | Read-only. Can view projects, logs, members.   |

## Permission Matrix

| Action                    | Owner | Admin | Leader | Elder | Member |
|---------------------------|-------|-------|--------|-------|--------|
| Create / delete team      | ✅    | ✅    | ❌     | ❌    | ❌     |
| Add / remove team members | ✅    | ✅    | ❌     | ❌    | ❌     |
| Add project to team       | ✅    | ✅    | ✅     | ❌    | ❌     |
| Assign members to project | ✅    | ✅    | ✅     | ❌    | ❌     |
| Deploy / Stop / Delete    | ✅    | ✅    | ✅     | ❌    | ❌     |
| Edit env vars             | ✅    | ✅    | ✅     | ✅    | ❌     |
| View any project          | ✅    | ✅    | ✅     | ✅    | ✅     |
| View logs                 | ✅    | ✅    | ✅     | ✅    | ✅     |
| View team member list     | ✅    | ✅    | ✅     | ✅    | ✅     |
| Create users              | ✅    | ✅    | ❌     | ❌    | ❌     |
| Promote users to admin    | ✅    | ✅    | ❌     | ❌    | ❌     |

## Auth Rules

- No public registration — Owner/Admin creates users only
- New users get a default password and `mustChangePassword: true`
- First login forces redirect to `/change-password`
- GitHub connect is optional — only needed for private repos
- A team can have zero leaders — there is no forced minimum
- If a leader is removed or their account is deleted, the team simply has no leader
- UI shows a warning banner on teams with no leader
- Owner/Admin can always perform leader-level actions regardless
