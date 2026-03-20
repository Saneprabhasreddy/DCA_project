import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import {
    Shield,
    Loader2,
    Building2,
    X,
} from 'lucide-react';

const REGION_OPTIONS = [
    { code: 'EMEA', label: 'Europe, the Middle East and Africa (EMEA)' },
    { code: 'NA', label: 'North America (NA)' },
    { code: 'LATAM', label: 'Latin America (LATAM)' },
    { code: 'APAC', label: 'Asia-Pacific (APAC)' },
];

export default function DcaManagementPage() {
    const { isDark } = useTheme();
    const [dcas, setDcas] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreateDca, setShowCreateDca] = useState(false);
    const [showCreateManager, setShowCreateManager] = useState(false);

    const [editingDca, setEditingDca] = useState(null);
    const [editingManager, setEditingManager] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [newDca, setNewDca] = useState({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '', dca_password: '' });
    const [newManager, setNewManager] = useState({ username: '', password: '' });

    const [deletingDcaId, setDeletingDcaId] = useState(null);
    const [deletingManagerId, setDeletingManagerId] = useState(null);

    const fetchData = async () => {
        try {
            const [dcaRes, managerRes] = await Promise.all([
                api.get('/admin/dcas'),
                api.get('/admin/managers'),
            ]);
            setDcas(dcaRes.data);
            setManagers(managerRes.data);
        } catch (err) {
            toast.error('Failed to load management data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdateDca = async (e) => {
        e.preventDefault();
        if (!editingDca) return;

        const dcaPayload = {
            dca_name: editingDca.dca_name,
            region_coverage: editingDca.region_coverage || '',
            contact_email: editingDca.contact_email || '',
        };
        const nextPassword = (editingDca.dca_password || '').trim();
        if (nextPassword && nextPassword.length !== 6) {
            toast.error('DCA password must be exactly 6 characters');
            return;
        }

        try {
            await api.patch(`/admin/dcas/${editingDca.dca_id}`, dcaPayload);

            if (nextPassword) {
                const usersRes = await api.get('/admin/dca-users', { params: { dca_id: editingDca.dca_id } });
                const dcaUsers = usersRes.data || [];

                if (!dcaUsers.length) {
                    toast.error(`DCA details updated, but no DCA user account found for ${editingDca.dca_id}`);
                } else {
                    await Promise.all(
                        dcaUsers.map((u) => api.patch(`/admin/dca-users/${u._id}`, { password: nextPassword }))
                    );
                    toast.success(`Updated ${editingDca.dca_id} and changed password for ${dcaUsers.length} DCA user(s)`);
                }
            } else {
                toast.success(`Updated ${editingDca.dca_id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update DCA');
        } finally {
            setEditingDca(null);
            fetchData();
        }
    };

    const handleUpdateManager = async (e) => {
        e.preventDefault();
        if (!editingManager) return;

        try {
            await api.patch(`/admin/managers/${editingManager._id}`, editingManager);
            toast.success(`Updated manager ${editingManager.username}`);
            setEditingManager(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update manager');
        }
    };

    const handleCreateDca = async (e) => {
        e.preventDefault();
        const nextPassword = (newDca.dca_password || '').trim();
        if (nextPassword.length !== 6) {
            toast.error('DCA password must be exactly 6 characters');
            return;
        }
        try {
            const payload = {
                dca_id: newDca.dca_id,
                dca_name: newDca.dca_name,
                region_coverage: newDca.region_coverage,
                contact_email: newDca.contact_email,
                dca_password: nextPassword,
            };
            const res = await api.post('/admin/dcas', payload);
            const createdUsername = res.data?.dca_user_credentials?.username;
            if (createdUsername) {
                toast.success(`DCA organization created. Login username: ${createdUsername}`);
            } else {
                toast.success('DCA organization created');
            }
            setShowCreateDca(false);
            setNewDca({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '', dca_password: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create DCA');
        }
    };

    const handleCreateManager = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/managers', newManager);
            toast.success('Manager created');
            setShowCreateManager(false);
            setNewManager({ username: '', password: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create manager');
        }
    };

    const handleDeleteDca = async (dca) => {
        setDeletingDcaId(dca.dca_id);
        try {
            await api.delete(`/admin/dcas/${dca.dca_id}`);
            toast.success(`Deleted ${dca.dca_id}`);
            if (editingDca?.dca_id === dca.dca_id) setEditingDca(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete DCA');
        } finally {
            setDeletingDcaId(null);
        }
    };

    const handleDeleteManager = async (manager) => {
        setDeletingManagerId(manager._id);
        try {
            await api.delete(`/admin/managers/${manager._id}`);
            toast.success(`Deleted ${manager.username}`);
            if (editingManager?._id === manager._id) setEditingManager(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete manager');
        } finally {
            setDeletingManagerId(null);
        }
    };

    const primaryActionBtnClass = 'text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors';
    const dangerActionBtnClass = 'text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors';
    const tableHeadRowClass = isDark ? 'border-b border-surface-700/50' : 'border-b border-slate-300';
    const tableHeadCellClass = isDark
        ? 'text-left px-4 py-3 text-xs font-semibold text-surface-200/50 uppercase tracking-wider'
        : 'text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider';
    const tableRowClass = isDark
        ? 'border-b border-surface-700/30 hover:bg-surface-800/30 transition-colors'
        : 'border-b border-slate-200 hover:bg-blue-50/80 transition-colors';
    const secondaryCellClass = isDark ? 'px-4 py-3 text-surface-200/80' : 'px-4 py-3 text-slate-600';
    const activeBadgeClass = isDark
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    const inactiveBadgeClass = isDark
        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
        : 'bg-red-100 text-red-700 border border-red-200';
    const managerRoleBadgeClass = isDark
        ? 'badge bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase'
        : 'badge bg-blue-100 text-blue-700 border border-blue-200 uppercase';
    const openDeleteDcaConfirm = (dca) => {
        setDeleteTarget({
            type: 'dca',
            message: `Delete DCA "${dca.dca_id}"? This cannot be undone.`,
            payload: dca,
        });
    };
    const openDeleteManagerConfirm = (manager) => {
        setDeleteTarget({
            type: 'manager',
            message: `Delete manager "${manager.username}"? This cannot be undone.`,
            payload: manager,
        });
    };
    const isDeleteConfirmBusy = deleteTarget?.type === 'dca'
        ? deletingDcaId === deleteTarget?.payload?.dca_id
        : deletingManagerId === deleteTarget?.payload?._id;
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.type === 'dca') {
            await handleDeleteDca(deleteTarget.payload);
        } else {
            await handleDeleteManager(deleteTarget.payload);
        }
        setDeleteTarget(null);
    };
    const formatLastSeen = (lastLoginAt) => {
        if (!lastLoginAt) return 'Never';
        return new Date(lastLoginAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-bold text-surface-100">DCA & Manager Management</h1>
                <p className="text-sm text-surface-200/60 mt-1">
                    Cases are assigned directly to DCA organizations. Separate DCA user accounts are hidden.
                </p>
            </div>

            <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-surface-100">DCA Organizations</h2>
                        <span className="text-xs text-surface-200/40">({dcas.length})</span>
                    </div>
                    <button onClick={() => setShowCreateDca(true)} className="btn-primary text-sm">
                        Create DCA Organization
                    </button>
                </div>
                <p className="text-xs text-surface-200/50 mb-4">Create and maintain DCA profiles with clear status controls.</p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={tableHeadRowClass}>
                                {['DCA ID', 'Name', 'Region', 'Email', 'Active', 'Actions'].map((h) => (
                                    <th key={h} className={tableHeadCellClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dcas.map((d) => (
                                <tr key={d.dca_id} className={tableRowClass}>
                                    <td className="px-4 py-3 text-surface-100 font-medium">{d.dca_id}</td>
                                    <td className="px-4 py-3 text-surface-100">{d.dca_name || '-'}</td>
                                    <td className={secondaryCellClass}>{d.region_coverage || '-'}</td>
                                    <td className={`${secondaryCellClass} break-all`}>{d.contact_email || '-'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`badge ${d.is_active ? activeBadgeClass : inactiveBadgeClass}`}>
                                            {d.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => setEditingDca({ ...d, dca_password: '' })}
                                                className={primaryActionBtnClass}
                                                title="Edit DCA"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => openDeleteDcaConfirm(d)}
                                                disabled={deletingDcaId === d.dca_id}
                                                className={`${dangerActionBtnClass} disabled:opacity-50`}
                                                title="Delete DCA"
                                            >
                                                {deletingDcaId === d.dca_id ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-semibold text-surface-100">User Management</h2>
                        <span className="text-xs text-surface-200/40">({managers.length})</span>
                    </div>
                    <button onClick={() => setShowCreateManager(true)} className="btn-primary text-sm">
                        Add User
                    </button>
                </div>
                <p className="text-xs text-surface-200/50 mb-4">Add username and password, then edit or delete users as needed.</p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={tableHeadRowClass}>
                                {['Username', 'Role', 'Active', 'Last Seen', 'Actions'].map((h) => (
                                    <th key={h} className={tableHeadCellClass}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {managers.map((m) => (
                                <tr key={m._id} className={tableRowClass}>
                                    <td className="px-4 py-3 text-surface-100 font-medium">{m.username}</td>
                                    <td className="px-4 py-3">
                                        <span className={managerRoleBadgeClass}>
                                            {m.role || 'manager'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`badge ${m.is_active ? activeBadgeClass : inactiveBadgeClass}`}>
                                            {m.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className={secondaryCellClass}>{formatLastSeen(m.last_login_at)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => setEditingManager({ ...m, password: '' })}
                                                className={primaryActionBtnClass}
                                                title="Edit Manager"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => openDeleteManagerConfirm(m)}
                                                disabled={deletingManagerId === m._id}
                                                className={`${dangerActionBtnClass} disabled:opacity-50`}
                                                title="Delete Manager"
                                            >
                                                {deletingManagerId === m._id ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {deleteTarget && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                        <div className="px-6 py-4 border-b border-surface-700/60">
                            <h3 className="text-lg font-semibold text-surface-100">Confirm Delete</h3>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-surface-200/80">{deleteTarget.message}</p>
                            <div className="mt-6 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={isDeleteConfirmBusy}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleteConfirmBusy}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                                >
                                    {isDeleteConfirmBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {editingDca && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl my-8 max-h-[92vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
                            <h3 className="text-xl font-semibold text-surface-100">Edit DCA Organization</h3>
                            <button onClick={() => setEditingDca(null)} className="btn-secondary p-2" title="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateDca} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA ID</label>
                                <input value={editingDca.dca_id} className="input-field opacity-70" disabled />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA Name</label>
                                <input
                                    value={editingDca.dca_name || ''}
                                    onChange={(e) => setEditingDca({ ...editingDca, dca_name: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Region Coverage</label>
                                <select
                                    value={editingDca.region_coverage || ''}
                                    onChange={(e) => setEditingDca({ ...editingDca, region_coverage: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">Select region</option>
                                    {REGION_OPTIONS.map((region) => (
                                        <option key={region.code} value={region.code}>{region.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Contact Email</label>
                                <input
                                    value={editingDca.contact_email || ''}
                                    onChange={(e) => setEditingDca({ ...editingDca, contact_email: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA Password (optional)</label>
                                <input
                                    type="password"
                                    value={editingDca.dca_password || ''}
                                    onChange={(e) => setEditingDca({ ...editingDca, dca_password: e.target.value.slice(0, 6) })}
                                    placeholder="Enter new password for DCA login"
                                    className="input-field"
                                    maxLength={6}
                                />
                                <p className="text-[11px] text-surface-200/50">Exactly 6 characters. If this DCA has multiple user accounts, password will be updated for all of them.</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setEditingDca(null)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {showCreateDca && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl my-8 max-h-[92vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
                            <h3 className="text-xl font-semibold text-surface-100">Create DCA Organization</h3>
                            <button
                                onClick={() => {
                                    setShowCreateDca(false);
                                    setNewDca({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '', dca_password: '' });
                                }}
                                className="btn-secondary p-2"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateDca} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA ID</label>
                                <input
                                    value={newDca.dca_id}
                                    onChange={(e) => setNewDca({ ...newDca, dca_id: e.target.value })}
                                    placeholder="DCA-11"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA Name</label>
                                <input
                                    value={newDca.dca_name}
                                    onChange={(e) => setNewDca({ ...newDca, dca_name: e.target.value })}
                                    placeholder="Agency name"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Region Coverage</label>
                                <select
                                    value={newDca.region_coverage}
                                    onChange={(e) => setNewDca({ ...newDca, region_coverage: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">Select region</option>
                                    {REGION_OPTIONS.map((region) => (
                                        <option key={region.code} value={region.code}>{region.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Contact Email</label>
                                <input
                                    value={newDca.contact_email}
                                    onChange={(e) => setNewDca({ ...newDca, contact_email: e.target.value })}
                                    placeholder="ops@agency.com"
                                    className="input-field"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA Login Password</label>
                                <input
                                    type="password"
                                    value={newDca.dca_password}
                                    onChange={(e) => setNewDca({ ...newDca, dca_password: e.target.value })}
                                    placeholder="Enter 6-character password"
                                    className="input-field"
                                    minLength={6}
                                    maxLength={6}
                                    required
                                />
                                <p className="text-[11px] text-surface-200/50">Exactly 6 characters. This password is used for DCA login.</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateDca(false);
                                        setNewDca({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '', dca_password: '' });
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">Create DCA</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {showCreateManager && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl my-8 max-h-[92vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
                            <h3 className="text-xl font-semibold text-surface-100">Add User</h3>
                            <button
                                onClick={() => {
                                    setShowCreateManager(false);
                                    setNewManager({ username: '', password: '' });
                                }}
                                className="btn-secondary p-2"
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateManager} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Username</label>
                                <input
                                    value={newManager.username}
                                    onChange={(e) => setNewManager({ ...newManager, username: e.target.value })}
                                    placeholder="manager username"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Password</label>
                                <input
                                    type="password"
                                    value={newManager.password}
                                    onChange={(e) => setNewManager({ ...newManager, password: e.target.value })}
                                    placeholder="Enter password"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateManager(false);
                                        setNewManager({ username: '', password: '' });
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {editingManager && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl my-8 max-h-[92vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60">
                            <h3 className="text-xl font-semibold text-surface-100">Edit User</h3>
                            <button onClick={() => setEditingManager(null)} className="btn-secondary p-2" title="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateManager} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Username</label>
                                <input
                                    value={editingManager.username}
                                    onChange={(e) => setEditingManager({ ...editingManager, username: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Password (optional)</label>
                                <input
                                    type="password"
                                    value={editingManager.password || ''}
                                    onChange={(e) => setEditingManager({ ...editingManager, password: e.target.value })}
                                    placeholder="Leave blank to keep current"
                                    className="input-field"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setEditingManager(null)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
