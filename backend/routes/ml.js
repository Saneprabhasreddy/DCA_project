const express = require('express');
const router = express.Router();
const mlController = require('../controllers/mlController');
const { auth, requireRole } = require('../middleware/auth');

// Train — admin/manager only
router.post('/train', auth, requireRole('admin', 'manager'), mlController.train);

// Metrics — any authenticated user
router.get('/metrics', auth, mlController.getMetrics);
router.get('/metrics/history', auth, mlController.getMetricsHistory);

module.exports = router;
