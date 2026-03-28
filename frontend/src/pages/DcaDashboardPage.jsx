import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import {
    Loader2,
    FileText,
    FolderOpen,
    CheckCircle2,
    Clock3,
    AlertTriangle,
    Target,
    DollarSign,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const STAGE_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#f97316', '#10b981', '#06b6d4'];
const DCA_STATS_UNAVAILABLE_UNTIL_KEY = 'smartdca_dca_stats_unavailable_until';
const DCA_STATS_FALLBACK_TTL_MS = 10 * 60 * 1000;

const formatMoney = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function stageBadgeClass(stage) {
    const styles = {
        Allocated: 'bg-blue-500/20 text-blue-400',
        'In Progress': 'bg-amber-500/20 text-amber-400',
        PTP: 'bg-purple-500/20 text-purple-400',
        Dispute: 'bg-red-500/20 text-red-400',
        Escalated: 'bg-orange-500/20 text-orange-400',
        Closed: 'bg-emerald-500/20 text-emerald-400',
    };
    return styles[stage] || 'bg-surface-700 text-surface-200';
}

export default function DcaDashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const hasFetchedRef = useRef(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [usingFallback, setUsingFallback] = useState(false);
    const [loadError, setLoadError] = useState('');

    const deriveStatsFromCases = (cases) => {
        const openCases = cases.filter((c) => c.current_stage_snapshot !== 'Closed');
        const closedCases = cases.filter((c) => c.current_stage_snapshot === 'Closed');
        const overdueCases = openCases.filter((c) => c.sla_due_date && new Date(c.sla_due_date) < new Date());
        const ptpCases = cases.filter((c) => c.promised_to_pay_flag === 1 || c.current_stage_snapshot === 'PTP');
        const disputeCases = cases.filter((c) => c.dispute_flag === 1 || c.current_stage_snapshot === 'Dispute');
        const escalatedCases = cases.filter((c) => c.escalation_flag === 1 || c.current_stage_snapshot === 'Escalated');
        const recoveredCases = cases.filter((c) => c.recovered_flag === 1);

        const totalInvoiceAmount = cases.reduce((sum, c) => sum + Number(c.invoice_amount_usd || 0), 0);
        const openInvoiceAmount = openCases.reduce((sum, c) => sum + Number(c.invoice_amount_usd || 0), 0);
        const totalRecoveredAmount = cases.reduce((sum, c) => sum + Number(c.recovered_amount_usd || 0), 0);

        const avgOverdueDays = cases.length > 0
            ? (cases.reduce((sum, c) => sum + Number(c.overdue_days_at_allocation || 0), 0) / cases.length)
            : 0;
        const aiProbCases = cases.filter((c) => c.ai_prob_60d != null);
        const avgAiProb60d = aiProbCases.length > 0
            ? (aiProbCases.reduce((sum, c) => sum + Number(c.ai_prob_60d || 0), 0) / aiProbCases.length)
            : null;

        const stageMap = {};
        for (const c of cases) {
            const key = c.current_stage_snapshot || 'Unknown';
            if (!stageMap[key]) stageMap[key] = { _id: key, count: 0, totalInvoice: 0 };
            stageMap[key].count += 1;
            stageMap[key].totalInvoice += Number(c.invoice_amount_usd || 0);
        }
        const stageBreakdown = Object.values(stageMap).sort((a, b) => b.count - a.count);

        const regionMap = {};
        for (const c of cases) {
            const key = c.region || 'Unknown';
            if (!regionMap[key]) regionMap[key] = { _id: key, count: 0, totalInvoice: 0 };
            regionMap[key].count += 1;
            regionMap[key].totalInvoice += Number(c.invoice_amount_usd || 0);
        }
        const regionBreakdown = Object.values(regionMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        const priorityCases = openCases
            .sort((a, b) => {
                const overdueDiff = Number(b.overdue_days_at_allocation || 0) - Number(a.overdue_days_at_allocation || 0);
                if (overdueDiff !== 0) return overdueDiff;
                return Number(b.invoice_amount_usd || 0) - Number(a.invoice_amount_usd || 0);
            })
            .slice(0, 8)
            .map((c) => ({
                case_id: c.case_id,
                current_stage_snapshot: c.current_stage_snapshot,
                invoice_amount_usd: c.invoice_amount_usd,
                overdue_days_at_allocation: c.overdue_days_at_allocation,
                ai_prob_60d: c.ai_prob_60d,
                dispute_flag: c.dispute_flag,
                promised_to_pay_flag: c.promised_to_pay_flag,
                sla_due_date: c.sla_due_date,
            }));

        const totalAssigned = cases.length;
        const recoveryRate = totalAssigned > 0 ? Number(((recoveredCases.length / totalAssigned) * 100).toFixed(1)) : 0;
        const closureRate = totalAssigned > 0 ? Number(((closedCases.length / totalAssigned) * 100).toFixed(1)) : 0;

        return {
            dcaId: user?.dca_id,
            totals: {
                totalAssigned,
                openCases: openCases.length,
                closedCases: closedCases.length,
                overdueCases: overdueCases.length,
                ptpCases: ptpCases.length,
                disputeCases: disputeCases.length,
                escalatedCases: escalatedCases.length,
                recoveredCases: recoveredCases.length,
                totalInvoiceAmount,
                openInvoiceAmount,
                totalRecoveredAmount,
                avgOverdueDays,
                avgAiProb60d,
                recoveryRate,
                closureRate,
            },
            stageBreakdown,
            regionBreakdown,
            priorityCases,
        };
    };

    const fetchAllMyCases = async () => {
        const limit = 500;
        let page = 1;
        let pages = 1;
        const allCases = [];

        do {
            const res = await api.get('/cases', { params: { page, limit } });
            allCases.push(...(res.data?.cases || []));
            pages = Number(res.data?.pages || 1);
            page += 1;
        } while (page <= pages);

        return allCases;
    };

    const fetchStats = async () => {
        setLoading(true);
        setLoadError('');
        const unavailableUntil = Number(sessionStorage.getItem(DCA_STATS_UNAVAILABLE_UNTIL_KEY) || 0);
        const shouldSkipDcaStatsApi = Number.isFinite(unavailableUntil) && Date.now() < unavailableUntil;
        try {
            if (shouldSkipDcaStatsApi) {
                const allCases = await fetchAllMyCases();
                const computedStats = deriveStatsFromCases(allCases);
                setStats(computedStats);
                setUsingFallback(true);
                return;
            }

            const res = await api.get('/dashboard/dca-stats');
            setStats(res.data);
            setUsingFallback(false);
            sessionStorage.removeItem(DCA_STATS_UNAVAILABLE_UNTIL_KEY);
        } catch (err) {
            if (err.response?.status === 404) {
                sessionStorage.setItem(
                    DCA_STATS_UNAVAILABLE_UNTIL_KEY,
                    String(Date.now() + DCA_STATS_FALLBACK_TTL_MS)
                );
                try {
                    const allCases = await fetchAllMyCases();
                    const computedStats = deriveStatsFromCases(allCases);
                    setStats(computedStats);
                    setUsingFallback(true);
                } catch {
                    setLoadError('Failed to load DCA dashboard');
                    toast.error('Failed to load DCA dashboard');
                }
            } else {
                setLoadError(err.response?.data?.error || 'Failed to load DCA dashboard');
                toast.error(err.response?.data?.error || 'Failed to load DCA dashboard');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        fetchStats();
    }, []);

    const totals = stats?.totals || {};
    const stageData = stats?.stageBreakdown || [];
    const regionData = stats?.regionBreakdown || [];
    const priorityCases = stats?.priorityCases || [];

    const kpis = useMemo(() => ([
        { label: 'Assigned Cases', value: Number(totals.totalAssigned || 0).toLocaleString(), icon: FileText, tone: 'from-blue-500 to-blue-600' },
        { label: 'Open Cases', value: Number(totals.openCases || 0).toLocaleString(), icon: FolderOpen, tone: 'from-indigo-500 to-indigo-600' },
        { label: 'Closed Cases', value: Number(totals.closedCases || 0).toLocaleString(), icon: CheckCircle2, tone: 'from-emerald-500 to-emerald-600' },
        { label: 'Overdue SLA', value: Number(totals.overdueCases || 0).toLocaleString(), icon: Clock3, tone: 'from-red-500 to-red-600' },
        { label: 'Disputes + Escalations', value: Number((totals.disputeCases || 0) + (totals.escalatedCases || 0)).toLocaleString(), icon: AlertTriangle, tone: 'from-orange-500 to-orange-600' },
        { label: 'Recovery Rate', value: formatPercent(totals.recoveryRate || 0), icon: Target, tone: 'from-teal-500 to-teal-600' },
        { label: 'Open Exposure', value: formatMoney(totals.openInvoiceAmount), icon: DollarSign, tone: 'from-amber-500 to-amber-600' },
        { label: 'Recovered Amount', value: formatMoney(totals.totalRecoveredAmount), icon: DollarSign, tone: 'from-cyan-500 to-cyan-600' },
    ]), [totals]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="glass-card p-6 text-center">
                <p className="text-surface-100 font-semibold">Unable to load dashboard</p>
                <p className="text-surface-200/60 text-sm mt-1">{loadError || 'Please refresh or restart backend service.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">My Dashboard</h1>
                <p className="text-surface-200/50 text-sm">
                    DCA: {user?.dca_id} | Collection analysis for assigned portfolio
                </p>
            </div>

         
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((item) => (
                    <div key={item.label} className="glass-card glass-card-hover p-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.tone} flex items-center justify-center mb-3`}>
                            <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-surface-100">{item.value}</p>
                        <p className="text-xs text-surface-200/50 mt-1">{item.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-5">
                    <h2 className="text-lg font-semibold text-surface-100 mb-4">Stage Distribution</h2>
                    {stageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stageData}
                                    dataKey="count"
                                    nameKey="_id"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={58}
                                    outerRadius={96}
                                    label={({ _id, count }) => `${_id || 'Unknown'}: ${count}`}
                                >
                                    {stageData.map((_, idx) => (
                                        <Cell key={idx} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [value, name || 'Unknown']}
                                    contentStyle={{ borderRadius: '10px', border: '1px solid rgba(100,116,139,0.3)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-surface-200/50 text-sm py-10 text-center">No stage analytics yet.</p>
                    )}
                </div>

                <div className="glass-card p-5">
                    <h2 className="text-lg font-semibold text-surface-100 mb-4">Region Exposure</h2>
                    {regionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={regionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                                <XAxis dataKey="_id" stroke="rgb(var(--color-surface-300))" fontSize={12} />
                                <YAxis stroke="rgb(var(--color-surface-300))" fontSize={12} />
                                <Tooltip
                                    formatter={(value, name) => {
                                        if (name === 'totalInvoice') return [formatMoney(value), 'Invoice'];
                                        return [value, 'Cases'];
                                    }}
                                    labelFormatter={(label) => `Region: ${label || 'Unknown'}`}
                                    contentStyle={{ borderRadius: '10px', border: '1px solid rgba(100,116,139,0.3)' }}
                                />
                                <Bar dataKey="count" name="Cases" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-surface-200/50 text-sm py-10 text-center">No regional analytics yet.</p>
                    )}
                </div>
            </div>

            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-surface-100">Priority Cases</h2>
                    <p className="text-xs text-surface-200/50">Sorted by overdue days and invoice value</p>
                </div>
                {priorityCases.length === 0 ? (
                    <p className="text-surface-200/50 text-sm py-6 text-center">No cases assigned yet.</p>
                ) : (
                    <div className="space-y-3">
                        {priorityCases.map((c) => (
                            <button
                                key={c.case_id}
                                type="button"
                                onClick={() => navigate(`/cases/${c.case_id}`)}
                                className="w-full text-left bg-surface-800/40 border border-surface-700/50 hover:border-blue-500/40 rounded-xl p-4 transition-colors"
                            >
                                <div className="flex flex-wrap items-center gap-2 justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-blue-400">{c.case_id}</span>
                                        <span className={`badge ${stageBadgeClass(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                                        {c.promised_to_pay_flag === 1 && (
                                            <span className="badge bg-purple-500/20 text-purple-400">PTP</span>
                                        )}
                                        {c.dispute_flag === 1 && (
                                            <span className="badge bg-red-500/20 text-red-400">Dispute</span>
                                        )}
                                    </div>
                                    <span className="text-surface-200/50 text-xs">
                                        AI 60d: {c.ai_prob_60d != null ? formatPercent(c.ai_prob_60d * 100) : 'N/A'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                                    <div>
                                        <p className="text-surface-200/50">Invoice</p>
                                        <p className="text-surface-100 font-medium">{formatMoney(c.invoice_amount_usd)}</p>
                                    </div>
                                    <div>
                                        <p className="text-surface-200/50">Overdue</p>
                                        <p className="text-amber-400 font-medium">{Number(c.overdue_days_at_allocation || 0)} days</p>
                                    </div>
                                    <div>
                                        <p className="text-surface-200/50">SLA Due</p>
                                        <p className="text-surface-100 font-medium">
                                            {c.sla_due_date ? new Date(c.sla_due_date).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-surface-200/50">Expected Value</p>
                                        <p className="text-emerald-400 font-medium">
                                            {c.ai_prob_60d != null
                                                ? formatMoney((c.ai_prob_60d || 0) * (c.invoice_amount_usd || 0))
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
