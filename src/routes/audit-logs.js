/**
 * Audit Logs API Routes
 * Provides endpoints for retrieving and managing audit log data
 * 
 * @author SignOuts System
 * @version 1.0.0
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireAuth, requireBothAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Permission middleware for audit log access
 */
const requireAuditLogsPermission = async (req, res, next) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) {
            const errorResponse = req.errorHandler.authError('Authentication required');
            return res.status(401).json(errorResponse);
        }

        // Check for specific permission OR admin status
        const hasPermission = await req.permissionsMiddleware.hasPermission(userId, 'view_audit_logs');
        const isAdmin = await req.permissionsMiddleware.hasPermission(userId, 'system_admin');
        
        if (!hasPermission && !isAdmin) {
            const errorResponse = req.errorHandler.permissionError(
                'Insufficient permissions: view_audit_logs required'
            );
            return res.status(403).json(errorResponse);
        }

        next();
    } catch (error) {
        console.error('Audit logs permission check error:', error);
        const errorResponse = req.errorHandler.failure('Permission check failed', {
            category: 'AUTHORIZATION',
            severity: 'HIGH'
        });
        return res.status(500).json(errorResponse);
    }
};

/**
 * Validation error handler middleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError('Validation failed', {
            validationErrors: errors.array()
        });
        return res.status(400).json(errorResponse);
    }
    next();
};

/**
 * GET /api/audit-logs
 * Retrieve audit logs with optional filtering
 * 
 * Query parameters:
 * - limit: Number of records to return (default: 50, max: 500)
 * - offset: Number of records to skip (default: 0)
 * - action_type: Filter by action type (CREATE, UPDATE, DELETE, etc.)
 * - table_name: Filter by affected table
 * - user_id: Filter by user who performed the action
 * - start_date: Filter logs after this date (ISO format)
 * - end_date: Filter logs before this date (ISO format)
 * - search: Search in action descriptions and user names
 */
router.get('/',
    requireBothAuth,
    requireAuditLogsPermission,
    // Input validation
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
    query('action_type').optional().isAlpha().withMessage('Action type must contain only letters'),
    query('table_name').optional().isAlphanumeric('en-US', { ignore: '_' }).withMessage('Table name must be alphanumeric with underscores'),
    query('user_id').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    query('start_date').optional().isISO8601().withMessage('Start date must be in ISO 8601 format'),
    query('end_date').optional().isISO8601().withMessage('End date must be in ISO 8601 format'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term must be 100 characters or less'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const {
                limit = 50,
                offset = 0,
                action_type,
                table_name,
                user_id,
                start_date,
                end_date,
                search
            } = req.query;

            // Build filter options
            const filters = {};
            if (action_type) filters.action_type = action_type.toUpperCase();
            if (table_name) filters.table_name = table_name.toLowerCase();
            if (user_id) filters.user_id = parseInt(user_id);
            if (start_date) filters.start_date = start_date;
            if (end_date) filters.end_date = end_date;
            if (search) filters.search = search;

            // Get audit logs using AuditManager
            const auditLogs = await new Promise((resolve, reject) => {
                req.auditManager.getAuditLogs({
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    filters
                }, (err, logs, totalCount) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ logs, totalCount });
                    }
                });
            });

            const successResponse = req.errorHandler.success({
                logs: auditLogs.logs,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: auditLogs.totalCount,
                    hasMore: (parseInt(offset) + auditLogs.logs.length) < auditLogs.totalCount
                },
                filters: filters
            }, `Retrieved ${auditLogs.logs.length} audit log entries`);

            res.json(successResponse);

        } catch (error) {
            console.error('Get audit logs error:', error);
            const errorResponse = req.errorHandler.failure('Failed to retrieve audit logs', {
                category: 'SYSTEM',
                severity: 'HIGH',
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics and summary information
 */
router.get('/stats',
    requireBothAuth,
    requireAuditLogsPermission,
    async (req, res) => {
        try {
            // Get audit log statistics
            const stats = await new Promise((resolve, reject) => {
                req.auditManager.getAuditStats((err, statistics) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(statistics);
                    }
                });
            });

            const successResponse = req.errorHandler.success(stats, 'Audit log statistics retrieved successfully');
            res.json(successResponse);

        } catch (error) {
            console.error('Get audit stats error:', error);
            const errorResponse = req.errorHandler.failure('Failed to retrieve audit statistics', {
                category: 'SYSTEM',
                severity: 'HIGH',
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

module.exports = router;
