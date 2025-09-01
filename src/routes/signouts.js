const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireBothAuth, verifyPin, handleValidationErrors, requireSystemAuth } = require('../middleware/auth');
const { ErrorCategory, ErrorSeverity } = require('../utils/error-handler');
const router = express.Router();

// Permission middleware helpers
const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            const userId = req.session?.user?.id;
            if (!userId) {
                const errorResponse = req.errorHandler.failure('Authentication required', {
                    category: ErrorCategory.AUTHENTICATION,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(401).json(errorResponse);
            }

            const hasPermission = await req.permissionsMiddleware.hasPermission(userId, permission);
            if (!hasPermission) {
                const errorResponse = req.errorHandler.failure(`Insufficient permissions: ${permission} required`, {
                    category: ErrorCategory.AUTHORIZATION,
                    severity: ErrorSeverity.MEDIUM,
                    context: { code: 'INSUFFICIENT_PERMISSIONS' }
                });
                return res.status(403).json(errorResponse);
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            const errorResponse = req.errorHandler.failure('Permission check failed', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    };
};

const requireAnyPermission = (permissions) => {
    return async (req, res, next) => {
        try {
            const userId = req.session?.user?.id;
            if (!userId) {
                const errorResponse = req.errorHandler.failure('Authentication required', {
                    category: ErrorCategory.AUTHENTICATION,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(401).json(errorResponse);
            }

            const hasAnyPermission = await req.permissionsMiddleware.hasAnyPermission(userId, permissions);
            if (!hasAnyPermission) {
                const errorResponse = req.errorHandler.failure(`Insufficient permissions: one of [${permissions.join(', ')}] required`, {
                    category: ErrorCategory.AUTHORIZATION,
                    severity: ErrorSeverity.MEDIUM,
                    context: { code: 'INSUFFICIENT_PERMISSIONS' }
                });
                return res.status(403).json(errorResponse);
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            const errorResponse = req.errorHandler.failure('Permission check failed', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
            res.status(500).json(errorResponse);
        }
    };
};

// Validation middleware for sign-out creation
const validateSignOut = [
    body('soldiers').isArray({ min: 1 }).withMessage('At least one soldier is required'),
    body('soldiers.*.rank').optional().trim(),
    body('soldiers.*.firstName').trim().isLength({ min: 1 }).withMessage('First name is required for each soldier'),
    body('soldiers.*.lastName').trim().isLength({ min: 1 }).withMessage('Last name is required for each soldier'),
    body('soldiers.*.dodId').optional().trim(),
    body('soldiers.*.middleName').optional().trim(),
    body('location').trim().isLength({ min: 1 }).withMessage('Location is required'),
    body('estimatedReturn').optional().isISO8601().withMessage('Valid estimated return time required'),
    body('notes').optional().trim(),
    body('emergencyContact').optional().trim(),
    body('vehicleInfo').optional().trim(),
    body('pin').isLength({ min: 4 }).withMessage('PIN is required')
];

// Get all signouts
router.get('/', requireAuth, requireSystemAuth, requireAnyPermission(['view_dashboard', 'view_logs']), (req, res) => {
    const { status, startDate, endDate, soldierName, location } = req.query;
    
    const filters = {
        status: status || null,
        startDate: startDate || null,
        endDate: endDate || null,
        soldierName: soldierName || null,
        location: location || null
    };
    if (!filters.status && !filters.startDate && !filters.endDate && !filters.soldierName && !filters.location) {
        req.db.getAllSignOuts((err, signouts) => {
            if (err) {
                console.error('Error fetching signouts:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Fetch all signouts');
                return res.status(500).json(errorResponse);
            }
            
            const successResponse = req.errorHandler.success(signouts, 'Signouts retrieved successfully');
            res.json(successResponse);
        });
    } else {
        req.db.getFilteredSignOuts(filters, (err, signouts) => {
            if (err) {
                console.error('Error fetching filtered signouts:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Fetch filtered signouts');
                return res.status(500).json(errorResponse);
            }
            
            const successResponse = req.errorHandler.success(signouts, 'Filtered signouts retrieved successfully');
            res.json(successResponse);
        });
    }
    
});

// Get all group members for specific sign-out IDs
router.post('/groups', requireAuth, requireSystemAuth, requirePermission('view_dashboard'), (req, res) => {
    const { signOutIds } = req.body;
    
    if (!signOutIds || !Array.isArray(signOutIds) || signOutIds.length === 0) {
        const errorResponse = req.errorHandler.validationError('Sign-out IDs array is required');
        return res.status(400).json(errorResponse);
    }
    
    req.db.getSignOutsByIds(signOutIds, (err, signouts) => {
        if (err) {
            console.error('Error fetching signouts by IDs:', err);
            const errorResponse = req.errorHandler.databaseError(err, 'Fetch group members');
            return res.status(500).json(errorResponse);
        }
        
        const successResponse = req.errorHandler.success(signouts, 'Group members retrieved successfully');
        res.json(successResponse);
    });
});

// Get signout by ID
router.get('/:id', requireBothAuth, (req, res) => {
    const signoutId = req.params.id;
    
    req.db.getSignOutById(signoutId, (err, signout) => {
        if (err) {
            console.error('Error fetching signout:', err);
            const errorResponse = req.errorHandler.databaseError(err, 'Fetch signout by ID');
            return res.status(500).json(errorResponse);
        }
        
        if (!signout) {
            const errorResponse = req.errorHandler.failure('Sign-out not found', {
                category: ErrorCategory.BUSINESS,
                severity: ErrorSeverity.LOW
            });
            return res.status(404).json(errorResponse);
        }
        
        const successResponse = req.errorHandler.success(signout, 'Signout retrieved successfully');
        res.json(successResponse);
    });
});

// Create new signout
router.post('/', [requireBothAuth, requirePermission('create_signout'), ...validateSignOut], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        const errorResponse = req.errorHandler.validationError('Validation failed', {
            details: errors.array()
        });
        return res.status(400).json(errorResponse);
    }

    const { soldiers, location, locationOptions, estimatedReturn, notes, emergencyContact, vehicleInfo, pin } = req.body;

    // Verify PIN
    req.db.verifyUserPin(req.session.user.id, pin, (err, isValid) => {
        if (err) {
            console.error('PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH
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

        requester = req.session.user.rank + " " + req.session.user.full_name

        const signoutData = {
            soldiers: soldiers.map(soldier => ({
                rank: soldier.rank || '',
                firstName: soldier.firstName ? soldier.firstName.trim() : '',
                lastName: soldier.lastName ? soldier.lastName.trim() : '',
                middleName: soldier.middleName || soldier.middleInitial || '',
                dodId: soldier.dodId ? soldier.dodId.trim() : null
            })),
            destination: location.trim(),
            locationOptions: locationOptions ? JSON.stringify(locationOptions) : null,
            estimatedReturn: estimatedReturn ? new Date(estimatedReturn) : null,
            notes: notes?.trim() || '',
            emergencyContact: emergencyContact?.trim() || '',
            vehicleInfo: vehicleInfo?.trim() || '',
            signed_out_by_id: req.session.user.id,
            signOutTime: new Date(),
            signed_out_by_name: requester
        };

        req.db.addSignOut(signoutData, (err, signoutId) => {
            if (err) {
                console.error('Error creating signout:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Create signout');
                return res.status(500).json(errorResponse);
            }

            const successResponse = req.errorHandler.success({
                signoutId: signoutId
            }, 'Sign-out created successfully');
            res.status(201).json(successResponse);
        });
    });
});

// Sign in soldiers
router.patch('/:id/signin', [
    requireBothAuth,
    requirePermission('sign_in_soldiers'),
    body('pin').isLength({ min: 4 }).withMessage('PIN is required'),
    body('notes').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError('Validation failed', {
            details: errors.array()
        });
        return res.status(400).json(errorResponse);
    }

    const signoutId = req.params.id;
    const { pin, notes } = req.body;

    // Verify PIN
    req.db.verifyUserPin(req.session.user.id, pin, (err, isValid) => {
        if (err) {
            console.error('PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH
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

        
        var signedInBy = req.session.user.id
        var signedInByName = req.session.user.rank + " " + req.session.user.full_name
            
    

        req.db.signInSoldiers(signoutId, signedInBy, signedInByName, (err, result) => {
            if (err) {
                console.error('Error signing in soldiers:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Sign in soldiers');
                return res.status(500).json(errorResponse);
            }

            if (!result.success) {
                const errorResponse = req.errorHandler.failure(result.message, {
                    category: ErrorCategory.BUSINESS,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(400).json(errorResponse);
            }

            const successResponse = req.errorHandler.success({
                duration: result.duration
            }, 'Soldiers signed in successfully');
            res.json(successResponse);
        });
    });
});

// Update signout
router.patch('/:id', [
    requireBothAuth,
    body('pin').isLength({ min: 4 }).withMessage('PIN is required'),
    body('destination').optional().trim(),
    body('estimatedReturn').optional().isISO8601(),
    body('notes').optional().trim(),
    body('emergencyContact').optional().trim(),
    body('vehicleInfo').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError('Validation failed', {
            details: errors.array()
        });
        return res.status(400).json(errorResponse);
    }

    const signoutId = req.params.id;
    const { pin, destination, estimatedReturn, notes, emergencyContact, vehicleInfo } = req.body;

    // Verify PIN
    req.db.verifyUserPin(req.session.user.id, pin, (err, isValid) => {
        if (err) {
            console.error('PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH
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

        const updateData = {};
        if (destination) updateData.destination = destination.trim();
        if (estimatedReturn) updateData.estimatedReturn = new Date(estimatedReturn);
        if (notes !== undefined) updateData.notes = notes.trim();
        if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact.trim();
        if (vehicleInfo !== undefined) updateData.vehicleInfo = vehicleInfo.trim();

        req.db.updateSignout(signoutId, updateData, (err, result) => {
            if (err) {
                console.error('Error updating signout:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Update signout');
                return res.status(500).json(errorResponse);
            }

            if (!result.success) {
                const errorResponse = req.errorHandler.failure(result.message, {
                    category: ErrorCategory.BUSINESS,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(400).json(errorResponse);
            }

            const successResponse = req.errorHandler.success(null, 'Sign-out updated successfully');
            res.json(successResponse);
        });
    });
});

// Delete signout
router.delete('/:id', [
    requireBothAuth,
    body('pin').isLength({ min: 4 }).withMessage('PIN is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorResponse = req.errorHandler.validationError('Validation failed', {
            details: errors.array()
        });
        return res.status(400).json(errorResponse);
    }

    const signoutId = req.params.id;
    const { pin } = req.body;

    // Verify PIN
    req.db.verifyUserPin(req.session.user.id, pin, (err, isValid) => {
        if (err) {
            console.error('PIN verification error:', err);
            const errorResponse = req.errorHandler.failure('PIN verification failed', {
                category: ErrorCategory.AUTHENTICATION,
                severity: ErrorSeverity.HIGH
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

        req.db.deleteSignout(signoutId, (err, result) => {
            if (err) {
                console.error('Error deleting signout:', err);
                const errorResponse = req.errorHandler.databaseError(err, 'Delete signout');
                return res.status(500).json(errorResponse);
            }

            if (!result.success) {
                const errorResponse = req.errorHandler.failure(result.message, {
                    category: ErrorCategory.BUSINESS,
                    severity: ErrorSeverity.MEDIUM
                });
                return res.status(400).json(errorResponse);
            }

            const successResponse = req.errorHandler.success(null, 'Sign-out deleted successfully');
            res.json(successResponse);
        });
    });
});

// Get overdue signouts
router.get('/reports/overdue', requireBothAuth, (req, res) => {
    req.db.getOverdueSignouts((err, signouts) => {
        if (err) {
            console.error('Error fetching overdue signouts:', err);
            return res.status(500).json({ error: 'Failed to fetch overdue sign-outs' });
        }
        res.json(signouts);
    });
});

// Get current signouts
router.get('/reports/current', requireBothAuth, (req, res) => {
    req.db.getCurrentSignOuts((err, signouts) => {
        if (err) {
            console.error('Error fetching current signouts:', err);
            return res.status(500).json({ error: 'Failed to fetch current sign-outs', details: err.message });
        }
        res.json(signouts);
    });
});


// Fetch filtered logs
router.get('/logs', requireBothAuth, requirePermission('view_logs'), (req, res) => {
    const { startDate, endDate, soldierName, location, status } = req.query;

    const filters = {
        startDate: startDate || null,
        endDate: endDate || null,
        soldierName: soldierName || null,
        location: location || null,
        status: status || null
    };

    req.db.getFilteredSignOuts(filters, (err, signouts) => {
        if (err) {
            console.error('Error fetching filtered logs:', err);
            return res.status(500).json({ error: 'Failed to fetch logs' });
        }
        res.json(signouts);
    });
});

// Export logs to CSV
router.get('/export/logs', requireBothAuth, requirePermission('view_logs'), (req, res) => {
    const { startDate, endDate, soldierName, location, status } = req.query;

    const filters = {
        startDate: startDate || null,
        endDate: endDate || null,
        soldierName: soldierName || null,
        location: location || null,
        status: status || null
    };

    req.db.exportSignoutsCSV(filters, (req.session.user.rank + " " + req.session.user.full_name), (err, csvData) => {
        if (err) {
            console.error('Error exporting logs to CSV:', err);
            return res.status(500).json({ error: 'Failed to export logs' });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=signout-logs-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvData);
    });
});

module.exports = router;
