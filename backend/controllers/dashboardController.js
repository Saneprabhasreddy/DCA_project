const Case = require('../models/Case');
const DcaOrg = require('../models/DcaOrg');
const MlMetric = require('../models/MlMetric');
const AuditLog = require('../models/AuditLog');

function normalizeMetrics(metrics) {
    if (!metrics) return null;

    const hasFlatConfusion =
        typeof metrics.tn === 'number' ||
        typeof metrics.fp === 'number' ||
        typeof metrics.fn === 'number' ||
        typeof metrics.tp === 'number';

    return {
        ...metrics,
        accuracy: metrics.accuracy ?? metrics.clf_accuracy ?? null,
        precision: metrics.precision ?? metrics.clf_precision ?? null,
        recall: metrics.recall ?? metrics.clf_recall ?? null,
        roc_auc: metrics.roc_auc ?? metrics.clf_roc_auc ?? null,
        pr_auc: metrics.pr_auc ?? metrics.clf_pr_auc ?? null,
        amount_mae: metrics.amount_mae ?? metrics.reg_amount_mae ?? null,
        days_mae: metrics.days_mae ?? metrics.reg_days_mae ?? null,
        confusion_matrix: metrics.confusion_matrix ?? (
            hasFlatConfusion
                ? {
                    tn: metrics.tn ?? 0,
                    fp: metrics.fp ?? 0,
                    fn: metrics.fn ?? 0,
                    tp: metrics.tp ?? 0,
                }
                : null
        ),
    };
}

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
    try {
        if (!['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only admin/manager can access this dashboard' });
        }

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
            latestMetrics: normalizeMetrics(latestMetrics ? latestMetrics.metrics : null),
            recentAudit,
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/dashboard/dca-stats
exports.getDcaStats = async (req, res) => {
    try {
        if (req.user.role !== 'dca_user') {
            return res.status(403).json({ error: 'Only DCA users can access this dashboard' });
        }
        if (!req.user.dca_id) {
            return res.status(400).json({ error: 'DCA user is missing dca_id' });
        }

        const now = new Date();
        const match = { assigned_dca_id: req.user.dca_id };

        const [totalsAgg, stageBreakdown, regionBreakdown, priorityCases] = await Promise.all([
            Case.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: null,
                        totalAssigned: { $sum: 1 },
                        openCases: { $sum: { $cond: [{ $ne: ['$current_stage_snapshot', 'Closed'] }, 1, 0] } },
                        closedCases: { $sum: { $cond: [{ $eq: ['$current_stage_snapshot', 'Closed'] }, 1, 0] } },
                        overdueCases: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ['$current_stage_snapshot', 'Closed'] },
                                            { $ne: ['$sla_due_date', null] },
                                            { $lt: ['$sla_due_date', now] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        ptpCases: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$promised_to_pay_flag', 1] },
                                            { $eq: ['$current_stage_snapshot', 'PTP'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        disputeCases: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$dispute_flag', 1] },
                                            { $eq: ['$current_stage_snapshot', 'Dispute'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        escalatedCases: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ['$escalation_flag', 1] },
                                            { $eq: ['$current_stage_snapshot', 'Escalated'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                        recoveredCases: { $sum: { $cond: [{ $eq: ['$recovered_flag', 1] }, 1, 0] } },
                        totalInvoiceAmount: { $sum: '$invoice_amount_usd' },
                        openInvoiceAmount: {
                            $sum: { $cond: [{ $ne: ['$current_stage_snapshot', 'Closed'] }, '$invoice_amount_usd', 0] },
                        },
                        totalRecoveredAmount: { $sum: '$recovered_amount_usd' },
                        avgOverdueDays: { $avg: '$overdue_days_at_allocation' },
                        avgAiProb60d: { $avg: '$ai_prob_60d' },
                    },
                },
            ]),
            Case.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$current_stage_snapshot',
                        count: { $sum: 1 },
                        totalInvoice: { $sum: '$invoice_amount_usd' },
                    },
                },
                { $sort: { count: -1 } },
            ]),
            Case.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: { $ifNull: ['$region', 'Unknown'] },
                        count: { $sum: 1 },
                        totalInvoice: { $sum: '$invoice_amount_usd' },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 6 },
            ]),
            Case.find({ ...match, current_stage_snapshot: { $ne: 'Closed' } })
                .select('case_id current_stage_snapshot invoice_amount_usd overdue_days_at_allocation ai_prob_60d dispute_flag promised_to_pay_flag sla_due_date')
                .sort({ overdue_days_at_allocation: -1, invoice_amount_usd: -1 })
                .limit(8)
                .lean(),
        ]);

        const totals = totalsAgg[0] || {
            totalAssigned: 0,
            openCases: 0,
            closedCases: 0,
            overdueCases: 0,
            ptpCases: 0,
            disputeCases: 0,
            escalatedCases: 0,
            recoveredCases: 0,
            totalInvoiceAmount: 0,
            openInvoiceAmount: 0,
            totalRecoveredAmount: 0,
            avgOverdueDays: 0,
            avgAiProb60d: null,
        };

        const recoveryRate = totals.totalAssigned > 0
            ? Number(((totals.recoveredCases / totals.totalAssigned) * 100).toFixed(1))
            : 0;
        const closureRate = totals.totalAssigned > 0
            ? Number(((totals.closedCases / totals.totalAssigned) * 100).toFixed(1))
            : 0;

        res.json({
            dcaId: req.user.dca_id,
            totals: {
                ...totals,
                recoveryRate,
                closureRate,
            },
            stageBreakdown,
            regionBreakdown,
            priorityCases,
        });
    } catch (err) {
        console.error('DCA dashboard stats error:', err);
        res.status(500).json({ error: err.message });
    }
};
