import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const { login } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const demoTitleClass = isDark ? 'text-surface-200/40' : 'text-slate-500';
    const demoBtnClass = isDark
        ? 'text-xs px-3 py-2 rounded-lg bg-surface-800/50 hover:bg-surface-700 text-surface-200/80 hover:text-surface-100 transition-colors border border-surface-700/50'
        : 'text-xs px-3 py-2 rounded-lg bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors border border-slate-300 shadow-sm';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const user = await login(username, password);
            toast.success(`Welcome, ${user.username}!`);
            if (user.role === 'dca_user') {
                navigate('/my-cases');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center app-shell relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
            </div>

            <button
                onClick={toggleTheme}
                className="absolute top-5 right-5 z-20 btn-secondary p-2.5"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
                {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            <div className="relative z-10 w-full max-w-md animate-fade-in-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img src="/image.png" alt="SmartDCA logo" className="w-16 h-16 mx-auto mb-4 rounded-2xl object-cover shadow-lg shadow-blue-500/30" />
                    <h1 className="text-3xl font-bold gradient-text">SmartDCA</h1>
                    <p className="text-surface-200/50 mt-1">Recovery Platform</p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-8">
                    <h2 className="text-xl font-semibold text-surface-100 mb-6">Sign In</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm text-surface-200/70 mb-2">Username</label>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-field"
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-surface-200/70 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field input-field-icon-right"
                                    placeholder="Enter password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-200/50 hover:text-surface-100"
                                >
                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Demo credentials */}
                    <div className="mt-6 pt-6 border-t border-surface-700/50">
                        <p className={`text-xs mb-3 ${demoTitleClass}`}>Demo Credentials</p>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Admin', u: 'admin', p: 'admin123' },
                                { label: 'Manager', u: 'manager', p: 'manager123' },
                                { label: 'DCA User', u: 'dca_user_01', p: '123456' },
                            ].map((cred) => (
                                <button
                                    key={cred.u}
                                    onClick={() => { setUsername(cred.u); setPassword(cred.p); }}
                                    className={demoBtnClass}
                                >
                                    {cred.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
