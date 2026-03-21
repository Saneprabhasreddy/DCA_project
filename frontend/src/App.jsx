import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CasesListPage from './pages/CasesListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import CreateCasePage from './pages/CreateCasePage';
import DcaManagementPage from './pages/DcaManagementPage';
import IngestPage from './pages/IngestPage';
import MyCasesPage from './pages/MyCasesPage';
import DcaDashboardPage from './pages/DcaDashboardPage';

function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) return null;

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to={user.role === 'dca_user' ? '/my-dashboard' : '/dashboard'} replace /> : <LoginPage />} />

            {/* Admin/Manager routes */}
            <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'manager']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/cases" element={<ProtectedRoute roles={['admin', 'manager']}><CasesListPage /></ProtectedRoute>} />
            <Route path="/cases/new" element={<ProtectedRoute roles={['admin', 'manager']}><CreateCasePage /></ProtectedRoute>} />
            <Route path="/cases/:case_id" element={<ProtectedRoute roles={['admin', 'manager', 'dca_user']}><CaseDetailPage /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/admin/dcas" element={<ProtectedRoute roles={['admin']}><DcaManagementPage /></ProtectedRoute>} />
            <Route path="/admin/ingest" element={<ProtectedRoute roles={['admin']}><IngestPage /></ProtectedRoute>} />

            {/* DCA User */}
            <Route path="/my-dashboard" element={<ProtectedRoute roles={['dca_user']}><DcaDashboardPage /></ProtectedRoute>} />
            <Route path="/my-cases" element={<ProtectedRoute roles={['dca_user']}><MyCasesPage /></ProtectedRoute>} />

            {/* Default */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
