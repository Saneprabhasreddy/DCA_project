import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'smartdca_theme';
const VALID_THEMES = new Set(['light', 'dark']);
const ThemeContext = createContext(null);

function getInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme && VALID_THEMES.has(savedTheme)) return savedTheme;
    return 'light';
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    const value = useMemo(() => ({
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
}
