class PermissionsMiddleware {
    constructor(db) {
        this.db = db;
    }

    /**
     * Get all permissions for a user
     * @param {number} userId - User ID
     * @returns {Promise<Array>} Array of permission names
     */
    async getUserPermissions(userId) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    SELECT p.name 
                    FROM permissions p
                    JOIN user_permissions up ON p.id = up.permission_id
                    WHERE up.user_id = ?
                `);
                stmt.all(userId, (err, permissions) => {
                    if (err) {
                        console.error('Error getting user permissions:', err);
                        reject(err);
                    } else {
                        resolve(permissions.map(p => p.name));
                    }
                });
            } catch (error) {
                console.error('Error getting user permissions:', error);
                reject(error);
            }
        });
    }

    /**
     * Check if user has specific permission
     * @param {number} userId - User ID
     * @param {string} permission - Permission name
     * @returns {Promise<boolean>}
     */
    async hasPermission(userId, permission) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    SELECT COUNT(*) as count
                    FROM permissions p
                    JOIN user_permissions up ON p.id = up.permission_id
                    WHERE up.user_id = ? AND (p.name = ? OR p.name = 'system_admin')
                `);
               
                stmt.get(userId, permission, (err, result) => {
                    if (err) {
                        console.error('Error checking permission:', err);
                        reject(err);
                    } else {
                        resolve(result.count > 0);
                    }
                });
            } catch (error) {
                console.error('Error checking permission:', error);
                reject(error);
            }
        });
    }

    /**
     * Check if user has ALL specified permissions (AND logic)
     * @param {number} userId - User ID
     * @param {Array<string>} permissions - Array of permission names
     * @returns {Promise<boolean>}
     */
    async hasAllPermissions(userId, permissions) {
        if (!permissions || permissions.length === 0) return true;
        
        try {
            const userPermissions = await this.getUserPermissions(userId);
            return permissions.every(permission => userPermissions.includes(permission));
        } catch (error) {
            console.error('Error checking all permissions:', error);
            return false;
        }
    }

    /**
     * Check if user has ANY of the specified permissions (OR logic)
     * @param {number} userId - User ID
     * @param {Array<string>} permissions - Array of permission names
     * @returns {Promise<boolean>}
     */
    async hasAnyPermission(userId, permissions) {
        if (!permissions || permissions.length === 0) return true;
        
        try {
            const userPermissions = await this.getUserPermissions(userId);
            return permissions.some(permission => userPermissions.includes(permission));
        } catch (error) {
            console.error('Error checking any permissions:', error);
            return false;
        }
    }

    /**
     * Express middleware factory for checking permissions
     * @param {string|Array<string>} requiredPermissions - Required permission(s)
     * @param {string} logic - 'AND' or 'OR' logic (default: 'AND')
     * @returns {Function} Express middleware function
     */
    requirePermissions(requiredPermissions, logic = 'AND') {
        return async (req, res, next) => {
            try {
                const userId = req.user?.id || req.session?.userId;
                
                if (!userId) {
                    return res.status(401).json({ 
                        error: 'Authentication required',
                        code: 'AUTH_REQUIRED'
                    });
                }

                // Convert single permission to array
                const permissions = Array.isArray(requiredPermissions) 
                    ? requiredPermissions 
                    : [requiredPermissions];

                let hasAccess = false;
                
                if (logic.toUpperCase() === 'OR') {
                    hasAccess = await this.hasAnyPermission(userId, permissions);
                } else {
                    hasAccess = await this.hasAllPermissions(userId, permissions);
                }

                if (!hasAccess) {
                    return res.status(403).json({ 
                        error: 'Insufficient permissions',
                        code: 'INSUFFICIENT_PERMISSIONS',
                        required: permissions,
                        logic: logic
                    });
                }

                next();
            } catch (error) {
                console.error('Permission middleware error:', error);
                res.status(500).json({ 
                    error: 'Permission check failed',
                    code: 'PERMISSION_CHECK_ERROR'
                });
            }
        };
    }

    /**
     * Grant permission to user
     * @param {number} userId - User ID to grant permission to
     * @param {string} permissionName - Permission name
     * @param {number} grantedBy - User ID who granted the permission
     * @returns {Promise<boolean>}
     */
    async grantPermission(userId, permissionName, grantedBy) {
        return new Promise((resolve, reject) => {
            try {
                // First get permission ID
                const permStmt = this.db.prepare('SELECT id FROM permissions WHERE name = ?');
                permStmt.get(permissionName, (err, permission) => {
                    if (err) {
                        console.error('Error finding permission:', err);
                        reject(err);
                        return;
                    }
                    
                    if (!permission) {
                        reject(new Error(`Permission '${permissionName}' not found`));
                        return;
                    }

                    // Grant permission
                    const stmt = this.db.prepare(`
                        INSERT OR IGNORE INTO user_permissions (user_id, permission_id, granted_by)
                        VALUES (?, ?, ?)
                    `);
                    stmt.run(userId, permission.id, grantedBy, function(err) {
                        if (err) {
                            console.error('Error granting permission:', err);
                            reject(err);
                        } else {
                            resolve(this.changes > 0);
                        }
                    });
                });
            } catch (error) {
                console.error('Error granting permission:', error);
                reject(error);
            }
        });
    }

    /**
     * Grant multiple permissions to user
     * @param {number} userId - User ID
     * @param {Array<string>} permissionNames - Array of permission names
     * @param {number} grantedBy - User ID who granted the permissions
     * @returns {Promise<boolean>}
     */
    async grantMultiplePermissions(userId, permissionNames, grantedBy) {
        try {
            const results = await Promise.all(
                permissionNames.map(permission => 
                    this.grantPermission(userId, permission, grantedBy)
                )
            );
            return results.every(result => result === true);
        } catch (error) {
            console.error('Error granting multiple permissions:', error);
            return false;
        }
    }

    /**
     * Revoke permission from user
     * @param {number} userId - User ID
     * @param {string} permissionName - Permission name
     * @returns {Promise<boolean>}
     */
    async revokePermission(userId, permissionName) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    DELETE FROM user_permissions 
                    WHERE user_id = ? AND permission_id = (
                        SELECT id FROM permissions WHERE name = ?
                    )
                `);
                stmt.run(userId, permissionName, function(err) {
                    if (err) {
                        console.error('Error revoking permission:', err);
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                console.error('Error revoking permission:', error);
                reject(error);
            }
        });
    }

    /**
     * Revoke multiple permissions from user
     * @param {number} userId - User ID
     * @param {Array<string>} permissionNames - Array of permission names
     * @returns {Promise<boolean>}
     */
    async revokeMultiplePermissions(userId, permissionNames) {
        try {
            const results = await Promise.all(
                permissionNames.map(permission => 
                    this.revokePermission(userId, permission)
                )
            );
            return results.some(result => result === true);
        } catch (error) {
            console.error('Error revoking multiple permissions:', error);
            return false;
        }
    }

    /**
     * Set user permissions (replaces all existing permissions)
     * @param {number} userId - User ID
     * @param {Array<string>} permissionNames - Array of permission names
     * @param {number} grantedBy - User ID who set the permissions
     * @returns {Promise<boolean>}
     */
    async setUserPermissions(userId, permissionNames, grantedBy) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // Remove all existing permissions
                const deleteStmt = this.db.prepare('DELETE FROM user_permissions WHERE user_id = ?');
                deleteStmt.run(userId, (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    // Add new permissions
                    if (permissionNames.length === 0) {
                        this.db.run('COMMIT');
                        resolve(true);
                        return;
                    }

                    let completed = 0;
                    let hasError = false;

                    permissionNames.forEach(permissionName => {
                        this.grantPermission(userId, permissionName, grantedBy)
                            .then(() => {
                                completed++;
                                if (completed === permissionNames.length && !hasError) {
                                    this.db.run('COMMIT');
                                    resolve(true);
                                }
                            })
                            .catch((err) => {
                                if (!hasError) {
                                    hasError = true;
                                    this.db.run('ROLLBACK');
                                    reject(err);
                                }
                            });
                    });
                });
            });
        });
    }

    /**
     * Get all available permissions
     * @returns {Promise<Array>}
     */
    async getAllPermissions() {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare('SELECT * FROM permissions ORDER BY name');
                stmt.all((err, permissions) => {
                    if (err) {
                        console.error('Error getting all permissions:', err);
                        reject(err);
                    } else {
                        resolve(permissions);
                    }
                });
            } catch (error) {
                console.error('Error getting all permissions:', error);
                reject(error);
            }
        });
    }

    /**
     * Get detailed user permissions with metadata
     * @param {number} userId - User ID
     * @returns {Promise<Array>}
     */
    async getUserPermissionsDetailed(userId) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    SELECT 
                        p.id,
                        p.name,
                        p.description,
                        up.granted_at,
                        up.granted_by,
                        u.rank || ' ' || u.full_name as granted_by_name
                    FROM permissions p
                    JOIN user_permissions up ON p.id = up.permission_id
                    LEFT JOIN users u ON up.granted_by = u.id
                    WHERE up.user_id = ?
                    ORDER BY p.name
                `);
                stmt.all(userId, (err, permissions) => {
                    if (err) {
                        console.error('Error getting detailed user permissions:', err);
                        reject(err);
                    } else {
                        resolve(permissions);
                    }
                });
            } catch (error) {
                console.error('Error getting detailed user permissions:', error);
                reject(error);
            }
        });
    }
}

module.exports = PermissionsMiddleware;
