export const ROUTES = {
  LOGIN: "/login",
  CHANGE_PASSWORD: "/change-password",
  DASHBOARD: "/",
  TEAMS: "/teams",
  TEAM_DETAIL: (id: string) => `/teams/${id}`,
  TEAM_NEW_PROJECT: (id: string) => `/teams/${id}/projects/new`,
  PROJECT_DETAIL: (id: string) => `/projects/${id}`,
  PROJECT_MEMBERS: (id: string) => `/projects/${id}/members`,
  ADMIN: "/admin",
  PROFILE: "/profile",
} as const;
