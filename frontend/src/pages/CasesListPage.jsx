import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, Brain, FileText } from 'lucide-react';

const STAGES = ['', 'Allocated', 'In Progress', 'PTP', 'Dispute', 'Escalated', 'Closed'];
const REGIONS = ['', 'NA', 'EMEA', 'APAC', 'LATAM'];

export default function CasesListPage() {
    const navigate = useNavigate();
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
        const colors = {
            Allocated: 'bg-blue-500/20 text-blue-400',
            'In Progress': 'bg-amber-500/20 text-amber-400',
            PTP: 'bg-purple-500/20 text-purple-400',
            Dispute: 'bg-red-500/20 text-red-400',
            Escalated: 'bg-orange-500/20 text-orange-400',
            Closed: 'bg-emerald-500/20 text-emerald-400',
        };
        return colors[s] || 'bg-surface-700 text-surface-200';
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cases</h1>
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
                                <tr className="border-b border-surface-700/50">
                                    {['Case ID', 'Region', 'Industry', 'Amount', 'Overdue Days', 'DCA', 'Stage', 'Recovery Prob.', 'Est. Recovery'].map((h) => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map((c) => (
                                    <tr
                                        key={c.case_id}
                                        onClick={() => navigate(`/cases/${c.case_id}`)}
                                        className="border-b border-surface-700/30 hover:bg-surface-800/50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium text-blue-400">{c.case_id}</td>
                                        <td className="px-4 py-3 text-surface-200/70">{c.region}</td>
                                        <td className="px-4 py-3 text-surface-200/70">{c.industry}</td>
                                        <td className="px-4 py-3 text-white font-medium">${c.invoice_amount_usd?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-surface-200/70">{c.overdue_days_at_allocation}</td>
                                        <td className="px-4 py-3">
                                            {c.assigned_dca_id ? (
                                                <span className="badge bg-cyan-500/20 text-cyan-400">{c.assigned_dca_id}</span>
                                            ) : (
                                                <span className="text-surface-200/30">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${stageBadge(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {c.ai_prob_60d != null ? (
                                                <span className={`font-medium ${c.ai_prob_60d > 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {(c.ai_prob_60d * 100).toFixed(1)}%
                                                </span>
                                            ) : (
                                                <span className="text-surface-200/30">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {c.ai_exp_amt != null ? (
                                                <span className="text-emerald-400">${c.ai_exp_amt?.toLocaleString()}</span>
                                            ) : (
                                                <span className="text-surface-200/30">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700/50">
                        <p className="text-xs text-surface-200/50">
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
