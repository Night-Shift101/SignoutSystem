class PermissionsManager {
    constructor(db) {
        this.db = db;
        this.defaultPermissions = [
            {
                name: 'view_dashboard',
                description: 'View the main dashboard and current sign-outs'
            },
            {
                name: 'create_signout',
                description: 'Create new sign-out entries'
            },
            {
                name: 'sign_in_soldiers',
                description: 'Sign soldiers back in'
            },
            {
                name: 'view_logs',
                description: 'View sign-out logs and history'
            },
            {
                name: 'export_data',
                description: 'Export data to CSV/PDF formats'
            },
            {
                name: 'view_settings',
                description: 'View system settings'
            },
            {
                name: 'view_audit_logs',
                description: 'View system audit logs and user activity history'
            },
            {
                name: 'create_users',
                description: 'Create new user accounts'
            },
            {
                name: 'delete_users',
                description: 'Delete user accounts'
            },
            {
                name: 'deactivate_users',
                description: 'Deactivate and reactivate user accounts'
            },
            {
                name: 'manage_permissions',
                description: 'Grant and revoke user permissions'
            },
            {
                name: 'change_user_pins',
                description: 'Change other users\' PINs'
            },
            {
                name: 'change_own_credentials',
                description: 'Change own PIN and password'
            },
            {
                name: 'system_admin',
                description: 'Full system administration access'
            }
        ];

        // Define permission dependencies (parent -> children)
        this.permissionDependencies = {
            'view_dashboard': ['create_signout', 'sign_in_soldiers'],
            'view_logs': ['export_data'],
            'view_settings': ['change_own_credentials','view_audit_logs', 'create_users', 'delete_users', 'deactivate_users', 'change_user_pins', 'manage_permissions']
        };
    }

    /**
     * Initialize permissions tables and default data
     */
    async initializePermissions() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create permissions table
                const createPermissionsTable = `
                    CREATE TABLE IF NOT EXISTS permissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(50) UNIQUE NOT NULL,
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;

                // Create user_permissions junction table
                const createUserPermissionsTable = `
                    CREATE TABLE IF NOT EXISTS user_permissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        permission_id INTEGER NOT NULL,
                        granted_by INTEGER,
                        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by) REFERENCES users(id),
                        UNIQUE(user_id, permission_id)
                    )
                `;

                this.db.run(createPermissionsTable, (err) => {
                    if (err) {
                        console.error('Error creating permissions table:', err);
                        reject(err);
                        return;
                    }

                    this.db.run(createUserPermissionsTable, (err) => {
                        if (err) {
                            console.error('Error creating user_permissions table:', err);
                            reject(err);
                            return;
                        }

                        // Insert default permissions
                        this.insertDefaultPermissions()
                            .then(() => {
                                console.log('Permissions system initialized successfully');
                                resolve(true);
                            })
                            .catch((err) => {
                                console.error('Error inserting default permissions:', err);
                                reject(err);
                            });
                    });
                });
            });
        });
    }

    /**
     * Insert default permissions into the database
     */
    async insertDefaultPermissions() {
        return new Promise((resolve, reject) => {
            const insertStmt = this.db.prepare(`
                INSERT OR IGNORE INTO permissions (name, description) VALUES (?, ?)
            `);

            let completed = 0;
            let hasError = false;

            this.defaultPermissions.forEach((permission) => {
                insertStmt.run(permission.name, permission.description, (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        reject(err);
                        return;
                    }

                    completed++;
                    if (completed === this.defaultPermissions.length && !hasError) {
                        insertStmt.finalize();
                        resolve(true);
                    }
                });
            });

            if (this.defaultPermissions.length === 0) {
                resolve(true);
            }
        });
    }

    /**
     * Grant all permissions to a user (typically for admin setup)
     * @param {number} userId - User ID
     * @param {number} grantedBy - User ID who granted the permissions (optional)
     */
    async grantAllPermissions(userId, grantedBy = null) {
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(`
                    INSERT OR IGNORE INTO user_permissions (user_id, permission_id, granted_by)
                    SELECT ?, id, ? FROM permissions
                `);
                
                stmt.run(userId, grantedBy || userId, function(err) {
                    if (err) {
                        console.error('Error granting all permissions:', err);
                        reject(err);
                    } else {
                        console.log(`Granted ${this.changes} permissions to user ${userId}`);
                        resolve(this.changes);
                    }
                });
            } catch (error) {
                console.error('Error granting all permissions:', error);
                reject(error);
            }
        });
    }

    /**
     * Grant basic permissions to a new user
     * @param {number} userId - User ID
     * @param {number} grantedBy - User ID who granted the permissions
     */
    async grantBasicPermissions(userId, grantedBy) {
        const basicPermissions = [
            'view_dashboard',
            'create_signout',
            'sign_in_soldiers',
            'view_logs',
            'export_data'
        ];

        return new Promise((resolve, reject) => {
            let completed = 0;
            let hasError = false;

            basicPermissions.forEach((permissionName) => {
                // Get permission ID first
                const getPermStmt = this.db.prepare('SELECT id FROM permissions WHERE name = ?');
                getPermStmt.get(permissionName, (err, permission) => {
                    if (err || !permission) {
                        if (!hasError) {
                            hasError = true;
                            reject(err || new Error(`Permission ${permissionName} not found`));
                        }
                        return;
                    }

                    // Grant the permission
                    const insertStmt = this.db.prepare(`
                        INSERT OR IGNORE INTO user_permissions (user_id, permission_id, granted_by)
                        VALUES (?, ?, ?)
                    `);
                    
                    insertStmt.run(userId, permission.id, grantedBy, (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === basicPermissions.length && !hasError) {
                            console.log(`Granted basic permissions to user ${userId}`);
                            resolve(true);
                        }
                    });
                });
            });
        });
    }

    /**
     * Create a new permission
     * @param {string} name - Permission name
     * @param {string} description - Permission description
     */
    async createPermission(name, description) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO permissions (name, description) VALUES (?, ?)
            `);
            
            stmt.run(name, description, function(err) {
                if (err) {
                    console.error('Error creating permission:', err);
                    reject(err);
                } else {
                    console.log(`Created permission: ${name}`);
                    resolve({
                        id: this.lastID,
                        name: name,
                        description: description
                    });
                }
            });
        });
    }

    /**
     * Update a permission
     * @param {number} permissionId - Permission ID
     * @param {string} name - New permission name
     * @param {string} description - New permission description
     */
    async updatePermission(permissionId, name, description) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE permissions 
                SET name = ?, description = ? 
                WHERE id = ?
            `);
            
            stmt.run(name, description, permissionId, function(err) {
                if (err) {
                    console.error('Error updating permission:', err);
                    reject(err);
                } else {
                    console.log(`Updated permission ID: ${permissionId}`);
                    resolve(this.changes > 0);
                }
            });
        });
    }

    /**
     * Delete a permission (and all associated user permissions)
     * @param {number} permissionId - Permission ID
     */
    async deletePermission(permissionId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                // First delete all user permissions
                const deleteUserPermsStmt = this.db.prepare(`
                    DELETE FROM user_permissions WHERE permission_id = ?
                `);
                
                deleteUserPermsStmt.run(permissionId, (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                        return;
                    }

                    // Then delete the permission itself
                    const deletePermStmt = this.db.prepare(`
                        DELETE FROM permissions WHERE id = ?
                    `);
                    
                    deletePermStmt.run(permissionId, function(err) {
                        if (err) {
                            this.db.run('ROLLBACK');
                            reject(err);
                        } else {
                            this.db.run('COMMIT');
                            console.log(`Deleted permission ID: ${permissionId}`);
                            resolve(this.changes > 0);
                        }
                    });
                });
            });
        });
    }

    /**
     * Get all users with their permissions
     */
    async getAllUsersWithPermissions() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    u.id as user_id,
                    u.rank,
                    u.full_name,
                    u.username,
                    u.is_active,
                    u.created_at as user_created_at,
                    GROUP_CONCAT(p.name) as permissions
                FROM users u
                LEFT JOIN user_permissions up ON u.id = up.user_id
                LEFT JOIN permissions p ON up.permission_id = p.id
                GROUP BY u.id, u.rank, u.full_name, u.username, u.is_active, u.created_at
                ORDER BY u.id ASC
            `;

            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('Error getting users with permissions:', err);
                    reject(err);
                } else {
                    // Parse permissions string into array
                    const users = rows.map(row => ({
                        ...row,
                        permissions: row.permissions ? row.permissions.split(',') : []
                    }));
                    resolve(users);
                }
            });
        });
    }

    /**
     * Check if permissions tables exist and are properly set up
     */
    async checkPermissionsSetup() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('permissions', 'user_permissions')
            `;

            this.db.all(query, (err, tables) => {
                if (err) {
                    reject(err);
                } else {
                    const hasPermissionsTable = tables.some(t => t.name === 'permissions');
                    const hasUserPermissionsTable = tables.some(t => t.name === 'user_permissions');
                    
                    resolve({
                        isSetup: hasPermissionsTable && hasUserPermissionsTable,
                        hasPermissionsTable,
                        hasUserPermissionsTable,
                        tableCount: tables.length
                    });
                }
            });
        });
    }

    /**
     * Get permission statistics
     */
    async getPermissionStats() {
        return new Promise((resolve, reject) => {
            const queries = {
                totalPermissions: 'SELECT COUNT(*) as count FROM permissions',
                totalUserPermissions: 'SELECT COUNT(*) as count FROM user_permissions',
                usersWithPermissions: 'SELECT COUNT(DISTINCT user_id) as count FROM user_permissions',
                mostCommonPermissions: `
                    SELECT p.name, p.description, COUNT(up.user_id) as user_count
                    FROM permissions p
                    LEFT JOIN user_permissions up ON p.id = up.permission_id
                    GROUP BY p.id, p.name, p.description
                    ORDER BY user_count DESC
                    LIMIT 10
                `
            };

            const stats = {};
            let completed = 0;
            const totalQueries = Object.keys(queries).length;

            Object.entries(queries).forEach(([key, query]) => {
                this.db.all(query, (err, result) => {
                    if (err) {
                        console.error(`Error executing query ${key}:`, err);
                        reject(err);
                        return;
                    }

                    if (key === 'mostCommonPermissions') {
                        stats[key] = result;
                    } else {
                        stats[key] = result[0]?.count || 0;
                    }

                    completed++;
                    if (completed === totalQueries) {
                        resolve(stats);
                    }
                });
            });
        });
    }

    /**
     * Update database schema to include permissions (migration function)
     */
    async updateDatabaseSchema() {
        try {
            const setupCheck = await this.checkPermissionsSetup();
            
            if (!setupCheck.isSetup) {
                console.log('Setting up permissions system...');
                await this.initializePermissions();
                
                // Grant all permissions to the first user (admin)
                const adminStmt = this.db.prepare('SELECT id FROM users ORDER BY id LIMIT 1');
                adminStmt.get((err, adminUser) => {
                    if (!err && adminUser) {
                        this.grantAllPermissions(adminUser.id)
                            .then(() => {
                                console.log('Granted all permissions to admin user');
                            })
                            .catch((err) => {
                                console.error('Error granting admin permissions:', err);
                            });
                    }
                });
            } else {
                console.log('Permissions system already set up');
            }

            return true;
        } catch (error) {
            console.error('Error updating database schema for permissions:', error);
            return false;
        }
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
                    WHERE up.user_id = ? AND p.name = ?
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

    /**
     * Get permission children for a given permission (permissions that depend on this one)
     */
    getPermissionChildren(permissionName) {
        return this.permissionDependencies[permissionName] || [];
    }

    /**
     * Get permission parent for a given permission (permission this one depends on)
     */
    getPermissionParent(permissionName) {
        for (const [parent, children] of Object.entries(this.permissionDependencies)) {
            if (children.includes(permissionName)) {
                return parent;
            }
        }
        return null;
    }

    /**
     * Get all permissions with their children
     */
    getAllPermissionsWithChildren() {
        return new Promise((resolve, reject) => {
            this.getAllPermissions()
                .then(permissions => {
                    const permissionsWithChildren = permissions.map(permission => ({
                        ...permission,
                        children: this.getPermissionChildren(permission.name),
                        parent: this.getPermissionParent(permission.name)
                    }));
                    resolve(permissionsWithChildren);
                })
                .catch(reject);
        });
    }

    /**
     * Check if a user has all required parent permissions for a given permission
     */
    async hasRequiredParentPermissions(userId, permissionName) {
        const parent = this.getPermissionParent(permissionName);
        if (!parent) {
            return true; // No parent required
        }

        const hasParentPermission = await this.hasPermission(userId, parent);
        if (!hasParentPermission) {
            return false;
        }

        // Recursively check parent's parent
        return await this.hasRequiredParentPermissions(userId, parent);
    }

    /**
     * Get missing parent permissions for a user for a given permission
     */
    async getMissingParentPermissions(userId, permissionName) {
        const missing = [];
        let currentPermission = permissionName;
        
        while (true) {
            const parent = this.getPermissionParent(currentPermission);
            if (!parent) break;
            
            const hasPermission = await this.hasPermission(userId, parent);
            if (!hasPermission) {
                missing.unshift(parent); // Add to beginning for correct order
            }
            
            currentPermission = parent;
        }
        
        return missing;
    }

    /**
     * Check if removing a permission would break child dependencies
     */
    async wouldBreakChildDependencies(userId, permissionName) {
        const children = this.getPermissionChildren(permissionName);
        const breaking = [];

        for (const child of children) {
            const hasChild = await this.hasPermission(userId, child);
            if (hasChild) {
                breaking.push(child);
                // Recursively check grandchildren
                const grandchildrenBreaking = await this.wouldBreakChildDependencies(userId, child);
                breaking.push(...grandchildrenBreaking);
            }
        }
        return breaking;
    }

    /**
     * Get default permissions for new users
     * @returns {Array<string>} Array of default permission names
     */
    getDefaultPermissionsForNewUser() {
        // Default permissions for new users - basic dashboard access
        return [
            'view_dashboard',
            'create_signout',
            'sign_in_soldiers',
            'view_logs',
            'export_data',
            'view_settings',
            'change_own_credentials'
        ];
    }

    /**
     * Assign default permissions to a new user
     * @param {number} userId - User ID
     * @param {number} grantedBy - User ID who granted the permissions (usually admin)
     * @returns {Promise<boolean>}
     */
    async assignDefaultPermissions(userId, grantedBy = 1) {
        try {
            const defaultPermissions = this.getDefaultPermissionsForNewUser();
            return await this.grantMultiplePermissions(userId, defaultPermissions, grantedBy);
        } catch (error) {
            console.error('Error assigning default permissions:', error);
            return false;
        }
    }
}

module.exports = PermissionsManager;
