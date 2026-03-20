import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Brain, Users, CheckCircle, Loader2, Clock, DollarSign,
    Target, Zap, MessageSquare, Plus, Send, Phone, Mail, Copy, User, Edit3, X
} from 'lucide-react';

export default function CaseDetailPage() {
    const { case_id } = useParams();
    const navigate = useNavigate();
    const { canManage, isDcaUser } = useAuth();

    const [caseData, setCaseData] = useState(null);
    const [interactions, setInteractions] = useState([]);
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(true);
    const [predicting, setPredicting] = useState(false);
    const [showPredictionModal, setShowPredictionModal] = useState(false);
    const [predictedScore, setPredictedScore] = useState(null);
    const [showRecommendModal, setShowRecommendModal] = useState(false);
    const [topRecommendedDca, setTopRecommendedDca] = useState('');
    const [recommending, setRecommending] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [showAddInteraction, setShowAddInteraction] = useState(false);
    const [newInteraction, setNewInteraction] = useState({ event_type: 'Note Added', channel: 'Portal', notes: '', stage: '', outcome: '', close_reason: '' });
    const [reassignMode, setReassignMode] = useState(false);
    const [editingContact, setEditingContact] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [contactForm, setContactForm] = useState({
        contact_person_name: '',
        company_name: '',
        phone: '',
        alternate_phone: '',
        email: '',
        address: '',
        preferred_contact_channel: 'Email',
        timezone: 'UTC',
    });

    const fetchCase = async () => {
        try {
            const [caseRes, intRes] = await Promise.all([
                api.get(`/cases/${case_id}`),
                api.get(`/cases/${case_id}/interactions`),
            ]);
            setCaseData(caseRes.data);
            setInteractions(intRes.data);
        } catch (err) {
            toast.error('Failed to load case');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCase(); }, [case_id]);

    const handlePredict = async () => {
        setPredicting(true);
        try {
            const res = await api.post(`/cases/${case_id}/predict`);
            const prob60d = Number(res.data?.prob_60d);
            if (Number.isFinite(prob60d)) {
                setPredictedScore((prob60d * 100).toFixed(1));
                setShowPredictionModal(true);
            } else {
                toast.success('Prediction completed');
            }
            fetchCase();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Prediction failed');
        } finally {
            setPredicting(false);
        }
    };

    const handleRecommend = async () => {
        setRecommending(true);
        try {
            const res = await api.post(`/cases/${case_id}/recommend`);
            setRecommendations(res.data);
            if (res.data?.best_dca) {
                setTopRecommendedDca(res.data.best_dca);
                setShowRecommendModal(true);
            } else {
                toast.success('Recommendation completed');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Recommendation failed');
        } finally {
            setRecommending(false);
        }
    };

    const handleAssign = async (dca_id) => {
        if (c.current_stage_snapshot === 'Closed') {
            toast.error('Cannot assign a closed case.');
            return;
        }
        if (!c.phone && !c.email) {
            toast.error('Cannot assign case: Customer contact info is required.');
            return;
        }
        setAssigning(true);
        try {
            await api.post(`/cases/${case_id}/assign`, { assigned_dca_id: dca_id });
            toast.success(`Case assigned to ${dca_id}`);
            setReassignMode(false);
            fetchCase();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Assignment failed');
        } finally {
            setAssigning(false);
        }
    };

    const handleAddInteraction = async (e) => {
        e.preventDefault();
        if (caseData?.current_stage_snapshot === 'Closed') {
            toast.error('Cannot add interactions to a closed case.');
            setShowAddInteraction(false);
            return;
        }
        try {
            await api.post(`/cases/${case_id}/interactions`, newInteraction);
            toast.success('Interaction added');
            setShowAddInteraction(false);
            setNewInteraction({ event_type: 'Note Added', channel: 'Portal', notes: '', stage: '', outcome: '', close_reason: '' });
            fetchCase();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add interaction');
        }
    };

    const openContactEditor = () => {
        setContactForm({
            contact_person_name: caseData?.contact_person_name || '',
            company_name: caseData?.company_name || '',
            phone: caseData?.phone || '',
            alternate_phone: caseData?.alternate_phone || '',
            email: caseData?.email || '',
            address: caseData?.address || '',
            preferred_contact_channel: caseData?.preferred_contact_channel || 'Email',
            timezone: caseData?.timezone || 'UTC',
        });
        setEditingContact(true);
    };

    const handleSaveContact = async (e) => {
        e.preventDefault();
        setSavingContact(true);
        try {
            await api.patch(`/cases/${case_id}/contact`, contactForm);
            toast.success('Customer contact updated');
            setEditingContact(false);
            fetchCase();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update contact');
        } finally {
            setSavingContact(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!caseData) return null;

    const c = caseData;
    const isClosed = c.current_stage_snapshot === 'Closed';

    const stageBadge = (s) => {
        const colors = {
            Allocated: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            'In Progress': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            PTP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            Dispute: 'bg-red-500/20 text-red-400 border-red-500/30',
            Escalated: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            Closed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
        return colors[s] || 'bg-surface-700 text-surface-200 border-surface-600';
    };

    const sortedInteractions = [...interactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const computedRecovered60d = c.recovery_date && c.assigned_date
        ? (new Date(c.recovery_date) - new Date(c.assigned_date)) / (1000 * 60 * 60 * 24) <= 60
        : c.recovered_within_60d;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="btn-secondary p-2">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-surface-100">Case {c.case_id}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className={`badge border ${stageBadge(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                        {c.assigned_dca_id && <span className="badge bg-cyan-500/20 text-cyan-400">{c.assigned_dca_id}</span>}
                        <span className="text-xs text-surface-200/50">{c.region} · {c.industry}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                {canManage && (
                    <div className="flex items-center gap-2">
                        {c.current_stage_snapshot === 'Closed' ? (
                            <span className="text-sm font-medium text-surface-200/40 border border-surface-700/50 bg-surface-800/50 px-3 py-1.5 rounded-lg flex items-center gap-2" title="Disabled because case is Closed">
                                Case Closed
                            </span>
                        ) : (
                            <>
                                <button
                                    onClick={handlePredict}
                                    disabled={predicting}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {predicting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                                    {c.ai_scored_at ? 'Refresh Prediction' : 'Predict'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (c.assigned_dca_id) setReassignMode(true);
                                        handleRecommend();
                                    }}
                                    disabled={recommending}
                                    className="btn-success flex items-center gap-2"
                                    title={c.assigned_dca_id && !reassignMode ? "Will trigger reassignment flow" : ""}
                                >
                                    {recommending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                                    {c.assigned_dca_id ? 'Reassign DCA' : 'Recommend DCA'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Case Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Info Card */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-surface-100 mb-4">Case Details</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { label: 'Invoice Amount', value: `$${c.invoice_amount_usd?.toLocaleString()}`, icon: DollarSign },
                                { label: 'Overdue Days', value: c.overdue_days_at_allocation, icon: Clock },
                                { label: 'Customer ID', value: c.customer_id },
                                { label: 'Credit Score', value: c.credit_score_band },
                                { label: 'Open Invoices', value: c.num_open_invoices },
                                { label: 'Previous Defaults', value: c.previous_default_count },
                                { label: 'Recovery Rate (Hist.)', value: `${(c.previous_recovery_rate * 100).toFixed(0)}%` },
                                { label: 'Payment Score', value: c.payment_history_score != null ? Math.min(Math.max(c.payment_history_score, 0), 1000).toFixed(0) : '—' },
                                { label: 'SLA Days', value: c.sla_days },
                                { label: 'Dispute', value: c.dispute_flag ? 'Yes' : 'No' },
                                { label: 'PTP Flag', value: c.promised_to_pay_flag ? 'Yes' : 'No' },
                                { label: 'Recovered', value: c.recovered_flag ? `$${c.recovered_amount_usd?.toLocaleString()}` : 'No' },
                            ].map((item, i) => (
                                <div key={i} className="bg-surface-800/30 rounded-xl p-3">
                                    <p className="text-xs text-surface-200/50">{item.label}</p>
                                    <p className="text-sm font-medium text-surface-100 mt-1">{item.value || '—'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Customer Contact Panel */}
                    {(c.phone || c.email) ? (
                        <div className="glass-card p-6 border-l-4 border-l-blue-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-blue-400" />
                                    <h2 className="text-lg font-semibold text-surface-100">Customer Contact</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`Name: ${c.contact_person_name || 'N/A'}\nPhone: ${c.phone || 'N/A'}\nEmail: ${c.email || 'N/A'}`);
                                            toast.success("Contact details copied!");
                                        }}
                                        className="btn-secondary py-1 px-3 text-sm flex items-center gap-1"
                                    >
                                        <Copy className="w-4 h-4" /> Copy Details
                                    </button>
                                    {canManage && c.current_stage_snapshot !== 'Closed' && (
                                        <button
                                            onClick={openContactEditor}
                                            className="btn-secondary py-1 px-3 text-sm flex items-center gap-1"
                                        >
                                            <Edit3 className="w-4 h-4" /> Edit Contact
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-surface-200/50">Contact Person</p>
                                    <p className="text-sm text-surface-100 font-medium">{c.contact_person_name || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-surface-200/50">Company Name</p>
                                    <p className="text-sm text-surface-100 font-medium">{c.company_name || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-surface-200/50">Primary Phone</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-surface-100 font-medium">{c.phone || '—'}</p>
                                        {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="text-blue-400 hover:text-blue-300"><Phone className="w-4 h-4" /></a>}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-surface-200/50">Email Address</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-surface-100 font-medium">{c.email || '—'}</p>
                                        {c.email && <a href={`mailto:${c.email}?subject=Regarding SmartDCA Case ${c.case_id}`} className="text-blue-400 hover:text-blue-300"><Mail className="w-4 h-4" /></a>}
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <p className="text-xs text-surface-200/50">Mailing Address</p>
                                    <p className="text-sm text-surface-200/80 whitespace-pre-wrap">{c.address || '—'}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card p-6 border-l-4 border-l-surface-600 bg-surface-800/20 text-center">
                            <User className="w-8 h-8 text-surface-200/30 mx-auto mb-2" />
                            <p className="text-surface-200/60 font-medium">No Customer Contact Info Available</p>
                            <p className="text-xs text-surface-200/40 mt-1">
                                {c.current_stage_snapshot === 'Closed'
                                    ? 'Case is closed; contact details are optional'
                                    : 'Assignment is blocked until Phone or Email is added'}
                            </p>
                            {canManage && c.current_stage_snapshot !== 'Closed' && (
                                <button onClick={openContactEditor} className="btn-primary mt-4 inline-flex items-center gap-1 text-sm">
                                    <Edit3 className="w-4 h-4" /> Add Contact Info
                                </button>
                            )}
                        </div>
                    )}

                    {editingContact && canManage && c.current_stage_snapshot !== 'Closed' && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="w-full max-w-3xl bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
                                    <h3 className="text-base font-semibold text-surface-100">Edit Customer Contact</h3>
                                    <button
                                        onClick={() => setEditingContact(false)}
                                        className="btn-secondary py-1 px-2"
                                        title="Close"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <form onSubmit={handleSaveContact} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={contactForm.contact_person_name}
                                        onChange={(e) => setContactForm({ ...contactForm, contact_person_name: e.target.value })}
                                        className="input-field"
                                        placeholder="Contact person"
                                    />
                                    <input
                                        type="text"
                                        value={contactForm.company_name}
                                        onChange={(e) => setContactForm({ ...contactForm, company_name: e.target.value })}
                                        className="input-field"
                                        placeholder="Company name"
                                    />
                                    <input
                                        type="tel"
                                        value={contactForm.phone}
                                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                                        className="input-field"
                                        placeholder="Primary phone"
                                    />
                                    <input
                                        type="tel"
                                        value={contactForm.alternate_phone}
                                        onChange={(e) => setContactForm({ ...contactForm, alternate_phone: e.target.value })}
                                        className="input-field"
                                        placeholder="Alternate phone"
                                    />
                                    <input
                                        type="email"
                                        value={contactForm.email}
                                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                        className="input-field"
                                        placeholder="Email"
                                    />
                                    <input
                                        type="text"
                                        value={contactForm.timezone}
                                        onChange={(e) => setContactForm({ ...contactForm, timezone: e.target.value })}
                                        className="input-field"
                                        placeholder="Timezone"
                                    />
                                    <select
                                        value={contactForm.preferred_contact_channel}
                                        onChange={(e) => setContactForm({ ...contactForm, preferred_contact_channel: e.target.value })}
                                        className="input-field"
                                    >
                                        <option>Email</option>
                                        <option>Phone</option>
                                        <option>SMS</option>
                                        <option>Portal</option>
                                    </select>
                                    <div className="hidden md:block" />
                                    <textarea
                                        value={contactForm.address}
                                        onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                                        className="input-field md:col-span-2 min-h-[90px]"
                                        placeholder="Mailing address"
                                    />
                                    <div className="md:col-span-2 flex items-center justify-end gap-2 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditingContact(false)}
                                            className="btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingContact}
                                            className="btn-primary"
                                        >
                                            {savingContact ? 'Saving...' : 'Save Contact'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* AI Predictions */}
                    {c.ai_prob_60d != null && (
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Brain className="w-5 h-5 text-purple-400" />
                                <h2 className="text-lg font-semibold text-surface-100">AI Predictions</h2>
                                <span className="text-xs text-surface-200/40 ml-auto">
                                    Scored: {c.ai_scored_at ? new Date(c.ai_scored_at).toLocaleString() : '—'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                                    <Target className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                    <p className="text-xs text-surface-200/50">60-Day Recovery Prob</p>
                                    <p className="text-2xl font-bold text-blue-400 mt-1">{(c.ai_prob_60d * 100).toFixed(1)}%</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                                    <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                                    <p className="text-xs text-surface-200/50">Expected Amount</p>
                                    <p className="text-2xl font-bold text-emerald-400 mt-1">${c.ai_exp_amt?.toLocaleString()}</p>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                                    <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                                    <p className="text-xs text-surface-200/50">Expected Days</p>
                                    <p className="text-2xl font-bold text-amber-400 mt-1">{c.ai_exp_days?.toFixed(1)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DCA Recommendations */}
                    {recommendations && (
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="w-5 h-5 text-amber-400" />
                                <h2 className="text-lg font-semibold text-surface-100">DCA Recommendations</h2>
                                <span className="badge bg-emerald-500/20 text-emerald-400 ml-2">
                                    Best: {recommendations.best_dca}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {recommendations.recommendations.map((rec, i) => (
                                    <div key={rec.dca_id} className={`rounded-xl p-4 border transition-all ${i === 0
                                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-emerald-500/30'
                                        : 'bg-surface-800/30 border-surface-700/50'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-700 text-surface-200/70'
                                                    }`}>
                                                    #{i + 1}
                                                </div>
                                                <div>
                                                    <p className="text-surface-100 font-semibold">{rec.dca_id}</p>
                                                    <p className="text-xs text-surface-200/50">
                                                        Score: {rec.final_score} · Prob: {(rec.prob_60d * 100).toFixed(1)}% · Amt: ${rec.exp_amt?.toLocaleString()} · Days: {rec.exp_days?.toFixed(1)}
                                                    </p>
                                                </div>
                                            </div>
                                            {canManage && c.current_stage_snapshot !== 'Closed' && (
                                                <div className="flex items-center">
                                                    {(!c.assigned_dca_id || reassignMode) ? (
                                                        <button
                                                            onClick={() => handleAssign(rec.dca_id)}
                                                            disabled={assigning}
                                                            className={`${i === 0 ? 'btn-success' : 'btn-secondary'} text-sm whitespace-nowrap`}
                                                        >
                                                            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1 inline" />}
                                                            Assign {i === 0 && 'Best'}
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className="text-xs bg-surface-800 text-surface-200/40 px-3 py-1.5 rounded-lg border border-surface-700/50"
                                                            title="Disabled because already assigned"
                                                        >
                                                            Already assigned to {c.assigned_dca_id}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-surface-200/40 mt-2">{rec.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Interactions Timeline */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-400" />
                                <h2 className="text-lg font-semibold text-surface-100">Interaction Timeline</h2>
                                <span className="text-xs text-surface-200/40">({interactions.length})</span>
                            </div>
                            {!isClosed ? (
                                <button
                                    onClick={() => setShowAddInteraction(!showAddInteraction)}
                                    className="btn-secondary flex items-center gap-1 text-sm"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            ) : (
                                <span className="text-xs bg-surface-800 text-surface-200/40 px-3 py-1.5 rounded-lg border border-surface-700/50">
                                    Closed case: read-only timeline
                                </span>
                            )}
                        </div>

                        {/* Add interaction form */}
                        {showAddInteraction && !isClosed && (
                            <form onSubmit={handleAddInteraction} className="mb-6 bg-surface-800/50 rounded-xl p-4 space-y-3 border border-surface-700/50">
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={newInteraction.event_type}
                                        onChange={(e) => setNewInteraction({ ...newInteraction, event_type: e.target.value })}
                                        className="input-field"
                                    >
                                        {['Note Added', 'Call Attempted', 'Call Completed', 'Email Sent', 'Payment Received', 'Promise to Pay', 'Dispute Raised', 'Escalation'].map((t) => (
                                            <option key={t}>{t}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={newInteraction.channel}
                                        onChange={(e) => setNewInteraction({ ...newInteraction, channel: e.target.value })}
                                        className="input-field"
                                    >
                                        {['Portal', 'Phone', 'Email', 'In-person', 'SMS'].map((ch) => (
                                            <option key={ch}>{ch}</option>
                                        ))}
                                    </select>
                                </div>
                                {isDcaUser && (
                                    <div className="md:col-span-2 space-y-3">
                                        <select
                                            value={newInteraction.stage}
                                            onChange={(e) => setNewInteraction({ ...newInteraction, stage: e.target.value })}
                                            className="input-field w-full"
                                        >
                                            <option value="">— Keep Current Stage —</option>
                                            {['In Progress', 'PTP', 'Dispute', 'Escalated', 'Closed'].map((s) => (
                                                <option key={s}>{s}</option>
                                            ))}
                                        </select>

                                        {(newInteraction.stage === 'Closed' || newInteraction.event_type === 'Payment Received') && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <select
                                                    value={newInteraction.outcome}
                                                    onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value })}
                                                    className="input-field"
                                                >
                                                    <option value="">— Select Outcome —</option>
                                                    {['Paid in Full', 'Settled', 'Uncollectible', 'Bankrupt', 'Fraud', 'Other'].map((s) => (
                                                        <option key={s}>{s}</option>
                                                    ))}
                                                </select>
                                                {newInteraction.stage === 'Closed' && (
                                                    <input
                                                        type="text"
                                                        value={newInteraction.close_reason}
                                                        onChange={(e) => setNewInteraction({ ...newInteraction, close_reason: e.target.value })}
                                                        placeholder="Closure reason..."
                                                        className="input-field"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <textarea
                                    value={newInteraction.notes}
                                    onChange={(e) => setNewInteraction({ ...newInteraction, notes: e.target.value })}
                                    className="input-field"
                                    rows={3}
                                    placeholder="Interaction notes..."
                                    required
                                />
                                <button type="submit" className="btn-primary flex items-center gap-2">
                                    <Send className="w-4 h-4" /> Submit
                                </button>
                            </form>
                        )}

                        {/* Timeline */}
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {sortedInteractions.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-surface-200/50 mb-3">No interactions yet</p>
                                    {!isClosed && (
                                        <button onClick={() => setShowAddInteraction(true)} className="btn-secondary text-xs px-3 py-1">
                                            Add First Interaction
                                        </button>
                                    )}
                                </div>
                            ) : (
                                sortedInteractions.map((int, i) => (
                                    <div key={int.interaction_id || i} className="flex gap-4 px-4 py-3 bg-surface-800/20 rounded-xl hover:bg-surface-800/40 transition-colors">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full mt-1 ${int.event_type === 'Payment Received' ? 'bg-emerald-400' :
                                                int.event_type === 'Dispute Raised' ? 'bg-red-400' :
                                                    int.event_type === 'Escalation' ? 'bg-orange-400' :
                                                        'bg-blue-400'
                                                }`} />
                                            {i < sortedInteractions.length - 1 && <div className="w-px flex-1 bg-surface-700/50 mt-1" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-surface-100">{int.event_type}</span>
                                                <span className="badge bg-surface-700 text-surface-200/70">{int.channel}</span>
                                                {int.outcome && <span className="badge bg-purple-500/20 text-purple-400">Outcome: {int.outcome}</span>}
                                                <span className="text-xs text-surface-200/40">{int.actor}</span>
                                            </div>
                                            {int.notes && <p className="text-sm text-surface-200/60 mt-1">{int.notes}</p>}
                                            <p className="text-xs text-surface-200/30 mt-1">
                                                {int.timestamp ? new Date(int.timestamp).toLocaleString() : ''}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right sidebar summary */}
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold text-surface-200/50 uppercase tracking-wider mb-4">Quick Info</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-surface-200/40">Invoice</p>
                                <p className="text-xl font-bold text-surface-100">${c.invoice_amount_usd?.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-200/40">Assigned DCA</p>
                                <p className="text-lg font-semibold text-cyan-400">{c.assigned_dca_id || 'Unassigned'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-200/40">Stage</p>
                                <span className={`badge border ${stageBadge(c.current_stage_snapshot)}`}>{c.current_stage_snapshot}</span>
                            </div>
                            <div>
                                <p className="text-xs text-surface-200/40">SLA Due</p>
                                {c.current_stage_snapshot === 'Closed' ? (
                                    <p className={`text-sm ${c.sla_due_date && c.recovery_date ? (new Date(c.recovery_date) <= new Date(c.sla_due_date) ? 'text-emerald-400' : 'text-red-400') : 'text-surface-200/70'}`}>
                                        {c.sla_due_date && c.recovery_date
                                            ? new Date(c.recovery_date) <= new Date(c.sla_due_date)
                                                ? 'SLA Met'
                                                : 'SLA Violated'
                                            : '—'}
                                    </p>
                                ) : (
                                    <p className="text-sm text-surface-200/70">{c.sla_due_date ? new Date(c.sla_due_date).toLocaleDateString() : '—'}</p>
                                )}
                            </div>
                            {c.recovery_date && (
                                <div>
                                    <p className="text-xs text-surface-200/40">Recovery Date</p>
                                    <p className="text-sm text-emerald-400">{new Date(c.recovery_date).toLocaleDateString()}</p>
                                </div>
                            )}
                            {c.current_stage_snapshot === 'Closed' && c.close_reason && (
                                <div className="pt-2 border-t border-surface-700/50">
                                    <p className="text-xs text-surface-200/40">Closure Reason</p>
                                    <p className="text-sm text-surface-100">{c.close_reason}</p>
                                    <p className="text-xs text-surface-200/50 mt-1">by {c.closed_by || 'System'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Flags */}
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold text-surface-200/50 uppercase tracking-wider mb-4">Flags</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Recovered', value: c.recovered_flag, positive: true },
                                { label: 'Recovered 60d', value: computedRecovered60d, positive: true },
                                { label: 'Dispute', value: c.dispute_flag, positive: false },
                                { label: 'PTP', value: c.promised_to_pay_flag, positive: true },
                                { label: 'Escalation', value: c.escalation_flag, positive: false },
                            ].map((f, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm text-surface-200/60">{f.label}</span>
                                    <span className={`badge ${f.value ? (f.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400') : 'bg-surface-700 text-surface-200/40'}`}>
                                        {f.value ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showPredictionModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(2,6,23,0.55)]">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900">Predicted Score</h3>
                            <p className="text-slate-600 mt-2">
                                Predicted score is <span className="text-blue-600 font-semibold">{predictedScore}%</span> recovery probability.
                            </p>
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowPredictionModal(false)}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {showRecommendModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(2,6,23,0.55)]">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-slate-900">Top DCA Recommendation</h3>
                            <p className="text-slate-600 mt-2">
                                Top DCA is <span className="text-blue-600 font-semibold">{topRecommendedDca}</span>.
                            </p>
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowRecommendModal(false)}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
