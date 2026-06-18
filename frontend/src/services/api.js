import axios from 'axios';

// 1. Cambiamos a la sintaxis de Vite con un respaldo automático al puerto 8000 si no encuentra el .env
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      
      // Si NO estamos en el login, redirigimos al usuario para que se vuelva a loguear
      if (!isLoginPage) {
        window.location.href = '/login';
      }
    }
    
    // IMPORTANTE: Siempre debemos rechazar la promesa para que el 'catch' de LoginPage pueda atrapar el error
    return Promise.reject(error);
  }
);

export default api;