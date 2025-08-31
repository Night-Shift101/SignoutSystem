/**
 * Audit Manager
 * Handles logging of all system changes for audit trail
 */

class AuditManager {
    constructor(db) {
        this.db = db;
    }

    /**
     * Log an audit event
     * @param {Object} auditData - Audit data object
     * @param {string} auditData.actionType - Type of action (CREATE, UPDATE, DELETE, etc.)
     * @param {string} auditData.tableName - Table that was affected
     * @param {number|null} auditData.recordId - ID of affected record
     * @param {number} auditData.userId - ID of user who performed action
     * @param {string} auditData.userName - Name of user who performed action
     * @param {Object|null} auditData.oldValues - Previous values (for updates/deletes)
     * @param {Object|null} auditData.newValues - New values (for creates/updates)
     * @param {string} auditData.description - Human-readable description
     * @param {string|null} auditData.ipAddress - User's IP address
     * @param {string|null} auditData.userAgent - User's browser info
     * @param {string|null} auditData.sessionId - Session identifier
     * @param {Function} callback - Callback function (optional)
     */
    logAuditEvent(auditData, callback) {
        const {
            actionType,
            tableName,
            recordId = null,
            userId,
            userName,
            oldValues = null,
            newValues = null,
            description,
            ipAddress = null,
            userAgent = null,
            sessionId = null
        } = auditData;

        // Validate required fields
        if (!actionType || !tableName || !userId || !userName) {
            const error = new Error('Missing required audit fields: actionType, tableName, userId, and userName are required');
            console.error('Audit logging error:', error.message, auditData);
            if (typeof callback === 'function') {
                callback(error);
            }
            return;
        }

        const query = `
            INSERT INTO audit_logs (
                action_type, table_name, record_id, user_id, user_name,
                old_values, new_values, description, ip_address, user_agent, session_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            actionType,
            tableName,
            recordId,
            userId,
            userName,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            description,
            ipAddress,
            userAgent,
            sessionId
        ];

        this.db.run(query, values, function(err) {
            if (err) {
                console.error('Error logging audit event:', err);
                if (typeof callback === 'function') {
                    callback(err);
                }
                return;
            }
            
            console.log(`Audit logged: ${actionType} on ${tableName} by ${userName}`);
            if (typeof callback === 'function') {
                callback(null, { auditId: this.lastID });
            }
        });
    }    /**
     * Get audit logs with filtering, search, and pagination
     * @param {Object} options - Query options
     * @param {number} options.limit - Maximum number of records (default: 50)
     * @param {number} options.offset - Offset for pagination (default: 0)
     * @param {Object} options.filters - Filter criteria
     * @param {string|null} options.filters.action_type - Filter by action type
     * @param {string|null} options.filters.table_name - Filter by table name
     * @param {number|null} options.filters.user_id - Filter by user ID
     * @param {string|null} options.filters.start_date - Start date for filtering
     * @param {string|null} options.filters.end_date - End date for filtering
     * @param {string|null} options.filters.search - Search term for descriptions and user names
     * @param {Function} callback - Callback function (err, logs, totalCount)
     */
    getAuditLogs(options = {}, callback) {
        if (typeof callback !== 'function') {
            console.error('getAuditLogs requires a callback function');
            return;
        }

        const {
            limit = 50,
            offset = 0,
            filters = {}
        } = options;

        const {
            action_type,
            table_name,
            user_id,
            start_date,
            end_date,
            search
        } = filters;

        // Build the base query
        let whereClause = 'WHERE 1=1';
        const queryParams = [];

        // Add filter conditions
        if (action_type) {
            whereClause += ' AND action_type = ?';
            queryParams.push(action_type);
        }

        if (table_name) {
            whereClause += ' AND table_name = ?';
            queryParams.push(table_name);
        }

        if (user_id) {
            whereClause += ' AND user_id = ?';
            queryParams.push(user_id);
        }

        if (start_date) {
            whereClause += ' AND timestamp >= ?';
            queryParams.push(start_date);
        }

        if (end_date) {
            whereClause += ' AND timestamp <= ?';
            queryParams.push(end_date);
        }

        if (search) {
            whereClause += ' AND (description LIKE ? OR user_name LIKE ?)';
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        // First, get the total count
        const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
        
        this.db.get(countQuery, queryParams, (err, countResult) => {
            if (err) {
                console.error('Error getting audit logs count:', err);
                callback(err, null, 0);
                return;
            }

            const totalCount = countResult.total;

            // Then get the actual records with pagination
            const dataQuery = `
                SELECT 
                    id,
                    action_type,
                    table_name,
                    record_id,
                    user_id,
                    user_name,
                    old_values,
                    new_values,
                    description,
                    ip_address,
                    user_agent,
                    session_id,
                    timestamp
                FROM audit_logs
                ${whereClause}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `;

            const dataParams = [...queryParams, limit, offset];

            this.db.all(dataQuery, dataParams, (err, rows) => {
                if (err) {
                    console.error('Error retrieving audit logs:', err);
                    callback(err, null, totalCount);
                    return;
                }

                // Parse JSON values back to objects and format timestamps as ISO strings
                const processedRows = rows.map(row => ({
                    ...row,
                    old_values: row.old_values ? JSON.parse(row.old_values) : null,
                    new_values: row.new_values ? JSON.parse(row.new_values) : null,
                    // Convert SQLite timestamp to proper ISO string (SQLite CURRENT_TIMESTAMP is UTC)
                    timestamp: row.timestamp ? new Date(row.timestamp + ' UTC').toISOString() : null
                }));

                callback(null, processedRows, totalCount);
            });
        });
    }    /**
     * Get audit log statistics
     * @param {Function} callback - Callback function
     */
    getAuditStats(callback) {
        if (typeof callback !== 'function') {
            console.error('getAuditStats requires a callback function');
            return;
        }

        const query = `
            SELECT 
                action_type,
                table_name,
                COUNT(*) as count,
                DATE(timestamp) as date
            FROM audit_logs 
            WHERE timestamp >= date('now', '-30 days')
            GROUP BY action_type, table_name, DATE(timestamp)
            ORDER BY timestamp DESC
        `;

        this.db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Error retrieving audit stats:', err);
                callback(err, null);
                return;
            }

            callback(null, rows);
        });
    }

    /**
     * Helper method to create audit log for user changes
     * @param {string} actionType - CREATE, UPDATE, DELETE
     * @param {Object} userRecord - User record data
     * @param {Object} oldValues - Old values (for updates)
     * @param {Object} newValues - New values (for creates/updates)
     * @param {Object} auditContext - Context (userId, userName, etc.)
     * @param {Function} callback - Callback function
     */
    logUserChange(actionType, userRecord, oldValues, newValues, auditContext, callback) {
        const description = this.generateUserChangeDescription(actionType, userRecord, oldValues, newValues);
        
        this.logAuditEvent({
            actionType,
            tableName: 'users',
            recordId: userRecord.id,
            userId: auditContext.userId,
            userName: auditContext.userName,
            oldValues,
            newValues,
            description: description,
            ipAddress: auditContext.ipAddress ? auditContext.ipAddress : "Unknown IP Address",
            userAgent: auditContext.userAgent ? auditContext.userAgent : "Unknown User",
            sessionId: auditContext.sessionId ? auditContext.sessionId : "Unknown Session ID"
        }, callback);
    }

    /**
     * Generate human-readable description for user changes
     * @private
     */
    generateUserChangeDescription(actionType, userRecord, oldValues, newValues) {
        switch (actionType) {
            case 'CREATE':
                return `Created user account for ${newValues.rank} ${newValues.full_name} (${newValues.username})`;
            case 'UPDATE':
                const changes = [];
                
                // Handle case where oldValues might be null (e.g., for security-sensitive changes like PIN)
                if (!oldValues) {
                    // If we have newValues but no oldValues, this is likely a security-sensitive update
                    if (newValues && newValues.pin_hash) {
                        changes.push('PIN changed');
                    }
                    if (newValues && newValues.password_hash) {
                        changes.push('password changed');
                    }
                    // If no specific changes detected, use generic message
                    if (changes.length === 0) {
                        changes.push('credentials updated');
                    }
                } else {
                    // Normal update with full comparison
                    if (oldValues.rank !== newValues.rank) {
                        changes.push(`rank: ${oldValues.rank} → ${newValues.rank}`);
                    }
                    if (oldValues.full_name !== newValues.full_name) {
                        changes.push(`name: ${oldValues.full_name} → ${newValues.full_name}`);
                    }
                    if (oldValues.is_active !== newValues.is_active) {
                        changes.push(`status: ${oldValues.is_active ? 'active' : 'inactive'} → ${newValues.is_active ? 'active' : 'inactive'}`);
                    }
                    if (newValues.pin_hash && oldValues.pin_hash !== newValues.pin_hash) {
                        changes.push('PIN changed');
                    }
                }
                
                return `Updated ${userRecord.rank} ${userRecord.full_name}: ${changes.join(', ')}`;
            case 'DELETE':
                return `Deleted user account for ${oldValues.rank} ${oldValues.full_name} (${oldValues.username})`;
            default:
                return `${actionType} operation on user ${userRecord.rank} ${userRecord.full_name}`;
        }
    }

    /**
     * Backward-compatible method for simple audit logging
     * @param {string} actionType - Action type
     * @param {string} tableName - Table name  
     * @param {number|null} recordId - Record ID
     * @param {string} description - Description
     * @param {Object} auditContext - Audit context with user info
     * @param {Function} callback - Optional callback
     */
    logSimpleAuditEvent(actionType, tableName, recordId, description, auditContext, callback) {
        // If auditContext doesn't have required fields, provide defaults
        const context = auditContext || {};
        
        this.logAuditEvent({
            actionType,
            tableName,
            recordId,
            userId: context.userId || context.user_id || 1, // Default to system user if missing
            userName: context.userName || context.user_name || 'System',
            oldValues: null,
            newValues: null,
            description,
            ipAddress: context.ipAddress || context.ip_address,
            userAgent: context.userAgent || context.user_agent,
            sessionId: context.sessionId || context.session_id
        }, callback);
    }
}

module.exports = AuditManager;
