import api from './client'

export interface AdminUser {
  oidc_sub: string
  display_name: string
  email: string | null
  given_name: string | null
  family_name: string | null
  role: string
  created_at: string
  last_login: string | null
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users'),

  updateRole: (userId: string, role: string) =>
    api.put<AdminUser>(`/admin/users/${userId}/role`, { role }),
}
