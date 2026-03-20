/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                accent: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                },
                surface: {
                    50: 'rgb(var(--color-surface-50) / <alpha-value>)',
                    100: 'rgb(var(--color-surface-100) / <alpha-value>)',
                    200: 'rgb(var(--color-surface-200) / <alpha-value>)',
                    300: 'rgb(var(--color-surface-300) / <alpha-value>)',
                    400: 'rgb(var(--color-surface-400) / <alpha-value>)',
                    500: 'rgb(var(--color-surface-500) / <alpha-value>)',
                    600: 'rgb(var(--color-surface-600) / <alpha-value>)',
                    700: 'rgb(var(--color-surface-700) / <alpha-value>)',
                    800: 'rgb(var(--color-surface-800) / <alpha-value>)',
                    900: 'rgb(var(--color-surface-900) / <alpha-value>)',
                    950: 'rgb(var(--color-surface-950) / <alpha-value>)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
