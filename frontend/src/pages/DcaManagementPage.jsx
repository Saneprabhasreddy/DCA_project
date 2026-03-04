import { Fragment, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
    Users,
    Plus,
    RotateCcw,
    Shield,
    ShieldOff,
    Loader2,
    Copy,
    Building2,
    Edit,
} from 'lucide-react';

export default function DcaManagementPage() {
    const [dcas, setDcas] = useState([]);
    const [dcaUsers, setDcaUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreateDca, setShowCreateDca] = useState(false);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showCreateManager, setShowCreateManager] = useState(false);

    const [editingDca, setEditingDca] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [editingManager, setEditingManager] = useState(null);

    const [newDca, setNewDca] = useState({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '' });
    const [newUser, setNewUser] = useState({ username: '', password: '', dca_id: '' });
    const [newManager, setNewManager] = useState({ username: '', password: '' });

    const [tempPassword, setTempPassword] = useState(null);
    const [resettingDcaUserId, setResettingDcaUserId] = useState(null);
    const [resettingManagerId, setResettingManagerId] = useState(null);

    const fetchData = async () => {
        try {
            const [dcaRes, userRes, managerRes] = await Promise.all([
                api.get('/admin/dcas'),
                api.get('/admin/dca-users'),
                api.get('/admin/managers'),
            ]);
            setDcas(dcaRes.data);
            setDcaUsers(userRes.data);
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

        try {
            await api.patch(`/admin/dcas/${editingDca.dca_id}`, editingDca);
            toast.success(`Updated ${editingDca.dca_id}`);
            setEditingDca(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update DCA');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;

        try {
            await api.patch(`/admin/dca-users/${editingUser._id}`, editingUser);
            toast.success(`Updated user ${editingUser.username}`);
            setEditingUser(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update DCA user');
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
        try {
            await api.post('/admin/dcas', newDca);
            toast.success('DCA organization created');
            setShowCreateDca(false);
            setNewDca({ dca_id: '', dca_name: '', region_coverage: '', contact_email: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create DCA');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/admin/dca-users', newUser);
            if (res.data?.temp_password) setTempPassword(res.data.temp_password);
            toast.success('DCA user created');
            setShowCreateUser(false);
            setNewUser({ username: '', password: '', dca_id: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create DCA user');
        }
    };

    const handleCreateManager = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/admin/managers', newManager);
            if (res.data?.temp_password) setTempPassword(res.data.temp_password);
            toast.success('Manager created');
            setShowCreateManager(false);
            setNewManager({ username: '', password: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create manager');
        }
    };

    const handleResetDcaUserPassword = async (userId) => {
        setResettingDcaUserId(userId);
        try {
            const res = await api.post(`/admin/dca-users/${userId}/reset`);
            setTempPassword(res.data.temp_password);
            toast.success('DCA user password reset');
        } catch (err) {
            toast.error('Password reset failed');
        } finally {
            setResettingDcaUserId(null);
        }
    };

    const handleResetManagerPassword = async (managerId) => {
        setResettingManagerId(managerId);
        try {
            const res = await api.post(`/admin/managers/${managerId}/reset`);
            setTempPassword(res.data.temp_password);
            toast.success('Manager password reset');
        } catch (err) {
            toast.error('Password reset failed');
        } finally {
            setResettingManagerId(null);
        }
    };

    const handleToggleDcaUserActive = async (userId, currentActive) => {
        try {
            await api.patch(`/admin/dca-users/${userId}`, { is_active: !currentActive });
            toast.success(`DCA user ${currentActive ? 'disabled' : 'enabled'}`);
            fetchData();
        } catch (err) {
            toast.error('Failed to update user status');
        }
    };

    const handleToggleManagerActive = async (managerId, currentActive) => {
        try {
            await api.patch(`/admin/managers/${managerId}`, { is_active: !currentActive });
            toast.success(`Manager ${currentActive ? 'disabled' : 'enabled'}`);
            fetchData();
        } catch (err) {
            toast.error('Failed to update manager status');
        }
    };

    const handleToggleDcaActive = async (dcaId, currentActive) => {
        try {
            await api.patch(`/admin/dcas/${dcaId}`, { is_active: !currentActive });
            toast.success(`DCA ${currentActive ? 'disabled' : 'enabled'}`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update DCA status');
        }
    };

    const actionBtnClass = 'text-xs px-2.5 py-1.5 rounded-lg border transition-colors';

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
                <h1 className="text-2xl font-bold text-white">DCA & Access Management</h1>
                <p className="text-sm text-surface-200/60 mt-1">
                    Manage DCA organizations, DCA users, and manager accounts with clear text actions.
                </p>
            </div>

            {tempPassword && (
                <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm text-amber-400 font-medium">Temporary Password (copy now - shown only once)</p>
                            <p className="text-lg font-mono font-bold text-white mt-1">{tempPassword}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(tempPassword);
                                    toast.success('Copied temporary password');
                                }}
                                className="btn-secondary flex items-center gap-1"
                            >
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                            <button onClick={() => setTempPassword(null)} className="btn-secondary">Dismiss</button>
                        </div>
                    </div>
                </div>
            )}

            <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">DCA Organizations</h2>
                        <span className="text-xs text-surface-200/40">({dcas.length})</span>
                    </div>
                    <button onClick={() => setShowCreateDca(!showCreateDca)} className="btn-primary text-sm">
                        {showCreateDca ? 'Hide Form' : 'Create DCA Organization'}
                    </button>
                </div>
                <p className="text-xs text-surface-200/50 mb-4">Create and maintain DCA profiles with clear status controls.</p>

                {showCreateDca && (
                    <form onSubmit={handleCreateDca} className="mb-5 bg-surface-800/50 rounded-xl p-4 space-y-3 border border-surface-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                <input
                                    value={newDca.region_coverage}
                                    onChange={(e) => setNewDca({ ...newDca, region_coverage: e.target.value })}
                                    placeholder="NA / EMEA / APAC / LATAM"
                                    className="input-field"
                                />
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
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="btn-success text-sm">Create DCA</button>
                        </div>
                    </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dcas.map((d) => (
                        <div key={d.dca_id} className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/30 hover:border-blue-500/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-white">{d.dca_name || 'Unnamed DCA'}</p>
                                    <p className="text-xs text-surface-200/50 mt-1">{d.dca_id}</p>
                                </div>
                                <span className={`badge ${d.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {d.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            <div className="mt-3 space-y-1 text-sm">
                                <p className="text-surface-200/70"><span className="text-surface-200/45">Region:</span> {d.region_coverage || '-'}</p>
                                <p className="text-surface-200/70 break-all"><span className="text-surface-200/45">Contact:</span> {d.contact_email || '-'}</p>
                            </div>

                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setEditingDca(editingDca?.dca_id === d.dca_id ? null : { ...d })}
                                    className={`${actionBtnClass} border-blue-500/30 text-blue-300 hover:bg-blue-500/10 flex items-center gap-1`}
                                >
                                    <Edit className="w-3 h-3" /> {editingDca?.dca_id === d.dca_id ? 'Close Edit' : 'Edit Details'}
                                </button>
                                <button
                                    onClick={() => handleToggleDcaActive(d.dca_id, d.is_active)}
                                    className={`${actionBtnClass} ${d.is_active
                                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                        : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
                                >
                                    {d.is_active ? 'Mark Inactive' : 'Mark Active'}
                                </button>
                            </div>

                            {editingDca?.dca_id === d.dca_id && (
                                <form onSubmit={handleUpdateDca} className="mt-4 pt-4 border-t border-surface-700/50 space-y-3">
                                    <p className="text-xs text-blue-300/80">Editing this DCA card (inline)</p>
                                    <div className="space-y-1">
                                        <label className="text-xs text-surface-200/60 uppercase">Name</label>
                                        <input
                                            value={editingDca.dca_name}
                                            onChange={(e) => setEditingDca({ ...editingDca, dca_name: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-surface-200/60 uppercase">Region</label>
                                        <input
                                            value={editingDca.region_coverage}
                                            onChange={(e) => setEditingDca({ ...editingDca, region_coverage: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-surface-200/60 uppercase">Contact Email</label>
                                        <input
                                            value={editingDca.contact_email}
                                            onChange={(e) => setEditingDca({ ...editingDca, contact_email: e.target.value })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setEditingDca(null)} className="btn-secondary text-sm">Cancel</button>
                                        <button type="submit" className="btn-primary text-sm">Save Changes</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-white">DCA Users</h2>
                        <span className="text-xs text-surface-200/40">({dcaUsers.length})</span>
                    </div>
                    <button onClick={() => setShowCreateUser(!showCreateUser)} className="btn-primary text-sm">
                        {showCreateUser ? 'Hide Form' : 'Create DCA User'}
                    </button>
                </div>
                <p className="text-xs text-surface-200/50 mb-4">Actions use labels for clarity: reset password, edit details, and enable/disable.</p>

                {showCreateUser && (
                    <form onSubmit={handleCreateUser} className="mb-4 bg-surface-800/50 rounded-xl p-4 space-y-3 border border-surface-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Username</label>
                                <input
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                    placeholder="username"
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">Password (optional)</label>
                                <input
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Leave blank for temporary password"
                                    className="input-field"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-surface-200/60 uppercase">DCA Assignment</label>
                                <select
                                    value={newUser.dca_id}
                                    onChange={(e) => setNewUser({ ...newUser, dca_id: e.target.value })}
                                    className="input-field"
                                    required
                                >
                                    <option value="">Select DCA...</option>
                                    {dcas.map((d) => (
                                        <option key={d.dca_id} value={d.dca_id}>{d.dca_id} - {d.dca_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="btn-success text-sm">Create DCA User</button>
                        </div>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-700/50">
                                {['Username', 'DCA', 'Status', 'Last Login', 'Actions'].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dcaUsers.map((u) => (
                                <Fragment key={u._id}>
                                    <tr className="border-b border-surface-700/30 hover:bg-surface-800/30">
                                        <td className="px-4 py-3 text-white font-medium">{u.username}</td>
                                        <td className="px-4 py-3"><span className="badge bg-cyan-500/20 text-cyan-400">{u.dca_id}</span></td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {u.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-200/50 text-xs">
                                            {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleResetDcaUserPassword(u._id)}
                                                    disabled={resettingDcaUserId === u._id}
                                                    className={`${actionBtnClass} border-surface-600 text-surface-100 hover:bg-surface-700/70 flex items-center gap-1 disabled:opacity-50`}
                                                    title="Reset Password"
                                                >
                                                    {resettingDcaUserId === u._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                    Reset Password
                                                </button>
                                                <button
                                                    onClick={() => setEditingUser(editingUser?._id === u._id ? null : { ...u, password: '' })}
                                                    className={`${actionBtnClass} border-blue-500/30 text-blue-300 hover:bg-blue-500/10 flex items-center gap-1`}
                                                    title="Edit User"
                                                >
                                                    <Edit className="w-3 h-3" /> {editingUser?._id === u._id ? 'Close Edit' : 'Edit User'}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleDcaUserActive(u._id, u.is_active)}
                                                    className={`${actionBtnClass} flex items-center gap-1 ${u.is_active
                                                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                                        : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    title={u.is_active ? 'Disable User' : 'Enable User'}
                                                >
                                                    {u.is_active ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                    {u.is_active ? 'Disable User' : 'Enable User'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {editingUser?._id === u._id && (
                                        <tr className="border-b border-surface-700/30 bg-surface-900/30">
                                            <td className="px-4 py-4" colSpan={5}>
                                                <form onSubmit={handleUpdateUser} className="space-y-3">
                                                    <p className="text-xs text-blue-300/80">Editing this user row (inline)</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-surface-200/60 uppercase">Username</label>
                                                            <input
                                                                value={editingUser.username}
                                                                onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                                                className="input-field"
                                                                required
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-surface-200/60 uppercase">New Password (optional)</label>
                                                            <input
                                                                value={editingUser.password || ''}
                                                                onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                                                placeholder="Leave blank to keep current"
                                                                className="input-field"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-surface-200/60 uppercase">DCA Assignment</label>
                                                            <select
                                                                value={editingUser.dca_id || ''}
                                                                onChange={(e) => setEditingUser({ ...editingUser, dca_id: e.target.value })}
                                                                className="input-field"
                                                            >
                                                                <option value="">No Assignment</option>
                                                                {dcas.map((d) => (
                                                                    <option key={d.dca_id} value={d.dca_id}>{d.dca_id} - {d.dca_name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary text-sm">Cancel</button>
                                                        <button type="submit" className="btn-primary text-sm">Save Changes</button>
                                                    </div>
                                                </form>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="glass-card p-6">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-semibold text-white">Manager Management</h2>
                        <span className="text-xs text-surface-200/40">({managers.length})</span>
                    </div>
                    <button onClick={() => setShowCreateManager(!showCreateManager)} className="btn-primary text-sm">
                        {showCreateManager ? 'Hide Form' : 'Create Manager'}
                    </button>
                </div>
                <p className="text-xs text-surface-200/50 mb-4">Manage manager accounts separately from DCA users.</p>

                {showCreateManager && (
                    <form onSubmit={handleCreateManager} className="mb-4 bg-surface-800/50 rounded-xl p-4 space-y-3 border border-surface-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                <label className="text-xs text-surface-200/60 uppercase">Password (optional)</label>
                                <input
                                    value={newManager.password}
                                    onChange={(e) => setNewManager({ ...newManager, password: e.target.value })}
                                    placeholder="Leave blank for temporary password"
                                    className="input-field"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="btn-success text-sm">Create Manager</button>
                        </div>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-700/50">
                                {['Username', 'Status', 'Last Login', 'Actions'].map((h) => (
                                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {managers.map((m) => (
                                <Fragment key={m._id}>
                                    <tr className="border-b border-surface-700/30 hover:bg-surface-800/30">
                                        <td className="px-4 py-3 text-white font-medium">{m.username}</td>
                                        <td className="px-4 py-3">
                                            <span className={`badge ${m.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {m.is_active ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-200/50 text-xs">
                                            {m.last_login_at ? new Date(m.last_login_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleResetManagerPassword(m._id)}
                                                    disabled={resettingManagerId === m._id}
                                                    className={`${actionBtnClass} border-surface-600 text-surface-100 hover:bg-surface-700/70 flex items-center gap-1 disabled:opacity-50`}
                                                    title="Reset Password"
                                                >
                                                    {resettingManagerId === m._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                    Reset Password
                                                </button>
                                                <button
                                                    onClick={() => setEditingManager(editingManager?._id === m._id ? null : { ...m, password: '' })}
                                                    className={`${actionBtnClass} border-blue-500/30 text-blue-300 hover:bg-blue-500/10 flex items-center gap-1`}
                                                    title="Edit Manager"
                                                >
                                                    <Edit className="w-3 h-3" /> {editingManager?._id === m._id ? 'Close Edit' : 'Edit Manager'}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleManagerActive(m._id, m.is_active)}
                                                    className={`${actionBtnClass} flex items-center gap-1 ${m.is_active
                                                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                                        : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    title={m.is_active ? 'Disable Manager' : 'Enable Manager'}
                                                >
                                                    {m.is_active ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                    {m.is_active ? 'Disable Manager' : 'Enable Manager'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {editingManager?._id === m._id && (
                                        <tr className="border-b border-surface-700/30 bg-surface-900/30">
                                            <td className="px-4 py-4" colSpan={4}>
                                                <form onSubmit={handleUpdateManager} className="space-y-3">
                                                    <p className="text-xs text-blue-300/80">Editing this manager row (inline)</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                                            <label className="text-xs text-surface-200/60 uppercase">New Password (optional)</label>
                                                            <input
                                                                value={editingManager.password || ''}
                                                                onChange={(e) => setEditingManager({ ...editingManager, password: e.target.value })}
                                                                placeholder="Leave blank to keep current"
                                                                className="input-field"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => setEditingManager(null)} className="btn-secondary text-sm">Cancel</button>
                                                        <button type="submit" className="btn-primary text-sm">Save Changes</button>
                                                    </div>
                                                </form>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
