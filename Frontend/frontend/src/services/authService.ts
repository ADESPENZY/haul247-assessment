import api from '@/lib/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'admin' | 'operator';
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  created_at: string;
}

const authService = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),

  logout: () =>
    api.post<{ message: string }>('/auth/logout'),

  getMe: () =>
    api.get<User>('/auth/me'),
};

export default authService;
