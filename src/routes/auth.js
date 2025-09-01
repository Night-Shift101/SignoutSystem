const express = require('express');
const { body, validationResult } = require('express-validator');
const { ErrorCategory, ErrorSeverity } = require('../utils/error-handler');
const router = express.Router();

// System password authentication
router.post('/system', [
    body('password').isLength({ min: 1 }).withMessage('System password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError(errors.array());
        return res.status(400).json(errorResponse);
    }

    const { password } = req.body;
    
    req.db.verifySystemPassword(password, (err, result) => {
        if (err) {
            console.error('System authentication error:', err);
            const errorResponse = req.errorHandler.failure('System authentication failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH,
                originalError: err
            });
            return res.status(500).json(errorResponse);
        }
        
        if (result.success) {
            req.session.systemAuthenticated = true;
            
            // Get all users after successful system authentication
            req.db.getAllUsers((err, users) => {
                if (err) {
                    console.error('Failed to fetch users:', err);
                    const errorResponse = req.errorHandler.failure('Authentication succeeded but failed to load users', {
                        category: ErrorCategory.DATABASE,
                        severity: ErrorSeverity.HIGH,
                        originalError: err
                    });
                    return res.status(500).json(errorResponse);
                }
                
                const successResponse = req.errorHandler.success({
                    users: users
                }, 'System authenticated successfully');
                
                res.json(successResponse);
            });
        } else {
            const errorResponse = req.errorHandler.authError('Invalid system password');
            res.status(401).json(errorResponse);
        }
    });
});

// User PIN authentication
router.post('/user', [
    body('userId').isInt().withMessage('Valid user ID is required'),
    body('pin').isLength({ min: 1 }).withMessage('PIN is required')
], (req, res) => {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError(validationErrors.array());
        return res.status(400).json(errorResponse);
    }
    
    if (!req.session.systemAuthenticated) {
        const errorResponse = req.errorHandler.authError('System authentication required first');
        return res.status(401).json(errorResponse);
    }

    const { userId, pin } = req.body;
    
    req.db.verifyUserPinById(userId, pin, (err, result) => {
        if (err) {
            console.error('User PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH,
                originalError: err
            });
            return res.status(500).json(errorResponse);
        }
        
        if (!result.success) {
            const errorResponse = req.errorHandler.authError(result.message || 'Invalid PIN');
            return res.status(401).json(errorResponse);
        }
        
        // Store user session
        req.session.user = {
            id: userId,
            rank: result.user.rank,
            full_name: result.user.full_name,
            username: `user_${userId}` 
        };
        
        const successResponse = req.errorHandler.success(
            { user: req.session.user }, 
            'User authenticated successfully'
        );
        res.json(successResponse);
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            const errorResponse = req.errorHandler.failure('Logout failed', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.MEDIUM,
                originalError: err
            });
            return res.status(500).json(errorResponse);
        }
        
        const successResponse = req.errorHandler.success(null, 'Logged out successfully');
        res.json(successResponse);
    });
});

// Check authentication status
router.get('/status', (req, res) => {
    const statusData = {
        systemAuthenticated: !!req.session.systemAuthenticated,
        userAuthenticated: !!req.session.user,
        user: req.session.user || null
    };
    
    const successResponse = req.errorHandler.success(statusData, 'Authentication status retrieved');
    res.json(successResponse);
});

// Verify PIN endpoint
router.post('/verify-pin', [
    body('pin').isLength({ min: 4 }).withMessage('PIN must be at least 4 digits')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError(errors.array());
        return res.status(400).json(errorResponse);
    }

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
        const errorResponse = req.errorHandler.failure('User not authenticated', {
            category: ErrorCategory.AUTHENTICATION,
            severity: ErrorSeverity.HIGH
        });
        return res.status(401).json(errorResponse);
    }

    const { pin } = req.body;
    
    req.db.verifyUserPin(req.session.user.id, pin, (err, isValid) => {
        if (err) {
            console.error('PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH,
                originalError: err
            });
            return res.status(500).json(errorResponse);
        }
        
        if (!isValid) {
            const errorResponse = req.errorHandler.failure('Invalid PIN', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.MEDIUM
            });
            return res.status(401).json(errorResponse);
        }
        
        const successResponse = req.errorHandler.success({ valid: true }, 'PIN verified successfully');
        res.json(successResponse);
    });
});

module.exports = router;
