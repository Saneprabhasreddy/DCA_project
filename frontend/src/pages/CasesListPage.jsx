import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, Brain, FileText } from 'lucide-react';

const STAGES = ['', 'Allocated', 'In Progress', 'PTP', 'Dispute', 'Escalated', 'Closed'];
const REGIONS = ['', 'NA', 'EMEA', 'APAC', 'LATAM'];

export default function CasesListPage() {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const [cases, setCases] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stage, setStage] = useState('');
    const [region, setRegion] = useState('');

    const fetchCases = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (search) params.search = search;
            if (stage) params.current_stage_snapshot = stage;
            if (region) params.region = region;
            const res = await api.get('/cases', { params });
            setCases(res.data.cases);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch (err) {
            toast.error('Failed to load cases');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCases(); }, [page, stage, region]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCases();
    };

    const stageBadge = (s) => {
        if (isDark) {
            const darkColors = {
                Allocated: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                'In Progress': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                PTP: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
                Dispute: 'bg-red-500/20 text-red-300 border border-red-500/30',
                Escalated: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
                Closed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
            };
            return darkColors[s] || 'bg-surface-700 text-surface-200 border border-surface-600';
        }

        const lightColors = {
            Allocated: 'bg-blue-100 text-blue-700 border border-blue-200',
            'In Progress': 'bg-amber-100 text-amber-700 border border-amber-200',
            PTP: 'bg-violet-100 text-violet-700 border border-violet-200',
            Dispute: 'bg-rose-100 text-rose-700 border border-rose-200',
            Escalated: 'bg-orange-100 text-orange-700 border border-orange-200',
            Closed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        };
        return lightColors[s] || 'bg-slate-100 text-slate-700 border border-slate-200';
    };

    const tableHeadRowClass = isDark ? 'border-b border-surface-700/50' : 'border-b border-slate-300';
    const tableHeadCellClass = isDark
        ? 'text-left px-4 py-3 text-xs font-semibold text-surface-200/50 uppercase tracking-wider'
        : 'text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider';
    const tableRowClass = isDark
        ? 'border-b border-surface-700/30 hover:bg-surface-800/50 cursor-pointer transition-colors'
        : 'border-b border-slate-200 hover:bg-blue-50/80 cursor-pointer transition-colors';
    const mutedCellClass = isDark ? 'px-4 py-3 text-surface-200/70' : 'px-4 py-3 text-slate-700';
    const amountCellClass = isDark ? 'px-4 py-3 text-surface-100 font-medium' : 'px-4 py-3 text-slate-900 font-semibold';
    const dcaBadgeClass = isDark
        ? 'badge bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
        : 'badge bg-cyan-100 text-cyan-700 border border-cyan-200';
    const caseIdClass = isDark ? 'px-4 py-3 font-semibold text-blue-300' : 'px-4 py-3 font-semibold text-blue-600';
    const placeholderTextClass = isDark ? 'text-surface-200/30' : 'text-slate-400';
    const lowProbClass = isDark ? 'text-amber-300' : 'text-amber-700';
    const highProbClass = isDark ? 'text-emerald-300' : 'text-emerald-700';
    const estRecoveryClass = isDark ? 'text-emerald-300 font-medium' : 'text-emerald-700 font-semibold';

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Cases</h1>
                    <p className="text-surface-200/50 text-sm">{total.toLocaleString()} total cases</p>
                </div>
                <button onClick={() => navigate('/cases/new')} className="btn-primary flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    New Case
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 flex flex-wrap items-center gap-4">
                <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search case ID..."
                            className="input-field input-field-icon-left"
                        />
                    </div>
                    <button type="submit" className="btn-primary">Search</button>
                </form>

                <select
                    value={stage}
                    onChange={(e) => { setStage(e.target.value); setPage(1); }}
                    className="input-field w-auto"
                >
                    {STAGES.map((s) => (
                        <option key={s} value={s}>{s || 'All Stages'}</option>
                    ))}
                </select>

                <select
                    value={region}
                    onChange={(e) => { setRegion(e.target.value); setPage(1); }}
                    className="input-field w-auto"
                >
                    {REGIONS.map((r) => (
                        <option key={r} value={r}>{r || 'All Regions'}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={tableHeadRowClass}>
                                    {['Case ID', 'Region', 'Industry', 'Amount', 'Overdue Days', 'DCA', 'Stage', 'Recovery Prob.', 'Est. Recovery'].map((h) => (
                                        <th key={h} className={tableHeadCellClass}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map((c, index) => (
                                    <tr
                                        key={c.case_id}
                                        onClick={() => navigate(`/cases/${c.case_id}`)}
                                        className={`${tableRowClass} ${!isDark && index % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                                    >
                                        <td className={caseIdClass}>{c.case_id}</td>
                                        <td className={mutedCellClass}>{c.region}</td>
                                        <td className={mutedCellClass}>{c.industry}</td>
                                        <td className={amountCellClass}>${c.invoice_amount_usd?.toLocaleString()}</td>
                                        <td className={mutedCellClass}>{c.overdue_days_at_allocation}</td>
                                        <td className="px-4 py-3">
                                            {c.assigned_dca_id ? (
                                                <span className={dcaBadgeClass}>{c.assigned_dca_id}</span>
                                            ) : (
                                                <span className={placeholderTextClass}>—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${stageBadge(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {c.ai_prob_60d != null ? (
                                                <span className={`font-semibold ${c.ai_prob_60d > 0.5 ? highProbClass : lowProbClass}`}>
                                                    {(c.ai_prob_60d * 100).toFixed(1)}%
                                                </span>
                                            ) : (
                                                <span className={placeholderTextClass}>—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {c.ai_exp_amt != null ? (
                                                <span className={estRecoveryClass}>${c.ai_exp_amt?.toLocaleString()}</span>
                                            ) : (
                                                <span className={placeholderTextClass}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-surface-700/50' : 'border-slate-300 bg-slate-50/50'}`}>
                        <p className={`text-xs ${isDark ? 'text-surface-200/50' : 'text-slate-500'}`}>
                            Page {page} of {pages} · {total} results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="btn-secondary p-2 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(Math.min(pages, page + 1))}
                                disabled={page >= pages}
                                className="btn-secondary p-2 disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
