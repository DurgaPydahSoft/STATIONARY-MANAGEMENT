const express = require('express');
const {
  createAuditLog,
  listAuditLogs,
  approveAuditLog,
  rejectAuditLog,
} = require('../controllers/auditLogController');

const router = express.Router();

router.route('/')
  .post(createAuditLog)
  .get(listAuditLogs);

router.patch('/:id/approve', approveAuditLog);
router.patch('/:id/reject', rejectAuditLog);

module.exports = router;

