const Case = require('../models/Case');
const DcaOrg = require('../models/DcaOrg');
const MlMetric = require('../models/MlMetric');
const AuditLog = require('../models/AuditLog');

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
    try {
        const [
            totalCases,
            allocatedCases,
            closedCases,
            recoveredCases,
            totalDcas,
            latestMetrics,
            recentAudit,
        ] = await Promise.all([
            Case.countDocuments(),
            Case.countDocuments({ current_stage_snapshot: { $ne: 'Closed' } }),
            Case.countDocuments({ current_stage_snapshot: 'Closed' }),
            Case.countDocuments({ recovered_flag: 1 }),
            DcaOrg.countDocuments({ is_active: true }),
            MlMetric.findOne().sort({ trained_at: -1 }).lean(),
            AuditLog.find().sort({ timestamp: -1 }).limit(10).lean(),
        ]);

        // Revenue stats
        const revenueAgg = await Case.aggregate([
            { $group: { _id: null, total_invoice: { $sum: '$invoice_amount_usd' }, total_recovered: { $sum: '$recovered_amount_usd' } } },
        ]);

        const revenue = revenueAgg[0] || { total_invoice: 0, total_recovered: 0 };

        // Stage breakdown
        const stageBreakdown = await Case.aggregate([
            { $group: { _id: '$current_stage_snapshot', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        // Region breakdown
        const regionBreakdown = await Case.aggregate([
            { $group: { _id: '$region', count: { $sum: 1 }, recovered: { $sum: '$recovered_amount_usd' } } },
            { $sort: { count: -1 } },
        ]);

        // DCA performance
        const dcaPerformance = await Case.aggregate([
            { $match: { assigned_dca_id: { $ne: null } } },
            {
                $group: {
                    _id: '$assigned_dca_id',
                    total: { $sum: 1 },
                    recovered: { $sum: { $cond: [{ $eq: ['$recovered_flag', 1] }, 1, 0] } },
                    total_recovered_amt: { $sum: '$recovered_amount_usd' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.json({
            totalCases,
            allocatedCases,
            closedCases,
            recoveredCases,
            totalDcas,
            totalInvoiceAmount: revenue.total_invoice,
            totalRecoveredAmount: revenue.total_recovered,
            recoveryRate: totalCases > 0 ? ((recoveredCases / totalCases) * 100).toFixed(1) : 0,
            stageBreakdown,
            regionBreakdown,
            dcaPerformance,
            latestMetrics: latestMetrics ? latestMetrics.metrics : null,
            recentAudit,
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
};
