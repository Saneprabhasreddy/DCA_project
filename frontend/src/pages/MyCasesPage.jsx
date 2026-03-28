import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Search, Loader2, FileText, AlertCircle, Clock, Target } from 'lucide-react';

export default function MyCasesPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState('');

    const fetchCases = async () => {
        setLoading(true);
        try {
            const params = { filter, sort };
            if (search) params.search = search;
            const res = await api.get('/cases', { params });
            setCases(res.data.cases);
        } catch (err) {
            toast.error('Failed to load cases');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCases(); }, [filter, sort]);

    const handleSearch = (e) => {
        e.preventDefault();
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
            <div>
                <h1 className="text-2xl font-bold text-surface-100">My Assigned Cases</h1>
                <p className="text-surface-200/50 text-sm">DCA: {user?.dca_id}</p>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="glass-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                <button type="submit" className="btn-primary w-full sm:w-auto">Search</button>
            </form>

            <div className="flex items-center gap-3 overflow-x-auto pb-2">
                <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === '' ? 'bg-blue-600 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}>All My Cases</button>
                <button onClick={() => setFilter('open')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === 'open' ? 'bg-emerald-600 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}>Open Cases</button>
                <button onClick={() => setFilter('closed')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === 'closed' ? 'bg-teal-700 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}>Closed Cases</button>
                <button onClick={() => setFilter('overdue_sla')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'overdue_sla' ? 'bg-red-600 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}><Clock className="w-4 h-4" /> Overdue SLA</button>
                <button onClick={() => setFilter('ptp')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'ptp' ? 'bg-purple-600 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}><Target className="w-4 h-4" /> PTPs</button>
                <button onClick={() => setFilter('dispute')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${filter === 'dispute' ? 'bg-amber-600 text-white' : 'bg-surface-800 text-surface-200/70 hover:bg-surface-700'}`}><AlertCircle className="w-4 h-4" /> Disputes</button>

                <div className="flex-1" />
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field w-auto text-sm">
                    <option value="">Sort: Newest First</option>
                    <option value="prob">Sort: AI Probability (High-Low)</option>
                    <option value="amount">Sort: Priority Inv. Amount</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : cases.length === 0 ? (
                <div className="text-center py-20">
                    <FileText className="w-16 h-16 mx-auto text-surface-200/20 mb-4" />
                    <p className="text-surface-200/50">No cases assigned to your DCA</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cases.map((c) => (
                        <div
                            key={c.case_id}
                            onClick={() => navigate(`/cases/${c.case_id}`)}
                            className="glass-card glass-card-hover p-5 cursor-pointer transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-semibold text-blue-400">{c.case_id}</span>
                                <span className={`badge ${stageBadge(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                            </div>

                            {(c.promised_to_pay_flag === 1 || c.dispute_flag === 1) && (
                                <div className="flex gap-2 mb-3">
                                    {c.promised_to_pay_flag === 1 && <span className="badge bg-purple-500/20 text-purple-400 flex items-center gap-1"><Target className="w-3 h-3" /> Active PTP</span>}
                                    {c.dispute_flag === 1 && <span className="badge bg-red-500/20 text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Disputed</span>}
                                </div>
                            )}

                            <div className="space-y-2 pt-2 border-t border-surface-700/50">
                                <div className="flex justify-between text-sm">
                                    <span className="text-surface-200/50">Amount</span>
                                    <span className="text-surface-100 font-medium">${c.invoice_amount_usd?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-surface-200/50">Region</span>
                                    <span className="text-surface-200/70">{c.region}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-surface-200/50">Industry</span>
                                    <span className="text-surface-200/70">{c.industry}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-surface-200/50">Overdue</span>
                                    <span className="text-amber-400">{c.overdue_days_at_allocation} days</span>
                                </div>
                                {c.ai_prob_60d != null && (
                                    <div className="flex justify-between text-sm pt-1 border-t border-surface-700/30">
                                        <span className="text-surface-200/50">Exp. Value (EV)</span>
                                        <span className="text-emerald-400 font-medium">
                                            ${(c.ai_prob_60d * c.invoice_amount_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
