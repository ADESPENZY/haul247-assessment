import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // send the HttpOnly jwt_token cookie on every cross-origin request
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// No request interceptor — we no longer attach a Bearer token manually.
// The browser sends the HttpOnly jwt_token cookie automatically via withCredentials.

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Session expired or invalid — clear the presence indicator and go to login.
      Cookies.remove('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
