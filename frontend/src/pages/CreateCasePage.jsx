import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, Building, User, Mail, Phone, DollarSign, Target, FileText, AlertCircle, MapPin, Globe } from 'lucide-react';

export default function CreateCasePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Default state aligning with the new Case schema
    const [formData, setFormData] = useState({
        // Customer Info (Mandatory)
        customer_id: '',
        company_name: '',
        contact_person_name: '',
        phone: '',
        alternate_phone: '',
        email: '',
        address: '',
        preferred_contact_channel: 'Email',
        timezone: 'UTC',

        // Case Basics
        region: 'NA',
        industry: 'Retail',
        invoice_amount_usd: '',
        num_open_invoices: 1,
        overdue_days_at_allocation: 0,
        sla_days: 14,

        // Risk Signals
        previous_default_count: 0,
        previous_recovery_rate: 0, // as percentage 0-100 logically, will be divided by 100 on submit or kept as float
        payment_history_score: 500,
        credit_score_band: 'Medium',

        // Flags
        dispute_flag: 0,
        promised_to_pay_flag: 0,

        // Optional Info
        notes: '',
        model_collectability_bucket_hint: ''
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (parseFloat(formData.invoice_amount_usd) <= 0) {
            return toast.error("Invoice amount must be greater than 0");
        }
        if (parseInt(formData.overdue_days_at_allocation) < 0) {
            return toast.error("Overdue days cannot be negative");
        }
        if (!formData.email.match(/^\S+@\S+\.\S+$/)) {
            return toast.error("Please enter a valid email address");
        }

        setLoading(true);
        try {
            // Transform types before sending
            const payload = {
                ...formData,
                invoice_amount_usd: parseFloat(formData.invoice_amount_usd),
                num_open_invoices: parseInt(formData.num_open_invoices),
                overdue_days_at_allocation: parseInt(formData.overdue_days_at_allocation),
                sla_days: parseInt(formData.sla_days),
                previous_default_count: parseInt(formData.previous_default_count),
                previous_recovery_rate: parseFloat(formData.previous_recovery_rate) / 100, // Make it 0-1 if input is %
                payment_history_score: parseFloat(formData.payment_history_score),
            };

            const res = await api.post('/cases', payload);
            toast.success(`Case ${res.data.case_id} created successfully`);
            navigate(`/cases/${res.data.case_id}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create case');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up max-w-4xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="btn-secondary p-2">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-surface-100">Create New Case</h1>
                    <p className="text-sm text-surface-200/50 mt-1">Add a new debt recovery case manually into the system.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* 1. Customer Information */}
                <div className="glass-card p-6 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-700/50 pb-3">
                        <User className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-surface-100">Customer Information <span className="text-red-400 text-sm ml-1">* Mandatory</span></h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Customer ID</label>
                            <input type="text" name="customer_id" required value={formData.customer_id} onChange={handleChange} className="input-field" placeholder="CUST-1001" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Company Name</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                                <input type="text" name="company_name" required value={formData.company_name} onChange={handleChange} className="input-field input-field-icon-left" placeholder="Acme Corp" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Contact Person</label>
                            <input type="text" name="contact_person_name" required value={formData.contact_person_name} onChange={handleChange} className="input-field" placeholder="Jane Doe" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="input-field input-field-icon-left" placeholder="jane@acme.com" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Primary Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="input-field input-field-icon-left" placeholder="+1 (555) 123-4567" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Alternate Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                                <input type="tel" name="alternate_phone" value={formData.alternate_phone} onChange={handleChange} className="input-field input-field-icon-left" placeholder="(Optional)" />
                            </div>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Mailing Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 w-4 h-4 text-surface-200/50" />
                                <textarea name="address" required value={formData.address} onChange={handleChange} className="input-field input-field-icon-left min-h-[80px]" placeholder="123 Business Rd, Suite 100&#10;City, State, ZIP" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Pref. Contact Channel</label>
                            <select name="preferred_contact_channel" value={formData.preferred_contact_channel} onChange={handleChange} className="input-field">
                                <option>Email</option>
                                <option>Phone</option>
                                <option>SMS</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Timezone</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/50" />
                                <input type="text" name="timezone" required value={formData.timezone} onChange={handleChange} className="input-field input-field-icon-left" placeholder="UTC or EST, etc." />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Case Basics */}
                <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-700/50 pb-3">
                        <FileText className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-lg font-semibold text-surface-100">Case Basics</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Invoice Amount (USD)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/50" />
                                <input type="number" step="0.01" min="0" name="invoice_amount_usd" required value={formData.invoice_amount_usd} onChange={handleChange} className="input-field input-field-icon-left font-medium" placeholder="0.00" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Overdue Days</label>
                            <input type="number" min="0" name="overdue_days_at_allocation" required value={formData.overdue_days_at_allocation} onChange={handleChange} className="input-field" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Open Invoices Count</label>
                            <input type="number" min="1" name="num_open_invoices" required value={formData.num_open_invoices} onChange={handleChange} className="input-field" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">SLA Target (Days)</label>
                            <input type="number" min="1" name="sla_days" required value={formData.sla_days} onChange={handleChange} className="input-field" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Region</label>
                            <select name="region" value={formData.region} onChange={handleChange} className="input-field">
                                <option>NA</option>
                                <option>EMEA</option>
                                <option>APAC</option>
                                <option>LATAM</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Industry</label>
                            <input type="text" name="industry" required value={formData.industry} onChange={handleChange} className="input-field" placeholder="e.g. Retail, Healthcare" />
                        </div>
                    </div>
                </div>

                {/* 3. Risk Signals & Flags */}
                <div className="glass-card p-6 border-l-4 border-l-amber-500">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-700/50 pb-3">
                        <Target className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-semibold text-surface-100">Risk Signals & Flags</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Payment Score (0-1000)</label>
                            <input type="number" min="0" max="1000" name="payment_history_score" value={formData.payment_history_score} onChange={handleChange} className="input-field" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Credit Band</label>
                            <select name="credit_score_band" value={formData.credit_score_band} onChange={handleChange} className="input-field">
                                <option>High</option>
                                <option>Medium</option>
                                <option>Low</option>
                                <option>Unknown</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Prev. Defaults</label>
                            <input type="number" min="0" name="previous_default_count" value={formData.previous_default_count} onChange={handleChange} className="input-field" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-surface-200/50 uppercase tracking-wider">Hist. Recovery Rate %</label>
                            <input type="number" min="0" max="100" step="1" name="previous_recovery_rate" value={formData.previous_recovery_rate} onChange={handleChange} className="input-field" />
                        </div>
                    </div>

                    <div className="flex items-center gap-8 bg-surface-800/50 p-4 rounded-xl border border-surface-700/50">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" name="dispute_flag" checked={formData.dispute_flag === 1} onChange={handleChange} className="w-5 h-5 rounded border-surface-600 bg-surface-900 text-red-500 focus:ring-red-500/50 focus:ring-offset-surface-900 cursor-pointer" />
                            <div className="flex items-center gap-2">
                                <AlertCircle className={`w-4 h-4 ${formData.dispute_flag ? 'text-red-400' : 'text-surface-200/50'}`} />
                                <span className="text-sm font-medium text-surface-200/90 group-hover:text-surface-100 transition-colors">Has Active Dispute</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" name="promised_to_pay_flag" checked={formData.promised_to_pay_flag === 1} onChange={handleChange} className="w-5 h-5 rounded border-surface-600 bg-surface-900 text-purple-500 focus:ring-purple-500/50 focus:ring-offset-surface-900 cursor-pointer" />
                            <div className="flex items-center gap-2">
                                <Target className={`w-4 h-4 ${formData.promised_to_pay_flag ? 'text-purple-400' : 'text-surface-200/50'}`} />
                                <span className="text-sm font-medium text-surface-200/90 group-hover:text-surface-100 transition-colors">Has Active PTP</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 border-t border-surface-700/50 pt-6">
                    <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary px-8 flex items-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {loading ? 'Creating...' : 'Create Case'}
                    </button>
                </div>
            </form>
        </div>
    );
}
