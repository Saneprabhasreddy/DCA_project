import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <App />
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            style: {
                                background: 'rgb(var(--color-surface-900) / 0.95)',
                                color: 'rgb(var(--color-surface-100))',
                                border: '1px solid rgb(var(--color-surface-700) / 0.85)',
                                borderRadius: '12px',
                            },
                        }}
                    />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    </React.StrictMode>
);
