import { useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Database, Loader2, CheckCircle, Upload } from 'lucide-react';

export default function IngestPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleIngest = async () => {
        setLoading(true);
        try {
            const res = await api.post('/admin/ingest', {}, { timeout: 300000 });
            setResult(res.data);
            if (res.data?.training?.attempted && res.data?.training?.success === false) {
                toast.error(`Ingestion done, auto-training failed: ${res.data.training.error || 'Unknown error'}`);
            } else {
                toast.success('Dataset ingested successfully!');
            }
        } catch (err) {
            const payload = err.response?.data || {};
            const message = payload.error || err.message || 'Ingestion failed';
            const details = payload.details ? ` ${payload.details}` : '';
            toast.error(`${message}${details}`.trim());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
            <h1 className="text-2xl font-bold text-surface-100">Data Ingestion</h1>

            <div className="glass-card p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Database className="w-10 h-10 text-white" />
                </div>

                <h2 className="text-xl font-semibold text-surface-100 mb-2">Seed MongoDB from Dataset</h2>
                <p className="text-surface-200/50 mb-6 max-w-md mx-auto">
                    This will load <strong>cases.csv</strong> and <strong>interactions.csv</strong> from the FedEx DCA synthetic dataset into MongoDB.
                    It also seeds available DCA organizations and default user accounts.
                </p>

                <button
                    id="ingest-btn"
                    onClick={handleIngest}
                    disabled={loading}
                    className="btn-primary w-full sm:w-auto justify-center text-lg px-8 py-3 flex items-center gap-3 mx-auto"
                >
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Upload className="w-6 h-6" />
                    )}
                    {loading ? 'Ingesting data...' : 'Ingest Dataset'}
                </button>

                {result && (
                    <div className="mt-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-left">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-lg font-semibold text-emerald-400">Ingestion Complete</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { label: 'Cases Loaded', value: result.cases?.toLocaleString() },
                                { label: 'Interactions Loaded', value: result.interactions?.toLocaleString() },
                                { label: 'DCAs Seeded', value: result.dcas },
                                { label: 'Users Seeded', value: result.users },
                            ].map((item, i) => (
                                <div key={i} className="bg-surface-800/50 rounded-lg p-3">
                                    <p className="text-xs text-surface-200/50">{item.label}</p>
                                    <p className="text-xl font-bold text-surface-100">{item.value}</p>
                                </div>
                            ))}
                        </div>
                        {result.training?.attempted && result.training?.success === false && (
                            <div className="mt-4 text-sm">
                                <p className="text-amber-300">
                                    Data ingestion succeeded, but auto-training failed: {result.training.error}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
