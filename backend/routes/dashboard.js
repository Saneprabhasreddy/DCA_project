const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');

router.get('/stats', auth, dashboardController.getStats);
router.get('/dca-stats', auth, dashboardController.getDcaStats);

module.exports = router;
