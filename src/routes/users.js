const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth, requireBothAuth, verifyPin,requireSystemAuth, handleValidationErrors } = require('../middleware/auth');
const { ErrorCategory, ErrorSeverity } = require('../utils/error-handler');
const router = express.Router();

// Permission middleware helpers
const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            const userId = req.session?.user?.id;
            if (!userId) {
                const errorResponse = req.errorHandler.authError('Authentication required');
                return res.status(401).json(errorResponse);
            }

            const hasPermission = await req.permissionsMiddleware.hasPermission(userId, permission);
            if (!hasPermission) {
                const errorResponse = req.errorHandler.permissionError(
                    `Insufficient permissions: ${permission} required`
                );
                return res.status(403).json(errorResponse);
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            const errorResponse = req.errorHandler.failure('Permission check failed', {
                category: ErrorCategory.AUTHORIZATION,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    };
};

router.get('/', requireSystemAuth, async (req, res) => {
    try {
        req.db.getAllUsersExtended((err, users) => {
            if (err) {
                const errorResponse = req.errorHandler.databaseError(err, 'Fetch users');
                return res.status(500).json(errorResponse);
            }
            
            const successResponse = req.errorHandler.success(users, 'Users retrieved successfully');
            res.json(successResponse);
        });
    } catch (error) {
        const errorResponse = req.errorHandler.failure('Failed to fetch users', {
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.HIGH,
            originalError: error
        });
        res.status(500).json(errorResponse);
    }
});

router.get('/:id', 
    requireBothAuth,
    param('id').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {

        try {
            req.db.getUserById(req.params.id, (err, user) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch user by ID');
                    return res.status(500).json(errorResponse);
                }
                if (!user) {
                    const errorResponse = req.errorHandler.failure('User not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(404).json(errorResponse);
                }
                
                const successResponse = req.errorHandler.success(user, 'User retrieved successfully');
                res.json(successResponse);
            });
        } catch (error) {
            const errorResponse = req.errorHandler.failure('Failed to fetch user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.MEDIUM,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

// Add new user
router.post('/',
    requireBothAuth,
    requirePermission('create_users'),
    [
        body('rank').isLength({ min: 1 }).withMessage('Rank is required'),
        body('lastName').isLength({ min: 1 }).withMessage('Last name is required'),
        body('pin').isLength({ min: 4 }).withMessage('PIN must be at least 4 characters')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { rank, lastName, pin } = req.body;
            
            // Additional validation
            if (!/^\d{4,}$/.test(pin)) {
                const errorResponse = req.errorHandler.validationError('PIN must contain only digits and be at least 4 characters long');
                return res.status(400).json(errorResponse);
            }
            
            // Create a username from rank and last name
            const username = `${rank.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}`;
            
            const userData = {
                username,
                password: 'defaultpass', // Default password, should be changed
                pin,
                rank,
                firstName: '',
                lastName
            };
            
            req.db.createUser(userData, (err, result) => {
                if (err) {
                    console.error('Add user error:', err);
                    if (err.message && err.message.includes('already exists')) {
                        const errorResponse = req.errorHandler.failure('A user with this name already exists', {
                            category: ErrorCategory.BUSINESS,
                            severity: ErrorSeverity.LOW
                        });
                        return res.status(400).json(errorResponse);
                    }
                    const errorResponse = req.errorHandler.databaseError(err, 'Create user');
                    return res.status(500).json(errorResponse);
                }
                
                // Log audit event for user creation
                const auditContext = {
                    userId: req.session.user.id,
                    userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    sessionId: req.sessionID
                };
                
                req.auditManager.logUserChange(
                    'CREATE',
                    { id: result.id },
                    null,
                    { 
                        username: userData.username,
                        rank: userData.rank,
                        full_name: userData.lastName, // lastName becomes full_name
                        is_active: 1
                    },
                    auditContext,
                    (auditErr) => {
                        if (auditErr) {
                            console.error('Failed to log user creation audit:', auditErr);
                        }
                    }
                );
                
                const successResponse = req.errorHandler.success({ 
                    userId: result.id,
                    username: userData.username
                }, 'User created successfully');
                res.status(201).json(successResponse);
            });
        } catch (error) {
            console.error('Add user error:', error);
            const errorResponse = req.errorHandler.failure('Failed to create user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

// Update user PIN
router.patch('/:id/pin',
    requireBothAuth,
    requirePermission('change_user_pins'),
    [
        param('id').isInt({ min: 1 }),
        body('systemPassword').isLength({ min: 1 }).withMessage('System password is required'),
        body('newPin').isLength({ min: 4 }).withMessage('PIN must be at least 4 characters')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const userId = parseInt(req.params.id, 10);
            const { systemPassword, newPin } = req.body;
            
            req.db.getUserById(userId, (err, user) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch user for PIN update');
                    return res.status(500).json(errorResponse);
                }
                if (!user) {
                    const errorResponse = req.errorHandler.failure('User not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(404).json(errorResponse);
                }
                if (user.username === 'admin') {
                    const errorResponse = req.errorHandler.failure('Cannot change admin PIN through this endpoint. Use admin credentials endpoint.', {
                        category: ErrorCategory.AUTHORIZATION,
                        severity: ErrorSeverity.MEDIUM
                    });
                    return res.status(400).json(errorResponse);
                }
                
                req.db.verifySystemPassword(systemPassword, (err, result) => {
                    if (err) {
                        console.error('System password verification error:', err);
                        const errorResponse = req.errorHandler.failure('Authentication failed', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.HIGH
                        });
                        return res.status(500).json(errorResponse);
                    }
                    
                    if (!result.success) {
                        const errorResponse = req.errorHandler.failure('Invalid system password', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.MEDIUM
                        });
                        return res.status(401).json(errorResponse);
                    }
                    
                    req.db.changeUserPinAsAdmin(userId, newPin, req.session.user.id, (err, updateResult) => {
                        if (err) {
                            console.error('Update PIN error:', err);
                            const errorResponse = req.errorHandler.databaseError(err, 'Update user PIN');
                            return res.status(500).json(errorResponse);
                        }
                        
                        // Log audit event for PIN change
                        const auditContext = {
                            userId: req.session.user.id,
                            userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent'),
                            sessionId: req.sessionID
                        };
                        
                        req.auditManager.logUserChange(
                            'UPDATE',
                            user,
                            { pin_hash: '[HIDDEN]' }, // Don't store actual PIN hashes
                            { pin_hash: '[CHANGED]' },
                            auditContext,
                            (auditErr) => {
                                if (auditErr) {
                                    console.error('Failed to log PIN change audit:', auditErr);
                                }
                            }
                        );
                        
                        const successResponse = req.errorHandler.success(null, 'PIN updated successfully');
                        res.json(successResponse);
                    });
                });
            });
        } catch (error) {
            console.error('Update PIN error:', error);
            const errorResponse = req.errorHandler.failure('Failed to update PIN', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

// Delete user
router.delete('/:id',
    requireBothAuth,
    requirePermission('delete_users'),
    [
        param('id').isInt({ min: 1 }),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const userId = parseInt(req.params.id, 10);
            const { systemPassword } = req.body;
            
            // Prevent deleting own account
            if (userId === req.session.user.id) {
                const errorResponse = req.errorHandler.failure('Cannot delete your own account', {
                    category: ErrorCategory.BUSINESS,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(400).json(errorResponse);
            }
            
            req.db.getUserById(userId, (err, user) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch user for deletion');
                    return res.status(500).json(errorResponse);
                }
                if (!user) {
                    const errorResponse = req.errorHandler.failure('User not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(404).json(errorResponse);
                }
                if (user.username === 'admin') {
                    const errorResponse = req.errorHandler.failure('Cannot delete admin account', {
                        category: ErrorCategory.AUTHORIZATION,
                        severity: ErrorSeverity.HIGH
                    });
                    return res.status(400).json(errorResponse);
                }
                
                req.db.deleteUserAsAdmin(userId, req.session.user.id, (err, deleteResult) => {
                    if (err) {
                        console.error('Delete user error:', err);
                        const errorResponse = req.errorHandler.databaseError(err, 'Delete user');
                        return res.status(500).json(errorResponse);
                    }
                    
                    // Log audit event for user deletion
                    const auditContext = {
                        userId: req.session.user.id,
                        userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        sessionId: req.sessionID
                    };
                    
                    req.auditManager.logUserChange(
                        'DELETE',
                        user,
                        {
                            username: user.username,
                            rank: user.rank,
                            full_name: user.full_name,
                            is_active: user.is_active
                        },
                        null,
                        auditContext,
                        (auditErr) => {
                            if (auditErr) {
                                console.error('Failed to log user deletion audit:', auditErr);
                            }
                        }
                    );
                    
                    const successResponse = req.errorHandler.success(null, 'User deleted successfully');
                    res.json(successResponse);
                });
            });
        } catch (error) {
            console.error('Delete user error:', error);
            const errorResponse = req.errorHandler.failure('Failed to delete user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

router.patch('/:id/activate',
    requireBothAuth,
    requirePermission('deactivate_users'),
    param('id').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                const errorResponse = req.errorHandler.validationError('Invalid user ID');
                return res.status(400).json(errorResponse);
            }
            
            req.db.getUserById(userId, (err, user) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch user for activation');
                    return res.status(500).json(errorResponse);
                }
                if (!user) {
                    const errorResponse = req.errorHandler.failure('User not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(404).json(errorResponse);
                }
                if (user.is_active) {
                    const errorResponse = req.errorHandler.failure('User is already active', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(400).json(errorResponse);
                }

                req.db.updateUserStatus(userId, true, (err, result) => {
                    if (err) {
                        console.error('Activate user error:', err);
                        const errorResponse = req.errorHandler.databaseError(err, 'Activate user');
                        return res.status(500).json(errorResponse);
                    }
                    
                    // Log audit event for user activation
                    const auditContext = {
                        userId: req.session.user.id,
                        userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        sessionId: req.sessionID
                    };
                    
                    req.auditManager.logUserChange(
                        'UPDATE',
                        user,
                        { is_active: user.is_active },
                        { is_active: true },
                        auditContext,
                        (auditErr) => {
                            if (auditErr) {
                                console.error('Failed to log user activation audit:', auditErr);
                            }
                        }
                    );
                    
                    const successResponse = req.errorHandler.success(null, 'User activated successfully');
                    res.json(successResponse);
                });
            });
        } catch (error) {
            console.error('Activate user error:', error);
            const errorResponse = req.errorHandler.failure('Failed to activate user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

router.patch('/:id/deactivate',
    requireBothAuth,
    requirePermission('deactivate_users'),
    param('id').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
        try {
            const userId = parseInt(req.params.id, 10);
            
            if (userId === req.session.user.id) {
                const errorResponse = req.errorHandler.failure('Cannot deactivate your own account', {
                    category: ErrorCategory.BUSINESS,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(400).json(errorResponse);
            }

            req.db.getUserById(userId, (err, user) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch user for deactivation');
                    return res.status(500).json(errorResponse);
                }
                if (!user) {
                    const errorResponse = req.errorHandler.failure('User not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(404).json(errorResponse);
                }
                if (!user.is_active) {
                    const errorResponse = req.errorHandler.failure('User is already inactive', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.LOW
                    });
                    return res.status(400).json(errorResponse);
                }
                if (user.username === 'admin') {
                    const errorResponse = req.errorHandler.failure('Cannot deactivate admin account', {
                        category: ErrorCategory.AUTHORIZATION,
                        severity: ErrorSeverity.HIGH
                    });
                    return res.status(400).json(errorResponse);
                }

                req.db.updateUserStatus(userId, false, (err, result) => {
                    if (err) {
                        console.error('Deactivate user error:', err);
                        const errorResponse = req.errorHandler.databaseError(err, 'Deactivate user');
                        return res.status(500).json(errorResponse);
                    }
                    
                    // Audit log the user deactivation
                    const auditContext = {
                        userId: req.session.user.id,
                        userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        userAgent: req.get('User-Agent'),
                        sessionId: req.session.id
                    };
                    
                    req.auditManager.logUserChange(
                        'DEACTIVATE',
                        user,
                        { is_active: true },
                        { is_active: false },
                        auditContext,
                        (auditErr) => {
                            if (auditErr) {
                                console.error('Failed to log user deactivation audit:', auditErr);
                            }
                        }
                    );
                    
                    const successResponse = req.errorHandler.success(null, 'User deactivated successfully');
                    res.json(successResponse);
                });
            });
        } catch (error) {
            console.error('Deactivate user error:', error);
            const errorResponse = req.errorHandler.failure('Failed to deactivate user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

router.patch('/admin/credentials',
    requireBothAuth,
    [
        body('currentPassword').isLength({ min: 1 }).withMessage('Current password is required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password is required and must be at least 6 characters'),
        body('newPin').isLength({ min: 4 }).withMessage('New PIN is required and must be at least 4 characters')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { currentPassword, newPassword, newPin } = req.body;

            req.db.getUserByUsername('admin', (err, adminUser) => {
                if (err) {
                    const errorResponse = req.errorHandler.databaseError(err, 'Fetch admin user');
                    return res.status(500).json(errorResponse);
                }
                
                if (!adminUser) {
                    const errorResponse = req.errorHandler.failure('Admin user not found', {
                        category: ErrorCategory.BUSINESS,
                        severity: ErrorSeverity.HIGH
                    });
                    return res.status(404).json(errorResponse);
                }

                req.db.verifyUserPassword(adminUser.id, currentPassword, (err, isValid) => {
                    if (err) {
                        const errorResponse = req.errorHandler.failure('Authentication failed', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.HIGH
                        });
                        return res.status(500).json(errorResponse);
                    }
                    
                    if (!isValid) {
                        const errorResponse = req.errorHandler.failure('Current password is incorrect', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.MEDIUM
                        });
                        return res.status(401).json(errorResponse);
                    }

                    const updates = { password: newPassword, pin: newPin };

                    req.db.updateAdminCredentials(adminUser.id, updates, (err, result) => {
                        if (err) {
                            console.error('Update admin credentials error:', err);
                            const errorResponse = req.errorHandler.databaseError(err, 'Update admin credentials');
                            return res.status(500).json(errorResponse);
                        }
                        
                        const successResponse = req.errorHandler.success(null, 'Admin credentials updated successfully');
                        res.json(successResponse);
                    });
                });
            });
        } catch (error) {
            console.error('Update admin credentials error:', error);
            const errorResponse = req.errorHandler.failure('Failed to update credentials', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

// Change own credentials (PIN only for regular users)
router.patch('/me/credentials',
    requireAuth,
    requirePermission('change_own_credentials'),
    [
        body('currentPin').isLength({ min: 4 }).withMessage('Current PIN must be at least 4 characters'),
        body('newPin').isLength({ min: 4 }).withMessage('New PIN must be at least 4 characters'),
        body('confirmPin').custom((value, { req }) => {
            if (value !== req.body.newPin) {
                throw new Error('PIN confirmation does not match');
            }
            return true;
        })
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const userId = req.session.user.id;
            const { currentPin, newPin } = req.body;

            // Use the existing changeUserPin method that validates current PIN
            req.db.changeUserPin(userId, currentPin, newPin, (err, result) => {
                if (err) {
                    console.error('Error changing own PIN:', err);
                    
                    if (err.message === 'Current PIN is incorrect') {
                        const errorResponse = req.errorHandler.failure('Current PIN is incorrect', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.MEDIUM
                        });
                        return res.status(401).json(errorResponse);
                    }
                    
                    if (err.message === 'User not found') {
                        const errorResponse = req.errorHandler.failure('User not found', {
                            category: ErrorCategory.AUTHENTICATION,
                            severity: ErrorSeverity.HIGH
                        });
                        return res.status(404).json(errorResponse);
                    }
                    
                    const errorResponse = req.errorHandler.databaseError(err, 'Change own PIN');
                    return res.status(500).json(errorResponse);
                }
                
                // Log this action in audit logs
                const auditContext = {
                    userId: req.session.user.id,
                    userName: `${req.session.user.rank} ${req.session.user.full_name}`,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    sessionId: req.sessionID
                };
                
                req.auditManager.logUserChange(
                    'UPDATE',
                    { id: userId },
                    null,
                    { pin_changed: true },
                    auditContext,
                    (auditErr) => {
                        if (auditErr) {
                            console.error('Audit log error for credential change:', auditErr);
                        }
                    }
                );
                
                const successResponse = req.errorHandler.success(null, 'PIN changed successfully');
                res.json(successResponse);
            });
        } catch (error) {
            console.error('Change own credentials error:', error);
            const errorResponse = req.errorHandler.failure('Failed to change credentials', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    }
);

module.exports = router;
