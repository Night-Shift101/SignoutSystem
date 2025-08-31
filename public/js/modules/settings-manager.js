import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class SettingsManager {
    constructor(app) {
        this.app = app;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('SettingsManager');
    }

    async loadSettingsData() {
        try {
            const currentUserDisplay = this.app.domManager.get('currentUserDisplay');
            const myAccountUserDisplay = this.app.domManager.get('myAccountUserDisplay');
            
            if (currentUserDisplay && this.app.currentUser) {
                currentUserDisplay.textContent = `${this.app.currentUser.rank} ${this.app.currentUser.full_name}`;
            }
            
            if (myAccountUserDisplay && this.app.currentUser) {
                myAccountUserDisplay.textContent = `${this.app.currentUser.rank} ${this.app.currentUser.full_name}`;
            }
            
            // Handle My Account section visibility
            this.initializeMyAccountSection();
            
            await this.loadAccountsList();
            
            // Initialize audit logs if user has permission
            if (this.app.auditLogsManager) {
                await this.app.auditLogsManager.initializeAuditLogs();
            }
            
            // Reapply permission-based visibility after settings load
            if (this.app.permissionsManager) {
                this.app.permissionsManager.applyPermissionBasedVisibility();
            }
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.app.notificationManager.showNotification('Failed to load settings', 'error');
        }
    }

    async loadAccountsList() {
        try {
            const accountsTableBody = this.app.domManager.get('accountsTableBody');
            const accountsEmptyState = this.app.domManager.get('accountsEmptyState');
            
            if (!accountsTableBody) {
                return;
            }

            const response = await Utils.fetchWithAuth('/api/users');
            
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            
            const result = await response.json();
            
            // Handle standardized response format
            if (!result.success) {
                console.error('Error loading user accounts:', result.error || 'Unknown error');
                throw new Error(result.error || 'Failed to load user accounts');
            }
            
            const users = result.data; // Extract users from standardized response
            
            // Validate that we received valid users data
            if (!users || !Array.isArray(users)) {
                console.error('Error loading user accounts: Invalid users data', result);
                throw new Error('Invalid user data received from server');
            }
            
            if (users.length === 0) {
                accountsTableBody.innerHTML = '';
                if (accountsEmptyState) accountsEmptyState.style.display = 'block';
                return;
            }
            
            if (accountsEmptyState) accountsEmptyState.style.display = 'none';
            
            accountsTableBody.innerHTML = users.map(user => {
                const isCurrentUser = this.app.currentUser && this.app.currentUser.id === user.id;
                const isAdminUser = user.username === 'admin';
                const statusClass = user.is_active ? 'status-active' : 'status-inactive';
                const statusText = user.is_active ? 'Active' : 'Inactive';
                
                // Check permissions
                const canChangePins = this.app.permissionsManager?.canChangePins() || false;
                const canCreateUsers = this.app.permissionsManager?.canCreateUsers() || false;
                const canDeleteUsers = this.app.permissionsManager?.canDeleteUsers() || false;
                const canDeactivateUsers = this.app.permissionsManager?.canDeactivateUsers() || false;
                const canManagePermissions = this.app.permissionsManager?.canManagePermissions() || false;
                const isSystemAdmin = this.app.permissionsManager?.isAdmin() || false;
                
                return `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.rank}</td>
                        <td>${user.full_name}</td>
                        <td>${user.role || (user.username === 'admin' ? 'Admin' : 'User')}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${Utils.formatDate(user.created_at)}</td>
                        <td>
                            <div class="action-buttons">
                                ${isAdminUser ? `
                                    ${isSystemAdmin ? `
                                        <button class="btn btn-sm btn-primary change-admin-credentials-btn" 
                                                data-user-id="${user.id}">
                                            Change Credentials
                                        </button>
                                    ` : ''}
                                ` : `
                                    ${canChangePins ? `
                                        <button class="btn btn-sm btn-secondary change-pin-btn" 
                                                data-user-id="${user.id}" 
                                                data-user-name="${user.rank} ${user.full_name}">
                                            Change PIN
                                        </button>
                                    ` : ''}
                                    ${canManagePermissions && !isCurrentUser ? `
                                        <button class="btn btn-sm btn-info manage-permissions-btn" 
                                                data-user-id="${user.id}" 
                                                data-user-name="${user.rank} ${user.full_name}">
                                            Permissions
                                        </button>
                                    ` : ''}
                                    ${canDeactivateUsers ? `
                                        ${user.is_active ? `
                                            <button class="btn btn-sm btn-warning deactivate-user-btn" 
                                                    data-user-id="${user.id}" 
                                                    data-user-name="${user.rank} ${user.full_name}">
                                                Deactivate
                                            </button>
                                        ` : `
                                            <button class="btn btn-sm btn-success activate-user-btn" 
                                                    data-user-id="${user.id}" 
                                                    data-user-name="${user.rank} ${user.full_name}">
                                                Activate
                                            </button>
                                        `}
                                    ` : ''}
                                    ${canDeleteUsers ? `
                                        <button class="btn btn-sm btn-danger delete-user-btn" 
                                                data-user-id="${user.id}" 
                                                data-user-name="${user.rank} ${user.full_name}">
                                            Delete
                                        </button>
                                    ` : ''}
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // Reapply permission-based visibility after loading accounts
            setTimeout(() => {
                if (this.app.permissionsManager) {
                    this.app.permissionsManager.applyPermissionBasedVisibility();
                }
            }, 100);
            
        } catch (error) {
            console.error('Error loading user accounts:', error);
            this.app.notificationManager.showNotification('Failed to load user accounts', 'error');
        }
    }
    
    /**
     * Initialize My Account section (called when settings are loaded)
     */
    initializeMyAccountSection() {
        try {
            const myAccountSection = document.getElementById('myAccountSection');
            
            if (!myAccountSection) {
                return;
            }
            
            // Check if user has permission to change their own credentials
            const canChangeOwnCredentials = this.app.permissionsManager?.canChangeOwnCredentials() || false;
            
            if (canChangeOwnCredentials) {
                // Show My Account section
                myAccountSection.style.display = 'block';
            } else {
                // Hide My Account section if user doesn't have permission
                myAccountSection.style.display = 'none';
            }

        } catch (error) {
            console.error('Error initializing My Account section:', error);
        }
    }

    async reloadAccountsList() {
        await this.loadAccountsList();
    }
}

export default SettingsManager;
