import { Router } from 'express';
import { adminLogin, adminLogout } from './admin.auth.controller';
import { requireAdmin } from './admin.middleware';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  bulkDeleteUsers,
  bulkUpdateRoles,
  exportUsers,
} from './admin.users.controller';
import { getSystemStats, getDatabaseHealth } from './admin.stats.controller';
import { getMemoryMetrics, getCpuMetrics, getSystemMetrics } from '../monitoring/metrics.controller';

const router = Router();

// Admin authentication (public endpoints)
router.post('/login', adminLogin);
router.post('/logout', requireAdmin, adminLogout);

// All routes below require admin authentication
router.use(requireAdmin);

// System metrics and monitoring
router.get('/metrics/memory', getMemoryMetrics);
router.get('/metrics/cpu', getCpuMetrics);
router.get('/metrics/system', getSystemMetrics);
router.get('/stats', getSystemStats);
router.get('/health/database', getDatabaseHealth);

// User management
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserById);
router.post('/users', createUser);
router.patch('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/reset-password', resetUserPassword);

// Bulk operations
router.post('/users/bulk-delete', bulkDeleteUsers);
router.post('/users/bulk-update-roles', bulkUpdateRoles);
router.get('/users/export', exportUsers);

export default router;

