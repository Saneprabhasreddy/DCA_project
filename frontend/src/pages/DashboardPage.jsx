import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, DollarSign, FileText, Users, Brain, Loader2,
    Activity, Target, Zap, RefreshCw
} from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

function StageTooltip({ active, payload, isDark }) {
    if (!active || !payload?.length) return null;

    const item = payload[0];
    return (
        <div className={`rounded-lg px-3 py-2 shadow-2xl ${isDark
            ? 'border border-blue-400/50 bg-slate-900/95 backdrop-blur-sm'
            : 'border border-slate-300 bg-white'
            }`}>
            <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Case Stage</p>
            <p className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-surface-100' : 'text-slate-800'}`}>
                <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color || '#60a5fa' }}
                />
                {item.name}: {item.value}
            </p>
        </div>
    );
}

export default function DashboardPage() {
    const { isDark } = useTheme();
    const [stats, setStats] = useState(null);
    const [training, setTraining] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const res = await api.get('/dashboard/stats');
            setStats(res.data);
        } catch (err) {
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    const handleTrain = async () => {
        setTraining(true);
        try {
            const res = await api.post('/ml/train');
            toast.success('Models retrained successfully!');
            fetchStats();
        } catch (err) {
            const payload = err.response?.data || {};
            const message = payload.error || 'Training failed';
            const details = payload.details ? ` ${payload.details}` : '';
            toast.error(`${message}${details}`.trim());
        } finally {
            setTraining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!stats) return null;

    const formatPct = (value) => (
        Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—'
    );

    const rawMetrics = stats.latestMetrics || null;
    const metrics = rawMetrics
        ? {
            ...rawMetrics,
            accuracy: rawMetrics.accuracy ?? rawMetrics.clf_accuracy,
            precision: rawMetrics.precision ?? rawMetrics.clf_precision,
            recall: rawMetrics.recall ?? rawMetrics.clf_recall,
            roc_auc: rawMetrics.roc_auc ?? rawMetrics.clf_roc_auc,
            pr_auc: rawMetrics.pr_auc ?? rawMetrics.clf_pr_auc,
            amount_mae: rawMetrics.amount_mae ?? rawMetrics.reg_amount_mae,
            days_mae: rawMetrics.days_mae ?? rawMetrics.reg_days_mae,
            confusion_matrix: rawMetrics.confusion_matrix ?? (
                (rawMetrics.tn != null || rawMetrics.fp != null || rawMetrics.fn != null || rawMetrics.tp != null)
                    ? {
                        tn: rawMetrics.tn ?? 0,
                        fp: rawMetrics.fp ?? 0,
                        fn: rawMetrics.fn ?? 0,
                        tp: rawMetrics.tp ?? 0,
                    }
                    : null
            ),
        }
        : null;

    const kpis = [
        { label: 'Total Cases', value: stats.totalCases?.toLocaleString(), icon: FileText, color: 'from-blue-500 to-blue-600' },
        { label: 'Active Cases', value: stats.allocatedCases?.toLocaleString(), icon: Activity, color: 'from-purple-500 to-purple-600' },
        { label: 'Recovered', value: stats.recoveredCases?.toLocaleString(), icon: Target, color: 'from-emerald-500 to-emerald-600' },
        { label: 'Recovery Rate', value: `${stats.recoveryRate}%`, icon: TrendingUp, color: 'from-amber-500 to-amber-600' },
        { label: 'Total Invoice', value: `$${(stats.totalInvoiceAmount / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'from-cyan-500 to-cyan-600' },
        { label: 'Recovered Amt', value: `$${(stats.totalRecoveredAmount / 1e6).toFixed(1)}M`, icon: Zap, color: 'from-pink-500 to-pink-600' },
    ];

    const stageData = stats.stageBreakdown?.map((s) => ({ name: s._id || 'Unknown', value: s.count })) || [];
    const dcaData = stats.dcaPerformance?.map((d) => ({
        name: d._id,
        cases: d.total,
        recovered: d.recovered,
        rate: d.total > 0 ? ((d.recovered / d.total) * 100).toFixed(1) : 0,
    })) || [];

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
                    <p className="text-surface-200/50 text-sm mt-1">AI-powered recovery analytics</p>
                </div>
                <button
                    id="train-again-btn"
                    onClick={handleTrain}
                    disabled={training}
                    className="btn-primary flex items-center gap-2"
                >
                    {training ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {training ? 'Training...' : 'Train Again'}
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="glass-card glass-card-hover p-4 group">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                            <kpi.icon className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-surface-100">{kpi.value}</p>
                        <p className="text-xs text-surface-200/50 mt-1">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* ML Metrics + Stage Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ML Metrics */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-surface-100">Latest Training Metrics</h2>
                    </div>
                    {metrics ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Accuracy', value: formatPct(metrics.accuracy), color: 'text-blue-400' },
                                    { label: 'Precision', value: formatPct(metrics.precision), color: 'text-purple-400' },
                                    { label: 'Recall', value: formatPct(metrics.recall), color: 'text-emerald-400' },
                                    { label: 'ROC AUC', value: formatPct(metrics.roc_auc), color: 'text-amber-400' },
                                    { label: 'PR AUC', value: formatPct(metrics.pr_auc), color: 'text-pink-400' },
                                    { label: 'Training Rows', value: metrics.n_rows?.toLocaleString(), color: 'text-cyan-400' },
                                ].map((m, i) => (
                                    <div key={i} className="bg-surface-800/50 rounded-xl p-3">
                                        <p className="text-xs text-surface-200/50">{m.label}</p>
                                        <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Confusion Matrix */}
                            {metrics.confusion_matrix && (
                                <div className="mt-4">
                                    <p className="text-sm text-surface-200/70 mb-2">Confusion Matrix</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-emerald-400/70">True Neg (TN)</p>
                                            <p className="text-lg font-bold text-emerald-400">{metrics.confusion_matrix.tn}</p>
                                        </div>
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-red-400/70">False Pos (FP)</p>
                                            <p className="text-lg font-bold text-red-400">{metrics.confusion_matrix.fp}</p>
                                        </div>
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-amber-400/70">False Neg (FN)</p>
                                            <p className="text-lg font-bold text-amber-400">{metrics.confusion_matrix.fn}</p>
                                        </div>
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-blue-400/70">True Pos (TP)</p>
                                            <p className="text-lg font-bold text-blue-400">{metrics.confusion_matrix.tp}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Regression Metrics */}
                            {(metrics.amount_mae || metrics.days_mae) && (
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div className="bg-surface-800/50 rounded-xl p-3">
                                        <p className="text-xs text-surface-200/50">Amount MAE</p>
                                        <p className="text-lg font-bold text-orange-400">${metrics.amount_mae?.toFixed(0)}</p>
                                    </div>
                                    <div className="bg-surface-800/50 rounded-xl p-3">
                                        <p className="text-xs text-surface-200/50">Days MAE</p>
                                        <p className="text-lg font-bold text-teal-400">{metrics.days_mae?.toFixed(1)} days</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-surface-200/50">
                            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No training metrics yet</p>
                            <p className="text-xs mt-1">Click "Train Again" to train models</p>
                        </div>
                    )}
                </div>

                {/* Stage Distribution */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-surface-100 mb-4">Case Stage Distribution</h2>
                    {stageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={stageData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {stageData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={<StageTooltip isDark={isDark} />}
                                    cursor={false}
                                    wrapperStyle={{ outline: 'none' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-surface-200/50 text-center py-12">No data</p>
                    )}
                </div>
            </div>

            {/* DCA Performance */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-surface-100 mb-4">DCA Performance</h2>
                {dcaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dcaData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#cbd5e1'} />
                            <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} />
                            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    background: isDark ? '#1e293b' : '#ffffff',
                                    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                                    borderRadius: '12px',
                                    color: isDark ? '#f1f5f9' : '#0f172a',
                                }}
                            />
                            <Bar dataKey="cases" fill="#3b82f6" name="Total Cases" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="recovered" fill="#22c55e" name="Recovered" radius={[4, 4, 0, 0]} />
                            <Legend />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-surface-200/50 text-center py-12">No DCA data</p>
                )}
            </div>

            {/* Recent Audit Trail */}
            {stats.recentAudit && stats.recentAudit.length > 0 && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-surface-100 mb-4">Recent Activity</h2>
                    <div className="space-y-2">
                        {stats.recentAudit.map((a, i) => (
                            <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${isDark ? 'bg-surface-800/30 border-surface-700/30' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                <div className="flex-1">
                                    <p className={`text-sm ${isDark ? 'text-surface-100' : 'text-slate-700'}`}>
                                        <span className="text-blue-400 font-medium">{a.actor_user}</span>
                                        {' — '}
                                        <span className={isDark ? 'text-surface-200/70' : 'text-slate-600'}>{a.action}</span>
                                        {a.entity_id && <span className={isDark ? 'text-surface-200/50' : 'text-slate-500'}> • {a.entity_id}</span>}
                                    </p>
                                </div>
                                <p className={`text-xs ${isDark ? 'text-surface-200/40' : 'text-slate-500'}`}>
                                    {new Date(a.timestamp).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
