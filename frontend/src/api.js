import axios from 'axios';

function normalizeApiBase(rawValue) {
    const trimmed = String(rawValue || '/api').trim().replace(/\/+$/, '');

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const parsed = new URL(trimmed);
            if (!parsed.pathname || parsed.pathname === '/') {
                parsed.pathname = '/api';
            }
            return parsed.toString().replace(/\/+$/, '');
        } catch {
            return trimmed;
        }
    }

    return trimmed;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
    baseURL: API_BASE,
    timeout: 120000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('smartdca_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('smartdca_token');
            localStorage.removeItem('smartdca_user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
