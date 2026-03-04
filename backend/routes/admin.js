const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(auth, requireRole('admin'));

router.post('/ingest', adminController.ingest);
router.post('/dcas', adminController.createDca);
router.get('/dcas', adminController.listDcas);
router.patch('/dcas/:id', adminController.updateDca);
router.post('/dca-users', adminController.createDcaUser);
router.get('/dca-users', adminController.listDcaUsers);
router.post('/dca-users/:id/reset', adminController.resetDcaUserPassword);
router.patch('/dca-users/:id', adminController.updateDcaUser);
router.post('/managers', adminController.createManagerUser);
router.get('/managers', adminController.listManagers);
router.post('/managers/:id/reset', adminController.resetManagerPassword);
router.patch('/managers/:id', adminController.updateManagerUser);

module.exports = router;
