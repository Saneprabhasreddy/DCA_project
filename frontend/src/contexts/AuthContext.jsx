import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('smartdca_token');
        const savedUser = localStorage.getItem('smartdca_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const res = await api.post('/auth/login', { username, password });
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('smartdca_token', newToken);
        localStorage.setItem('smartdca_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        return newUser;
    };

    const logout = () => {
        localStorage.removeItem('smartdca_token');
        localStorage.removeItem('smartdca_user');
        setToken(null);
        setUser(null);
    };

    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';
    const isDcaUser = user?.role === 'dca_user';
    const canManage = isAdmin || isManager;

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isManager, isDcaUser, canManage }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
