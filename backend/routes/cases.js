const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const mlController = require('../controllers/mlController');
const { auth, requireRole } = require('../middleware/auth');

// All case routes require auth
router.use(auth);

router.get('/', caseController.listCases);
router.post('/', requireRole('admin', 'manager'), caseController.createCase);
router.get('/:case_id', caseController.getCase);
router.get('/:case_id/interactions', caseController.getCaseInteractions);

// DCA users can add interactions to their assigned cases
router.post('/:case_id/interactions', caseController.addInteraction);

// Predict & Recommend — admin/manager only
router.post('/:case_id/predict', requireRole('admin', 'manager'), mlController.predict);
router.post('/:case_id/recommend', requireRole('admin', 'manager'), mlController.recommend);

// Assign DCA — admin/manager only
router.post('/:case_id/assign', requireRole('admin', 'manager'), caseController.assignCase);

module.exports = router;
