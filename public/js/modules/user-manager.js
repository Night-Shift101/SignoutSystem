import Utils from './utils.js';
import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class UserManager {
    constructor(app) {
        this.app = app;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('UserManager');
    }

    async loadUsers() {
        try {
            const usersList = this.app.domManager.get('usersList');
            if (usersList) {
                usersList.innerHTML = '<div class="users-loading">Loading users...</div>';
            }
            
            const result = await Utils.safeApiCall('/api/users', {}, 'Load users');
            
            if (!result.success) {
                const usersList = this.app.domManager.get('usersList');
                if (usersList) {
                    usersList.innerHTML = '<div class="users-error">Failed to load users</div>';
                }
                return result;
            }
            
            this.renderUsersList(result.data);
            return this.errorHandler.success(result.data, 'Users loaded successfully');
            
        } catch (error) {
            console.error('Error loading users:', error);
            const usersList = this.app.domManager.get('usersList');
            if (usersList) {
                usersList.innerHTML = '<div class="users-error">Failed to load users</div>';
            }
            return this.errorHandler.failure('Failed to load users', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.MEDIUM,
                originalError: error
            });
        }
    }

    renderUsersList(users) {
        const usersList = this.app.domManager.get('usersList');
        if (!usersList) return;

        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="users-error">No users found</div>';
            return;
        }

        usersList.innerHTML = users.map(user => {
            const isCurrent = this.app.currentUser && this.app.currentUser.id === user.id;
            const isDisabled = user.is_active === 0 || user.is_active === false;
            return `
                <button class="user-item ${isCurrent ? 'current' : ''} ${isDisabled ? 'disabled' : ''}" data-user-id="${user.id}">
                    <div class="user-item-content">
                        <div class="user-item-name">${user.rank} ${user.full_name}</div>
                    </div>
                    ${isCurrent ? '<span class="user-item-indicator current">●</span>' : ''}
                    ${isDisabled ? '<span class="user-item-indicator disabled">●</span>' : ''}
                </button>
            `;
        }).join('');

        usersList.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const userId = parseInt(e.currentTarget.dataset.userId);
                const user = users.find(u => u.id === userId);
                
                // Prevent interaction with disabled users
                if (user && (user.is_active === 0 || user.is_active === false)) {
                    this.app.notificationManager?.showNotification('This account is disabled', 'error');
                    return;
                }
                
                if (user && user.id !== this.app.currentUser?.id) {
                    this.app.authManager.promptUserSwitch(user);
                }
                this.app.viewManager.closeUserSelector();
            });
        });
    }

    async handleAddUser() {
        console.log('Handling add user');
        
        // Check permissions using error handler
        if (!this.app.permissionsManager?.canManageUsers()) {
            this.app.permissionsManager?.showPermissionDenied('add users');
            return this.errorHandler.permissionError('Insufficient permissions to add users', 'user.create');
        }
        
        try {
            const addUserForm = this.app.domManager.get('addUserForm');
            const submitAddUser = this.app.domManager.get('submitAddUser');
            
            const formData = new FormData(addUserForm);
            const userData = {
                rank: formData.get('rank'),
                lastName: formData.get('lastName'),
                pin: formData.get('pin'),
                confirmPin: formData.get('confirmPin')
            };

            // Validate required fields
            const requiredFields = ['rank', 'lastName', 'pin', 'confirmPin'];
            const missingFields = requiredFields.filter(field => !userData[field] || userData[field].trim() === '');
            
            if (missingFields.length > 0) {
                const errorMessage = `Please fill in all required fields: ${missingFields.join(', ')}`;
                this.showAddUserError(errorMessage);
                return this.errorHandler.validationError(errorMessage, false);
            }

            // Validate PIN format
            if (!/^\d{4,}$/.test(userData.pin)) {
                const errorMessage = 'PIN must be at least 4 digits';
                this.showAddUserError(errorMessage);
                return this.errorHandler.validationError(errorMessage, false);
            }

            // Validate PIN confirmation
            if (userData.pin !== userData.confirmPin) {
                const errorMessage = 'PINs do not match';
                this.showAddUserError(errorMessage);
                return this.errorHandler.validationError(errorMessage, false);
            }

            Utils.showLoading(true);
            if (submitAddUser) {
                submitAddUser.disabled = true;
                submitAddUser.textContent = 'Creating...';
            }

            const result = await Utils.safeApiCall('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rank: userData.rank,
                    lastName: userData.lastName,
                    pin: userData.pin
                })
            }, 'Create user');

            if (!result.success) {
                this.showAddUserError(result.error || 'Failed to create user');
                return result;
            }

            // Success - close modal and update UI
            this.app.modalManager.closeAddUserModal();
            this.app.settingsManager.reloadAccountsList();
            
            return this.errorHandler.success(result.data, 'User created successfully', true);

        } catch (error) {
            console.error('Error creating user:', error);
            this.showAddUserError('An unexpected error occurred');
            return this.errorHandler.failure('Failed to create user', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.MEDIUM,
                originalError: error
            });
        } finally {
            Utils.showLoading(false);
            const submitAddUser = this.app.domManager.get('submitAddUser');
            if (submitAddUser) {
                submitAddUser.disabled = false;
                submitAddUser.textContent = 'Add User';
            }
        }
    }

    showAddUserError(message) {
        const addUserError = this.app.domManager.get('addUserError');
        if (addUserError) {
            addUserError.textContent = message;
            addUserError.style.display = 'block';
        }
    }

    async handleChangePin() {
        console.log('Handling change PIN');
        
        // Check permissions
        if (!this.app.permissionsManager?.canChangePins()) {
            this.app.permissionsManager?.showPermissionDenied('change user PINs');
            return;
        }
        
        try {
            const changePinForm = this.app.domManager.get('changePinForm');
            const submitChangePin = this.app.domManager.get('submitChangePin');
            
            const formData = new FormData(changePinForm);
            const changePinData = {
                userId: formData.get('userId'),
                systemPassword: formData.get('systemPassword'),
                newPin: formData.get('newPin'),
                confirmNewPin: formData.get('confirmNewPin')
            };

            const requiredFields = ['userId', 'systemPassword', 'newPin', 'confirmNewPin'];
            const missingFields = requiredFields.filter(field => !changePinData[field] || changePinData[field].trim() === '');
            
            if (missingFields.length > 0) {
                this.showChangePinError('Please fill in all required fields');
                return;
            }

            if (!/^\d{4,}$/.test(changePinData.newPin)) {
                this.showChangePinError('PIN must be at least 4 digits');
                return;
            }

            if (changePinData.newPin !== changePinData.confirmNewPin) {
                this.showChangePinError('PINs do not match');
                return;
            }

            Utils.showLoading(true);
            if (submitChangePin) {
                submitChangePin.disabled = true;
                submitChangePin.textContent = 'Changing...';
            }

            const response = await Utils.fetchWithAuth(`/api/users/${changePinData.userId}/pin`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPassword: changePinData.systemPassword,
                    newPin: changePinData.newPin
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to change PIN');
            }

            this.app.modalManager.closeChangePinModal();
            this.app.notificationManager.showNotification('PIN changed successfully', 'success');
            this.app.settingsManager.reloadAccountsList();

        } catch (error) {
            console.error('Error changing PIN:', error);
            this.showChangePinError(error.message || 'Failed to change PIN');
        } finally {
            Utils.showLoading(false);
            const submitChangePin = this.app.domManager.get('submitChangePin');
            if (submitChangePin) {
                submitChangePin.disabled = false;
                submitChangePin.textContent = 'Change PIN';
            }
        }
    }

    showChangePinError(message) {
        const changePinError = this.app.domManager.get('changePinError');
        if (changePinError) {
            changePinError.textContent = message;
            changePinError.style.display = 'block';
        }
    }

    async handleDeleteUser() {
        console.log('Handling delete user');
        
        // Check permissions
        if (!this.app.permissionsManager?.canManageUsers()) {
            this.app.permissionsManager?.showPermissionDenied('delete users');
            return;
        }
        
        try {
            const deleteUserForm = this.app.domManager.get('deleteUserForm');
            const submitDeleteUser = this.app.domManager.get('submitDeleteUser');
            
            const formData = new FormData(deleteUserForm);
            const deleteData = {
                userId: formData.get('userId'),
                systemPassword: formData.get('systemPassword')
            };

            if (!deleteData.systemPassword || deleteData.systemPassword.trim() === '') {
                this.showDeleteUserError('Please enter the system password');
                return;
            }

            Utils.showLoading(true);
            if (submitDeleteUser) {
                submitDeleteUser.disabled = true;
                submitDeleteUser.textContent = 'Deleting...';
            }

            const response = await Utils.fetchWithAuth(`/api/users/${deleteData.userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPassword: deleteData.systemPassword
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete user');
            }

            this.app.modalManager.closeDeleteUserModal();
            this.app.settingsManager.reloadAccountsList();
            this.app.notificationManager.showNotification('User deleted successfully', 'success');

        } catch (error) {
            console.error('Error deleting user:', error);
            this.showDeleteUserError(error.message || 'Failed to delete user');
        } finally {
            Utils.showLoading(false);
            const submitDeleteUser = this.app.domManager.get('submitDeleteUser');
            if (submitDeleteUser) {
                submitDeleteUser.disabled = false;
                submitDeleteUser.textContent = 'Delete User';
            }
        }
    }

    showDeleteUserError(message) {
        const deleteUserError = this.app.domManager.get('deleteUserError');
        if (deleteUserError) {
            deleteUserError.textContent = message;
            deleteUserError.style.display = 'block';
        }
    }

    async handleActivateUser(userId, userName) {
        // Check permissions
        if (!this.app.permissionsManager?.canManageUsers()) {
            this.app.permissionsManager?.showPermissionDenied('activate users');
            return;
        }
        
        try {
            const response = await Utils.fetchWithAuth(`/api/users/${userId}/activate`, {
                method: 'PATCH'
            });

            if (!response.ok) {
                throw new Error('Failed to activate user');
            }

            this.app.settingsManager.reloadAccountsList();
            this.app.notificationManager.showNotification(`${userName} activated successfully`, 'success');
        } catch (error) {
            console.error('Error activating user:', error);
            this.app.notificationManager.showNotification('Failed to activate user', 'error');
        }
    }

    async handleDeactivateUser(userId, userName) {
        // Check permissions
        if (!this.app.permissionsManager?.canManageUsers()) {
            this.app.permissionsManager?.showPermissionDenied('deactivate users');
            return;
        }
        
        try {
            const response = await Utils.fetchWithAuth(`/api/users/${userId}/deactivate`, {
                method: 'PATCH'
            });

            if (!response.ok) {
                throw new Error('Failed to deactivate user');
            }

            this.app.settingsManager.reloadAccountsList();
            this.app.notificationManager.showNotification(`${userName} deactivated successfully`, 'success');
        } catch (error) {
            console.error('Error deactivating user:', error);
            this.app.notificationManager.showNotification('Failed to deactivate user', 'error');
        }
    }

    async handleChangeAdminCredentials() {
        console.log('Handling change admin credentials');
        
        try {
            const changeAdminCredentialsForm = this.app.domManager.get('changeAdminCredentialsForm');
            const submitChangeAdminCredentials = this.app.domManager.get('submitChangeAdminCredentials');
            
            const formData = new FormData(changeAdminCredentialsForm);
            const credentialsData = {
                currentPassword: formData.get('currentPassword'),
                newPassword: formData.get('newPassword'),
                newPin: formData.get('newPin')
            };

            if (!credentialsData.currentPassword || credentialsData.currentPassword.trim() === '') {
                this.showChangeAdminCredentialsError('Please enter your current password');
                return;
            }

            if (!credentialsData.newPassword || credentialsData.newPassword.trim() === '') {
                this.showChangeAdminCredentialsError('Please enter a new password');
                return;
            }

            if (!credentialsData.newPin || credentialsData.newPin.trim() === '') {
                this.showChangeAdminCredentialsError('Please enter a new PIN');
                return;
            }

            if (credentialsData.newPassword.length < 6) {
                this.showChangeAdminCredentialsError('New password must be at least 6 characters');
                return;
            }

            if (credentialsData.newPin.length < 4) {
                this.showChangeAdminCredentialsError('New PIN must be at least 4 characters');
                return;
            }

            Utils.showLoading(true);
            if (submitChangeAdminCredentials) {
                submitChangeAdminCredentials.disabled = true;
                submitChangeAdminCredentials.textContent = 'Updating...';
            }

            const response = await Utils.fetchWithAuth('/api/users/admin/credentials', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentialsData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update admin credentials');
            }

            this.app.modalManager.closeChangeAdminCredentialsModal();
            this.app.notificationManager.showNotification('Admin credentials updated successfully', 'success');

        } catch (error) {
            console.error('Error updating admin credentials:', error);
            this.showChangeAdminCredentialsError(error.message || 'Failed to update admin credentials');
        } finally {
            Utils.showLoading(false);
            const submitChangeAdminCredentials = this.app.domManager.get('submitChangeAdminCredentials');
            if (submitChangeAdminCredentials) {
                submitChangeAdminCredentials.disabled = false;
                submitChangeAdminCredentials.textContent = 'Update Credentials';
            }
        }
    }

    showChangeAdminCredentialsError(message) {
        const changeAdminCredentialsError = this.app.domManager.get('changeAdminCredentialsError');
        if (changeAdminCredentialsError) {
            changeAdminCredentialsError.textContent = message;
            changeAdminCredentialsError.style.display = 'block';
        }
    }

    async loadAccountsList() {
        // This method would load the accounts table in settings
        // Implementation would depend on the existing settings structure
        console.log('Loading accounts list...');
    }

    async handleManagePermissions() {
        console.log('Handling manage permissions');
        
        try {
            const modal = this.app.domManager.get('managePermissionsModal');
            const userId = parseInt(modal.dataset.userId);
            const submitButton = this.app.domManager.get('submitManagePermissions');
            
            if (!userId) {
                this.app.modalManager.showManagePermissionsError('Invalid user ID');
                return;
            }

            // Get selected permissions
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
            const selectedPermissions = Array.from(checkboxes).map(cb => cb.value);

            Utils.showLoading(true);
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.querySelector('.btn-text').textContent = 'Updating...';
            }

            // Update permissions
            await this.app.permissionsManager.updateUserPermissions(userId, selectedPermissions);

            this.app.modalManager.closeManagePermissionsModal();
            this.app.settingsManager.reloadAccountsList();
            this.app.notificationManager.showNotification('Permissions updated successfully', 'success');

        } catch (error) {
            console.error('Error updating permissions:', error);
            this.app.modalManager.showManagePermissionsError(error.message || 'Failed to update permissions');
        } finally {
            Utils.showLoading(false);
            const submitButton = this.app.domManager.get('submitManagePermissions');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.querySelector('.btn-text').textContent = 'Update Permissions';
            }
        }
    }

    async handleChangeOwnCredentials() {
        console.log('Handling change own credentials');
        
        try {
            const currentPin = this.app.domManager.get('currentPinOwn');
            const newPin = this.app.domManager.get('newPinOwn');
            const confirmPin = this.app.domManager.get('confirmPinOwn');
            const submitButton = this.app.domManager.get('submitChangeOwnCredentials');
            
            // Validate inputs
            if (!currentPin || !newPin || !confirmPin) {
                this.app.modalManager.showChangeOwnCredentialsError('All fields are required');
                return;
            }

            const currentPinValue = currentPin.value.trim();
            const newPinValue = newPin.value.trim();
            const confirmPinValue = confirmPin.value.trim();

            if (!currentPinValue || !newPinValue || !confirmPinValue) {
                this.app.modalManager.showChangeOwnCredentialsError('All fields are required');
                return;
            }

            if (newPinValue.length < 4) {
                this.app.modalManager.showChangeOwnCredentialsError('New PIN must be at least 4 digits');
                return;
            }

            if (!/^\d+$/.test(newPinValue)) {
                this.app.modalManager.showChangeOwnCredentialsError('PIN must contain only numbers');
                return;
            }

            if (newPinValue !== confirmPinValue) {
                this.app.modalManager.showChangeOwnCredentialsError('New PIN and confirmation do not match');
                return;
            }

            if (currentPinValue === newPinValue) {
                this.app.modalManager.showChangeOwnCredentialsError('New PIN must be different from current PIN');
                return;
            }

            // Show loading state
            Utils.showLoading(true);
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.querySelector('.btn-text').textContent = 'Updating...';
            }

            // Clear any previous errors
            this.app.modalManager.clearChangeOwnCredentialsError();

            // Send request to update credentials
            const response = await Utils.fetchWithAuth('/api/users/me/credentials', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPin: currentPinValue,
                    newPin: newPinValue,
                    confirmPin: confirmPinValue
                })
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.errors && Array.isArray(result.errors)) {
                    const errorMessage = result.errors.map(err => err.msg).join(', ');
                    throw new Error(errorMessage);
                }
                throw new Error(result.error || 'Failed to update credentials');
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to update credentials');
            }

            // Success - close modal and show notification
            this.app.modalManager.closeChangeOwnCredentialsModal();
            this.app.notificationManager.showNotification('PIN updated successfully', 'success');

        } catch (error) {
            console.error('Error changing own credentials:', error);
            this.app.modalManager.showChangeOwnCredentialsError(error.message || 'Failed to update credentials');
        } finally {
            Utils.showLoading(false);
            const submitButton = this.app.domManager.get('submitChangeOwnCredentials');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.querySelector('.btn-text').textContent = 'Update PIN';
            }
        }
    }
}

export default UserManager;
