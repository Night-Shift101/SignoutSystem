import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class PermissionsManager {
    constructor(app) {
        this.app = app;
        this.userPermissions = [];
        this.permissionsLoaded = false;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('PermissionsManager');
        this.initializeTooltipPositioning();
    }

    /**
     * Load permissions for the current user
     */
    async loadUserPermissions() {
        try {
            if (!this.app.currentUser) {
                console.warn('No current user found, cannot load permissions');
                return [];
            }

            const response = await Utils.fetchWithAuth(`/api/permissions/user/${this.app.currentUser.id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user permissions');
            }

            const result = await response.json();
            if (result.success) {
                this.userPermissions = result.permissions || [];
                this.permissionsLoaded = true;
                console.log('User permissions loaded:', this.userPermissions.length, 'permissions');
                return this.userPermissions;
            } else {
                throw new Error(result.error || 'Failed to load permissions');
            }
        } catch (error) {
            console.error('Error loading user permissions:', error);
            this.userPermissions = [];
            this.permissionsLoaded = false;
            return [];
        }
    }

    /**
     * Check if user has specific permission
     * @param {string} permission - Permission name
     * @returns {boolean}
     */
    hasPermission(permission) {
        if (!this.permissionsLoaded) {
            console.warn('Permissions not loaded yet for permission check:', permission);
            return false;
        }
        return this.userPermissions.includes(permission);
    }

    /**
     * Check if user has ALL specified permissions
     * @param {Array<string>} permissions - Array of permission names
     * @returns {boolean}
     */
    hasAllPermissions(permissions) {
        if (!this.permissionsLoaded) {
            console.warn('Permissions not loaded yet');
            return false;
        }
        return permissions.every(permission => this.userPermissions.includes(permission));
    }

    /**
     * Check if user has ANY of the specified permissions
     * @param {Array<string>} permissions - Array of permission names
     * @returns {boolean}
     */
    hasAnyPermission(permissions) {
        if (!this.permissionsLoaded) {
            console.warn('Permissions not loaded yet');
            return false;
        }
        return permissions.some(permission => this.userPermissions.includes(permission));
    }

    /**
     * Check if user is admin (has system_admin permission)
     * @returns {boolean}
     */
    isAdmin() {
        if (!this.permissionsLoaded) {
            return false;
        }
        return this.userPermissions.includes('system_admin');
    }

    /**
     * Check if user can create users
     * @returns {boolean}
     */
    canCreateUsers() {
        return this.hasPermission('create_users') || this.isAdmin();
    }

    /**
     * Check if user can delete users
     * @returns {boolean}
     */
    canDeleteUsers() {
        return this.hasPermission('delete_users') || this.isAdmin();
    }

    /**
     * Check if user can deactivate/reactivate users
     * @returns {boolean}
     */
    canDeactivateUsers() {
        return this.hasPermission('deactivate_users') || this.isAdmin();
    }

    /**
     * Check if user can perform any user management actions
     * @returns {boolean}
     */
    canManageUsers() {
        return this.canCreateUsers() || this.canDeleteUsers() || this.canDeactivateUsers() || this.isAdmin();
    }

    /**
     * Check if user can change PINs
     * @returns {boolean}
     */
    canChangePins() {
        return this.hasPermission('change_user_pins') || this.isAdmin();
    }

    /**
     * Check if user can change their own credentials
     * @returns {boolean}
     */
    canChangeOwnCredentials() {
        return this.hasPermission('change_own_credentials') || this.isAdmin();
    }

    /**
     * Check if user can manage permissions
     * @returns {boolean}
     */
    canManagePermissions() {
        return this.hasPermission('manage_permissions') || this.isAdmin();
    }

    /**
     * Check if user can view settings
     * @returns {boolean}
     */
    canViewSettings() {
        return this.hasPermission('view_settings') || this.isAdmin();
    }

    /**
     * Check if user can view audit logs
     * @returns {boolean}
     */
    canViewAuditLogs() {
        return this.hasPermission('view_audit_logs') || this.isAdmin();
    }

    /**
     * Get all available permissions
     */
    async getAllPermissions() {
        try {
            const response = await Utils.fetchWithAuth('/api/permissions');
            if (!response.ok) {
                throw new Error('Failed to fetch permissions');
            }

            const result = await response.json();
            if (result.success) {
                return result.permissions || [];
            } else {
                throw new Error(result.error || 'Failed to load permissions');
            }
        } catch (error) {
            console.error('Error loading all permissions:', error);
            return [];
        }
    }

    /**
     * Update permissions for a user
     * @param {number} userId - User ID
     * @param {Array<string>} permissions - Array of permission names
     */
    async updateUserPermissions(userId, permissions) {
        try {
            const response = await Utils.fetchWithAuth(`/api/permissions/user/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permissions: permissions,
                    grantedBy: this.app.currentUser.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update permissions');
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to update permissions');
            }

            return result;
        } catch (error) {
            console.error('Error updating user permissions:', error);
            throw error;
        }
    }

    /**
     * Apply permission-based visibility to elements
     */
    applyPermissionBasedVisibility() {
        // Don't apply restrictions if permissions aren't loaded yet
        if (!this.permissionsLoaded) {
            console.log('Permissions not loaded yet, skipping visibility application');
            return;
        }

        // Elements that should be disabled instead of hidden
        const elementsToDisable = [
            { 
                selector: '#newSignOutBtn', 
                permission: 'create_signout',
                reason: 'You do not have permission to create new sign-outs'
            },
            {
                selector: '.sign-in-btn',
                permission: 'sign_in_soldiers',
                reason: 'You do not have permission to sign soldiers back in'
            }
        ];

        // Elements that should be hidden when no permission
        const elementsToHide = [
            { selector: '#addUserBtn', permission: 'create_users' },
            { selector: '.activate-user-btn', permission: 'deactivate_users' },
            { selector: '.manage-permissions-btn', permission: 'manage_permissions' },
            { selector: '#settingsBtn', permission: 'view_settings' },
            { selector: '#logsBtn', permission: 'view_logs' },
            { selector: '#exportCsvBtn', permission: 'export_data' },
            { selector: '#exportLogsPdfBtn', permission: 'export_data' }
        ];

        // Elements that should be disabled for current user (even with permission)
        const elementsToDisableForCurrentUser = [
            { 
                selector: '.delete-user-btn', 
                permission: 'delete_users',
                reason: 'You cannot delete your own account'
            },
            { 
                selector: '.deactivate-user-btn', 
                permission: 'deactivate_users',
                reason: 'You cannot deactivate your own account'
            },
            { 
                selector: '.change-pin-btn', 
                permission: 'change_user_pins',
                reason: 'You cannot change your own PIN through this interface'
            }
        ];

        // Handle elements that should be disabled
        elementsToDisable.forEach(({ selector, permission, reason }) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const hasAccess = this.hasPermission(permission) || this.isAdmin();
                if (hasAccess) {
                    element.style.display = '';
                    element.disabled = false;
                    element.classList.remove('disabled-no-permission', 'permission-disabled');
                    element.removeAttribute('data-disabled-reason');
                    element.style.cursor = '';
                } else {
                    element.style.display = '';
                    element.disabled = true;
                    element.classList.add('disabled-no-permission', 'permission-disabled');
                    element.setAttribute('data-disabled-reason', reason);
                    element.style.cursor = 'not-allowed';
                }
            });
        });

        // Handle elements that should be hidden
        elementsToHide.forEach(({ selector, permission }) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const hasAccess = this.hasPermission(permission) || this.isAdmin();
                if (hasAccess) {
                    element.style.display = '';
                    element.disabled = false;
                } else {
                    element.style.display = 'none';
                }
            });
        });

        // Handle elements that should be disabled for current user
        elementsToDisableForCurrentUser.forEach(({ selector, permission, reason }) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                const hasPermission = this.hasPermission(permission) || this.isAdmin();
                
                if (!hasPermission) {
                    // Hide if no permission at all
                    element.style.display = 'none';
                    return;
                }
                
                // Check if this is the current user's button
                const userId = element.getAttribute('data-user-id');
                const isCurrentUser = userId && parseInt(userId) === this.app.currentUser?.id;
                
                if (isCurrentUser) {
                    // Show but disable for current user
                    element.style.display = '';
                    element.disabled = true;
                    element.classList.add('disabled-no-permission', 'permission-disabled');
                    element.setAttribute('data-disabled-reason', reason);
                    element.style.cursor = 'not-allowed';
                } else {
                    // Enable for other users
                    element.style.display = '';
                    element.disabled = false;
                    element.classList.remove('disabled-no-permission', 'permission-disabled');
                    element.removeAttribute('data-disabled-reason');
                    element.style.cursor = '';
                }
            });
        });

        // Special cases for admin-only elements
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(element => {
            if (this.isAdmin()) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }

    /**
     * Show permission denied message
     * @param {string} action - Action that was denied
     */
    showPermissionDenied(action = 'perform this action') {
        this.app.notificationManager.showNotification(
            `You don't have permission to ${action}`, 
            'error'
        );
    }

    /**
     * Fetch all available permissions from server (with dependencies)
     */
    async fetchAllPermissions() {
        try {
            const response = await Utils.fetchWithAuth('/api/permissions');
            if (!response.ok) {
                throw new Error('Failed to fetch permissions');
            }

            const result = await response.json();
            if (result.success) {
                return result.permissions || [];
            } else {
                throw new Error(result.error || 'Failed to load permissions');
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
            return [];
        }
    }

    /**
     * Get permission children
     */
    getPermissionChildren(permissionName) {
        // Children are defined on the backend and included in permission objects
        // This is a fallback if they're not included
        const children = {
            'view_dashboard': ['create_signout', 'sign_in_soldiers'],
            'view_logs': ['export_data'],
            'view_settings': ['change_own_credentials','create_users', 'delete_users', 'deactivate_users', 'change_user_pins', 'manage_permissions']
        };
        return children[permissionName] || [];
    }

    /**
     * Get permission parent
     */
    getPermissionParent(permissionName) {
        const dependencies = {
            'create_signout': 'view_dashboard',
            'sign_in_soldiers': 'view_dashboard',
            'export_data': 'view_logs',
            'create_users': 'view_settings',
            'delete_users': 'view_settings',
            'deactivate_users': 'view_settings',
            'change_user_pins': 'view_settings',
            'manage_permissions': 'view_settings',
            'change_own_credentials': 'view_settings'
        };
        return dependencies[permissionName] || null;
    }

    /**
     * Get all permissions that are children of a given permission
     */
    getPermissionAllChildren(permissionName, allPermissions) {
        const children = [];
        for (const permission of allPermissions) {
            const permChildren = permission.children || this.getPermissionChildren(permission.name);
            if (permChildren.includes(permissionName)) {
                children.push(permission.name);
            }
        }
        return children;
    }

    /**
     * Check if enabling a permission would require enabling parents
     */
    getRequiredParents(permissionName, currentPermissions, allPermissions) {
        const permission = allPermissions.find(p => p.name === permissionName);
        const parent = permission?.parent || this.getPermissionParent(permissionName);
        
        if (!parent) return [];
        
        const required = [];
        if (!currentPermissions.includes(parent)) {
            required.push(parent);
            // Recursively check parent's parent
            const grandParents = this.getRequiredParents(parent, currentPermissions, allPermissions);
            required.unshift(...grandParents);
        }
        
        return required;
    }

    /**
     * Check if disabling a permission would break children
     */
    getBreakingChildren(permissionName, currentPermissions, allPermissions) {
        const children = this.getPermissionChildren(permissionName);
        const breaking = [];
        
        for (const child of children) {
            if (currentPermissions.includes(child)) {
                breaking.push(child);
                // Recursively check grandchildren
                const grandChildren = this.getBreakingChildren(child, currentPermissions, allPermissions);
                breaking.push(...grandChildren);
            }
        }
        
        return breaking;
    }

    /**
     * Initialize tooltip positioning for disabled buttons
     */
    initializeTooltipPositioning() {
        // Add event listeners for dynamic tooltip positioning
        document.addEventListener('mouseenter', (e) => {
            // Defensive check - ensure target exists and has classList
            if (e.target && e.target.classList && e.target.classList.contains('disabled-no-permission')) {
                this.positionTooltip(e.target);
            }
        }, true);
        
        document.addEventListener('mouseleave', (e) => {
            // Defensive check - ensure target exists and has classList
            if (e.target && e.target.classList && e.target.classList.contains('disabled-no-permission')) {
                this.hideTooltip(e.target);
            }
        }, true);
    }
    
    /**
     * Position tooltip dynamically based on button position
     */
    positionTooltip(button) {
        // Defensive check - ensure button exists and has required methods
        if (!button || !button.getBoundingClientRect || !button.style) {
            console.warn('PermissionsManager: Invalid button element for tooltip positioning');
            return;
        }

        try {
            const rect = button.getBoundingClientRect();
            
            // Use CSS custom properties to position the tooltip
            button.style.setProperty('--tooltip-left', `${rect.left + rect.width / 2}px`);
            button.style.setProperty('--tooltip-top', `${rect.top - 40}px`);
        } catch (error) {
            console.warn('PermissionsManager: Error positioning tooltip:', error);
        }
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip(button) {
        // Defensive check - ensure button exists
        if (!button) {
            return;
        }
        // Tooltip hiding is handled by CSS :hover state
    }
}

export default PermissionsManager;
