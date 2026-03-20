import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    LayoutDashboard, FileText, Brain, LogOut, Menu, X, ChevronLeft,
    Users, Database, ChevronDown, Sun, Moon
} from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }) {
    const { user, logout, isAdmin, canManage, isDcaUser } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const linkClass = ({ isActive }) => {
        if (isActive) {
            return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isDark
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`;
        }
        return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isDark
            ? 'text-surface-200/70 hover:bg-surface-800 hover:text-surface-100'
            : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
            }`;
    };
    const sectionLabelClass = isDark
        ? 'text-xs font-semibold text-surface-200/40 uppercase tracking-wider px-4 mb-2'
        : 'text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2';

    return (
        <div className="flex h-screen overflow-hidden app-shell">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-0 -ml-64'
                    } transition-all duration-300 app-sidebar backdrop-blur-xl flex flex-col z-30`}
            >
                {/* Logo */}
                <div className="p-6 border-b border-surface-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold gradient-text">SmartDCA</h1>
                            <p className="text-xs text-surface-200/50">AI Recovery Platform</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {/* FedEx Internal: admin/manager */}
                    {canManage && (
                        <>
                            <p className={`${sectionLabelClass} mt-2`}>
                                Operations
                            </p>
                            <NavLink to="/dashboard" className={linkClass}>
                                <LayoutDashboard className="w-4 h-4" /> Dashboard
                            </NavLink>
                            <NavLink to="/cases" className={linkClass}>
                                <FileText className="w-4 h-4" /> Cases
                            </NavLink>
                        </>
                    )}

                    {/* DCA User */}
                    {isDcaUser && (
                        <>
                            <p className={`${sectionLabelClass} mt-2`}>
                                My Portal
                            </p>
                            <NavLink to="/my-cases" className={linkClass}>
                                <FileText className="w-4 h-4" /> My Cases
                            </NavLink>
                        </>
                    )}

                    {/* Admin Only */}
                    {isAdmin && (
                        <>
                            <p className={`${sectionLabelClass} mt-4`}>
                                Administration
                            </p>
                            <NavLink to="/admin/dcas" className={linkClass}>
                                <Users className="w-4 h-4" /> DCA Management
                            </NavLink>
                            <NavLink to="/admin/ingest" className={linkClass}>
                                <Database className="w-4 h-4" /> Data Ingestion
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-surface-700/50">
                    <div className="glass-card p-3 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-surface-100">{user?.username}</p>
                            <p className="text-xs text-surface-200/50 capitalize">{user?.role?.replace('_', ' ')}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <header className="h-16 app-topbar backdrop-blur-xl flex items-center px-6 gap-4">
                    <div className="flex-1" />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="btn-secondary p-2.5"
                            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                        >
                            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="btn-danger px-3 py-2 text-sm flex items-center gap-2"
                            aria-label="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Logout</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6 app-main">
                    {children}
                </main>
            </div>
        </div>
    );
}
