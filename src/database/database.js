const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const UserManager = require('./modules/user-manager');
const SignoutManager = require('./modules/signout-manager');
const PreferencesManager = require('./modules/preferences-manager');
const UtilitiesManager = require('./modules/utilities-manager');
const PermissionsManager = require('./modules/permissions-manager');
const AuditManager = require('./modules/audit-manager');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/soldiers.db');
        this.db = null;
        
        this.userManager = null;
        this.signoutManager = null;
        this.preferencesManager = null;
        this.utilitiesManager = null;
        this.permissionsManager = null;
        this.auditManager = null;
        
        this.init();
    }

    init() {
        const dataDir = path.dirname(this.dbPath);
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                throw err;
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
                this.initializeManagers();
            }
        });
    }

    initializeManagers() {
        this.permissionsManager = new PermissionsManager(this.db);
        this.auditManager = new AuditManager(this.db);
        this.userManager = new UserManager(this.db, this.permissionsManager);
        this.signoutManager = new SignoutManager(this.db);
        this.preferencesManager = new PreferencesManager(this.db);
        this.utilitiesManager = new UtilitiesManager(this.db);
        
        // Initialize permissions system after managers are created
        this.initializePermissionsSystem();
    }

    createTables() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                pin_hash TEXT NOT NULL,
                rank TEXT NOT NULL,
                full_name TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `;

        const createSignOutsTable = `
            CREATE TABLE IF NOT EXISTS signouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signout_id TEXT NOT NULL,
                soldier_rank TEXT NOT NULL,
                soldier_first_name TEXT NOT NULL,
                soldier_last_name TEXT NOT NULL,
                soldier_dod_id TEXT,
                location TEXT NOT NULL,
                location_options TEXT,
                sign_out_time DATETIME NOT NULL,
                sign_in_time DATETIME,
                signed_out_by_id INTEGER NOT NULL,
                signed_out_by_name TEXT NOT NULL,
                signed_in_by_id INTEGER,
                signed_in_by_name TEXT,
                status TEXT DEFAULT 'OUT' CHECK(status IN ('OUT', 'IN')),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (signed_out_by_id) REFERENCES users(id),
                FOREIGN KEY (signed_in_by_id) REFERENCES users(id)
            )
        `;

        const createUserPreferencesTable = `
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                setting_key TEXT NOT NULL,
                setting_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, setting_key)
            )
        `;

        const createAuditLogsTable = `
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id INTEGER,
                user_id INTEGER NOT NULL,
                user_name TEXT NOT NULL,
                old_values TEXT,
                new_values TEXT,
                description TEXT,
                ip_address TEXT,
                user_agent TEXT,
                session_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `;

        this.db.run(createUsersTable, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Users table ready');
                this.userManager && this.userManager.createDefaultAdmin();
            }
        });

        this.db.run(createSignOutsTable, (err) => {
            if (err) {
                console.error('Error creating signouts table:', err.message);
            } else {
                console.log('SignOuts table ready');
                this.utilitiesManager && this.utilitiesManager.migrateSignOutsTable();
            }
        });

        this.db.run(createUserPreferencesTable, (err) => {
            if (err) {
                console.error('Error creating user preferences table:', err.message);
            } else {
                console.log('User preferences table ready');
            }
        });

        this.db.run(createAuditLogsTable, (err) => {
            if (err) {
                console.error('Error creating audit logs table:', err.message);
            } else {
                console.log('Audit logs table ready');
            }
        });
    }

    async initializePermissionsSystem() {
        try {
            if (this.permissionsManager) {
                await this.permissionsManager.updateDatabaseSchema();
            }
        } catch (error) {
            console.error('Error initializing permissions system:', error);
        }
    }

    createDefaultAdmin() {
        return this.userManager.createDefaultAdmin();
    }
    
    verifySystemPassword(password, callback) {
        return this.userManager.verifySystemPassword(password, callback);
    }
    
    getAllUsers(callback) {
        return this.userManager.getAllUsers(callback);
    }
    
    getAllUsersExtended(callback) {
        return this.userManager.getAllUsersExtended(callback);
    }
    
    verifyUserPinById(userId, pin, callback) {
        return this.userManager.verifyUserPinById(userId, pin, callback);
    }

    authenticateUser(username, password, callback) {
        return this.userManager.authenticateUser(username, password, callback);
    }

    verifyUserPin(userId, pin, callback) {
        return this.userManager.verifyUserPin(userId, pin, callback);
    }

    createUser(userData, callback) {
        return this.userManager.createUser(userData, callback);
    }
    
    changeUserPin(userId, currentPin, newPin, callback) {
        return this.userManager.changeUserPin(userId, currentPin, newPin, callback);
    }
    
    changeUserPinAsAdmin(userId, newPin, adminUserId, callback) {
        return this.userManager.changeUserPinAsAdmin(userId, newPin, adminUserId, callback);
    }
    
    deleteUser(userId, userPin, systemPassword, callback) {
        return this.userManager.deleteUser(userId, userPin, systemPassword, callback);
    }
    
    deleteUserAsAdmin(userId, adminUserId, callback) {
        return this.userManager.deleteUserAsAdmin(userId, adminUserId, callback);
    }

    getAllSignOuts(callback) {
        return this.signoutManager.getAllSignOuts(callback);
    }
    
    getCurrentSignOuts(callback) {
        return this.signoutManager.getCurrentSignOuts(callback);
    }
    
    addSignOut(signOutData, callback) {
        return this.signoutManager.addSignOut(signOutData, callback);
    }
    
    signInSoldiers(signOutId, signedInById, signedInByName, callback) {
        return this.signoutManager.signInSoldiers(signOutId, signedInById, signedInByName, callback);
    }
    
    getSignOutById(signOutId, callback) {
        return this.signoutManager.getSignOutById(signOutId, callback);
    }
    
    getFilteredSignOuts(filters, callback) {
        return this.signoutManager.getFilteredSignOuts(filters, callback);
    }
    
    getIndividualSignOutRecords(filters, callback) {
        return this.signoutManager.getIndividualSignOutRecords(filters, callback);
    }
    
    generateSignOutId() {
        return this.signoutManager.generateSignOutId();
    }

    getUserPreference(userId, settingKey, callback) {
        return this.preferencesManager.getUserPreference(userId, settingKey, callback);
    }

    setUserPreference(userId, settingKey, settingValue, callback) {
        return this.preferencesManager.setUserPreference(userId, settingKey, settingValue, callback);
    }

    getUserPreferences(userId, callback) {
        return this.preferencesManager.getUserPreferences(userId, callback);
    }

    deleteUserPreference(userId, settingKey, callback) {
        return this.preferencesManager.deleteUserPreference(userId, settingKey, callback);
    }

    deleteAllUserPreferences(userId, callback) {
        return this.preferencesManager.deleteAllUserPreferences(userId, callback);
    }

    close() {
        return this.utilitiesManager.close();
    }
    
    migrateSignOutsTable() {
        return this.utilitiesManager.migrateSignOutsTable();
    }

    performSignOutsMigration() {
        return this.utilitiesManager.performSignOutsMigration();
    }

    clearOldRecords(cutoffDate, callback) {
        return this.utilitiesManager.clearOldRecords(cutoffDate, callback);
    }
    
    resetSystem(callback) {
        return this.utilitiesManager.resetSystem(callback);
    }

    getSystemSetting(key, callback) {
        return this.utilitiesManager.getSystemSetting(key, callback);
    }

    updateSystemSetting(key, value, callback) {
        return this.utilitiesManager.updateSystemSetting(key, value, callback);
    }

    exportSignoutsCSV(filters, requestedBy, callback) {
        return this.utilitiesManager.exportSignoutsCSV(filters, requestedBy, callback);
    }

    getSignOutsByIds(signOutIds, callback) {
        return this.utilitiesManager.getSignOutsByIds(signOutIds, callback);
    }

    getUserById(userId, callback) {
        return this.userManager.getUserById(userId, callback);
    }

    getUserByUsername(username, callback) {
        return this.userManager.getUserByUsername(username, callback);
    }

    updateUserStatus(userId, isActive, callback) {
        return this.userManager.updateUserStatus(userId, isActive, callback);
    }

    verifyUserPassword(userId, password, callback) {
        return this.userManager.verifyUserPassword(userId, password, callback);
    }

    updateAdminCredentials(userId, updates, callback) {
        return this.userManager.updateAdminCredentials(userId, updates, callback);
    }

    // Permissions methods
    async getUserPermissions(userId) {
        return this.permissionsManager ? await this.permissionsManager.getUserPermissions(userId) : [];
    }

    async hasPermission(userId, permission) {
        return this.permissionsManager ? await this.permissionsManager.hasPermission(userId, permission) : false;
    }

    async hasAllPermissions(userId, permissions) {
        return this.permissionsManager ? await this.permissionsManager.hasAllPermissions(userId, permissions) : false;
    }

    async hasAnyPermission(userId, permissions) {
        return this.permissionsManager ? await this.permissionsManager.hasAnyPermission(userId, permissions) : false;
    }

    async grantPermission(userId, permissionName, grantedBy) {
        return this.permissionsManager ? await this.permissionsManager.grantPermission(userId, permissionName, grantedBy) : false;
    }

    async grantMultiplePermissions(userId, permissionNames, grantedBy) {
        return this.permissionsManager ? await this.permissionsManager.grantMultiplePermissions(userId, permissionNames, grantedBy) : false;
    }

    async revokePermission(userId, permissionName) {
        return this.permissionsManager ? await this.permissionsManager.revokePermission(userId, permissionName) : false;
    }

    async revokeMultiplePermissions(userId, permissionNames) {
        return this.permissionsManager ? await this.permissionsManager.revokeMultiplePermissions(userId, permissionNames) : false;
    }

    async setUserPermissions(userId, permissionNames, grantedBy) {
        return this.permissionsManager ? await this.permissionsManager.setUserPermissions(userId, permissionNames, grantedBy) : false;
    }

    async getAllPermissions() {
        return this.permissionsManager ? await this.permissionsManager.getAllPermissions() : [];
    }

    async getAllPermissionsWithDependencies() {
        return this.permissionsManager ? await this.permissionsManager.getAllPermissionsWithDependencies() : [];
    }

    async getAllPermissionsWithChildren() {
        return this.permissionsManager ? await this.permissionsManager.getAllPermissionsWithChildren() : [];
    }

    async getUserPermissionsDetailed(userId) {
        return this.permissionsManager ? await this.permissionsManager.getUserPermissionsDetailed(userId) : [];
    }

    async getAllUsersWithPermissions() {
        return this.permissionsManager ? await this.permissionsManager.getAllUsersWithPermissions() : [];
    }

    async grantAllPermissions(userId, grantedBy) {
        return this.permissionsManager ? await this.permissionsManager.grantAllPermissions(userId, grantedBy) : false;
    }

    async grantBasicPermissions(userId, grantedBy) {
        return this.permissionsManager ? await this.permissionsManager.grantBasicPermissions(userId, grantedBy) : false;
    }

    async createPermission(name, description) {
        return this.permissionsManager ? await this.permissionsManager.createPermission(name, description) : null;
    }

    async updatePermission(permissionId, name, description) {
        return this.permissionsManager ? await this.permissionsManager.updatePermission(permissionId, name, description) : false;
    }

    async deletePermission(permissionId) {
        return this.permissionsManager ? await this.permissionsManager.deletePermission(permissionId) : false;
    }

    async getPermissionStats() {
        return this.permissionsManager ? await this.permissionsManager.getPermissionStats() : null;
    }

    async checkPermissionsSetup() {
        return this.permissionsManager ? await this.permissionsManager.checkPermissionsSetup() : { isSetup: false };
    }
}

module.exports = Database;
