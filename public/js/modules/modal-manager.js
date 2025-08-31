class ModalManager {
    constructor(app) {
        this.app = app;
    }

    // PIN Modal Management
    async handleSignIn() {
        const pinInput = this.app.domManager.get('pinInput');
        const pin = pinInput?.value;
        
        if (!pin) {
            this.showPinError('Please enter a PIN');
            return;
        }
        
        try {
            const pinModal = this.app.domManager.get('pinModal');
            if (pinModal?.dataset.purpose === 'settings') {
                await this.app.authManager.authenticateForSettings(pin);
            } else if (pinModal?.dataset.purpose === 'user-switch') {
                await this.app.authManager.authenticateUserSwitch(pin);
            } else {
                await this.app.authManager.processSignIn(pin);
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.showPinError('Authentication failed');
        }
    }

    async promptSignIn(signoutId, soldierNames) {
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('sign_in_soldiers')) {
            this.app.permissionsManager?.showPermissionDenied('sign soldiers back in');
            return;
        }
        
        this.app.currentSignOutId = signoutId;
        
        const pinModal = this.app.domManager.get('pinModal');
        if (pinModal) {
            pinModal.style.display = 'flex';
            pinModal.style.visibility = 'visible';
            pinModal.style.opacity = '1';
            pinModal.classList.add('show');
        }
        
        this.resetPinModalState();
        
        try {
            const response = await Utils.fetchWithAuth(`/api/signouts/${signoutId}`);
            if (response.ok) {
                const signout = await response.json();
                this.updateSignInDetails(signout.data);
            } else {
                this.updateSignInDetailsBasic(soldierNames, 'Unknown Location');
            }
        } catch (error) {
            console.error('Error fetching sign-out details for modal:', error);
            this.updateSignInDetailsBasic(soldierNames, 'Unknown Location');
        }
        
        const pinInput = this.app.domManager.get('pinInput');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
        
        const pinError = this.app.domManager.get('pinError');
        if (pinError) {
            pinError.style.display = 'none';
        }
    }

    requestPinForSettings() {
        console.log('requestPinForSettings called');
        
        const pinModal = this.app.domManager.get('pinModal');
        if (!pinModal) {
            console.error('PIN modal element not found!');
            this.app.notificationManager.showNotification('Settings modal not available', 'error');
            return;
        }
        
        pinModal.style.display = 'flex';
        pinModal.style.visibility = 'visible';
        pinModal.style.opacity = '1';
        pinModal.style.zIndex = '1001';
        pinModal.classList.add('show');
        
        console.log('PIN modal display set to flex');
        
        const pinInput = this.app.domManager.get('pinInput');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
        
        const pinError = this.app.domManager.get('pinError');
        if (pinError) {
            pinError.style.display = 'none';
        }
        
        pinModal.dataset.purpose = 'settings';
        console.log('PIN modal purpose set to settings');
        
        const modalTitle = pinModal.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = 'Enter PIN for Settings Access';
            console.log('Modal title updated');
        } else {
            console.error('Modal title element not found!');
        }
        
        const modalSubmitButton = pinModal.querySelector('pinSubmitText');
        if (modalSubmitButton) {
            modalSubmitButton.textContent = 'View Settings';
            console.log('Modal button updated');
        } else {
            console.error('Modal button element not found!');
        }

        const signInDetails = this.app.domManager.get('signInDetails');
        if (signInDetails) {
            signInDetails.style.display = 'none';
            console.log('Sign-in details hidden for settings access');
        }
        
        pinModal.offsetHeight;
        
        console.log('PIN modal should now be visible');
    }

    closePinModal() {
        const pinModal = this.app.domManager.get('pinModal');
        if (pinModal) {
            pinModal.style.display = 'none';
            pinModal.style.visibility = 'hidden';
            pinModal.style.opacity = '0';
            pinModal.classList.remove('show');
        }
        
        const pinInput = this.app.domManager.get('pinInput');
        if (pinInput) {
            pinInput.value = '';
        }
        
        const pinError = this.app.domManager.get('pinError');
        if (pinError) {
            pinError.style.display = 'none';
        }
        
        this.resetPinModalState();
        
        if (pinModal) {
            delete pinModal.dataset.purpose;
        }
        
        this.app.currentSignOutId = null;
    }

    resetPinModalState() {
        const pinModal = this.app.domManager.get('pinModal');
        const modalTitle = pinModal?.querySelector('.modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = 'Enter PIN to Sign In';
        }
        
        const signInDetails = this.app.domManager.get('signInDetails');
        if (signInDetails) {
            signInDetails.style.display = 'block';
        }
        
        this.app.authManager.targetUser = null;
    }

    showPinError(message) {
        const pinError = this.app.domManager.get('pinError');
        if (pinError) {
            pinError.textContent = message;
            pinError.style.display = 'block';
        }
    }

    updateSignInDetails(signout) {
        const signInDetails = this.app.domManager.get('signInDetails');
        if (!signInDetails) return;
        
        let soldiers = signout.soldiers;
        if (!soldiers && signout.soldier_rank) {
            soldiers = [{
                rank: signout.soldier_rank,
                firstName: signout.soldier_first_name,
                lastName: signout.soldier_last_name,
                dodId: signout.soldier_dod_id
            }];
        }
        
        const soldierChips = Utils.renderSoldierChips(soldiers);
        const signOutTime = Utils.formatTime(signout.sign_out_time);
        
        signInDetails.innerHTML = `
            <div class="sign-in-info">
                <div class="sign-in-section">
                    <h4>Destination</h4>
                    <div class="destination-info">
                        <strong>${signout.location}</strong>
                        ${signout.notes ? `<div class="notes">${signout.notes}</div>` : ''}
                    </div>
                </div>
                <div class="sign-in-section">
                    <h4>Soldiers in Group</h4>
                    <div class="soldiers-info">
                        ${soldierChips}
                    </div>
                </div>
                <div class="sign-in-section">
                    <h4>Sign-Out Time</h4>
                    <div class="time-info">${signOutTime}</div>
                </div>
            </div>
        `;
    }

    updateSignInDetailsBasic(soldierNames, location) {
        const signInDetails = this.app.domManager.get('signInDetails');
        if (!signInDetails) return;
        
        signInDetails.innerHTML = `
            <div class="sign-in-info">
                <div class="sign-in-section">
                    <h4>Destination</h4>
                    <div class="destination-info">
                        <strong>${location}</strong>
                    </div>
                </div>
                <div class="sign-in-section">
                    <h4>Soldiers in Group</h4>
                    <div class="soldiers-info">
                        ${soldierNames}
                    </div>
                </div>
            </div>
        `;
    }

    // Sign-out Modal Management
    openNewSignOutModal() {
        const signOutModal = this.app.domManager.get('signOutModal');
        if (signOutModal) {
            signOutModal.style.display = 'flex';
            
            const signOutForm = this.app.domManager.get('signOutForm');
            if (signOutForm) {
                signOutForm.reset();
            }
            
            this.app.barcodeManager.clearSoldiers();
            
            const firstInput = signOutForm?.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }

    closeNewSignOutModal() {
        const signOutModal = this.app.domManager.get('signOutModal');
        if (signOutModal) {
            signOutModal.style.display = 'none';
        }
        
        const signOutForm = this.app.domManager.get('signOutForm');
        if (signOutForm) {
            signOutForm.reset();
        }
        
        this.app.barcodeManager.clearSoldiers();
    }

    // Info Modal Management
    async showSignOutInfo(signoutId) {
        try {
            const response = await Utils.fetchWithAuth(`/api/signouts/${signoutId}`);
            if (!response.ok) throw new Error('Failed to fetch sign-out details');
            
            const responseJson = await response.json();
            const signout = responseJson.data
            let soldiers = signout.soldiers;
            if (!soldiers && signout.soldier_rank) {
                soldiers = [{
                    rank: signout.soldier_rank,
                    firstName: signout.soldier_first_name,
                    lastName: signout.soldier_last_name,
                    dodId: signout.soldier_dod_id
                }];
            }
            
            const signOutTime = Utils.formatTime(signout.sign_out_time);
            const signInTime = signout.sign_in_time ? Utils.formatTime(signout.sign_in_time) : 'Not signed in';
            const duration = signout.sign_in_time 
                ? Utils.calculateDuration(signout.sign_out_time, signout.sign_in_time)
                : Utils.calculateDuration(signout.sign_out_time);
            
            const soldierChips = Utils.renderSoldierChips(soldiers);
            
            const content = `
                <div class="info-section">
                    <h3>Sign-Out Details</h3>
                    <div class="info-grid">
                        <div class="info-box">
                            <span class="info-label">ID</span>
                            <span class="info-value">${signout.signout_id}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Soldiers</span>
                            <div class="info-value">${soldierChips}</div>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Location</span>
                            <span class="info-value">${signout.location}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Sign-Out Time</span>
                            <span class="info-value">${signOutTime}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Sign-In Time</span>
                            <span class="info-value">${signInTime}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Duration</span>
                            <span class="info-value">${duration}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Signed Out By</span>
                            <span class="info-value">${signout.signed_out_by_name}</span>
                        </div>
                        ${signout.signed_in_by_name ? `
                        <div class="info-box">
                            <span class="info-label">Signed In By</span>
                            <span class="info-value">${signout.signed_in_by_name}</span>
                        </div>
                        ` : ''}
                        ${signout.notes ? `
                        <div class="info-box">
                            <span class="info-label">Notes</span>
                            <span class="info-value">${signout.notes}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            const infoModalContent = this.app.domManager.get('infoModalContent');
            const infoModal = this.app.domManager.get('infoModal');
            
            if (infoModalContent) {
                infoModalContent.innerHTML = content;
            }
            if (infoModal) {
                infoModal.style.display = 'flex';
            }
            
        } catch (error) {
            console.error('Error loading sign-out info:', error);
            this.app.notificationManager.showNotification('Failed to load sign-out details', 'error');
        }
    }

    closeInfoModal() {
        const infoModal = this.app.domManager.get('infoModal');
        if (infoModal) {
            infoModal.style.display = 'none';
        }
    }

    // User Management Modals
    openAddUserModal() {
        const addUserModal = this.app.domManager.get('addUserModal');
        if (addUserModal) {
            addUserModal.style.display = 'flex';
            addUserModal.style.visibility = 'visible';
            addUserModal.style.opacity = '1';
            addUserModal.classList.add('show');
            
            const addUserForm = this.app.domManager.get('addUserForm');
            if (addUserForm) {
                addUserForm.reset();
            }
            
            const addUserError = this.app.domManager.get('addUserError');
            if (addUserError) {
                addUserError.style.display = 'none';
            }
            
            const firstInput = addUserForm?.querySelector('input, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    closeAddUserModal() {
        const addUserModal = this.app.domManager.get('addUserModal');
        if (addUserModal) {
            addUserModal.style.display = 'none';
            addUserModal.style.visibility = 'hidden';
            addUserModal.style.opacity = '0';
            addUserModal.classList.remove('show');
        }
        
        const addUserForm = this.app.domManager.get('addUserForm');
        if (addUserForm) {
            addUserForm.reset();
        }
        
        const addUserError = this.app.domManager.get('addUserError');
        if (addUserError) {
            addUserError.style.display = 'none';
        }
    }

    openChangePinModal(userId, userName) {
        const changePinModal = this.app.domManager.get('changePinModal');
        const changePinUserId = this.app.domManager.get('changePinUserId');
        const changePinUserInfo = this.app.domManager.get('changePinUserInfo');
        
        if (changePinModal) {
            changePinModal.style.display = 'flex';
            changePinModal.style.visibility = 'visible';
            changePinModal.style.opacity = '1';
            changePinModal.classList.add('show');
        }
        
        if (changePinUserId) {
            changePinUserId.value = userId;
        }
        
        if (changePinUserInfo) {
            changePinUserInfo.textContent = userName;
        }
        
        const changePinForm = this.app.domManager.get('changePinForm');
        if (changePinForm) {
            changePinForm.reset();
            changePinUserId.value = userId;
        }
        
        const changePinError = this.app.domManager.get('changePinError');
        if (changePinError) {
            changePinError.style.display = 'none';
        }
    }

    closeChangePinModal() {
        const changePinModal = this.app.domManager.get('changePinModal');
        if (changePinModal) {
            changePinModal.style.display = 'none';
            changePinModal.style.visibility = 'hidden';
            changePinModal.style.opacity = '0';
            changePinModal.classList.remove('show');
        }
        
        const changePinForm = this.app.domManager.get('changePinForm');
        if (changePinForm) {
            changePinForm.reset();
        }
        
        const changePinError = this.app.domManager.get('changePinError');
        if (changePinError) {
            changePinError.style.display = 'none';
        }
    }

    openDeleteUserModal(userId, userName) {
        const deleteUserModal = this.app.domManager.get('deleteUserModal');
        const deleteUserId = this.app.domManager.get('deleteUserId');
        const deleteUserInfo = this.app.domManager.get('deleteUserInfo');
        
        if (deleteUserModal) {
            deleteUserModal.style.display = 'flex';
            deleteUserModal.style.visibility = 'visible';
            deleteUserModal.style.opacity = '1';
            deleteUserModal.classList.add('show');
        }
        
        if (deleteUserId) {
            deleteUserId.value = userId;
        }
        
        if (deleteUserInfo) {
            deleteUserInfo.textContent = userName;
        }
        
        const deleteUserForm = this.app.domManager.get('deleteUserForm');
        if (deleteUserForm) {
            deleteUserForm.reset();
            deleteUserId.value = userId;
        }
        
        const deleteUserError = this.app.domManager.get('deleteUserError');
        if (deleteUserError) {
            deleteUserError.style.display = 'none';
        }
    }

    closeDeleteUserModal() {
        const deleteUserModal = this.app.domManager.get('deleteUserModal');
        if (deleteUserModal) {
            deleteUserModal.style.display = 'none';
            deleteUserModal.style.visibility = 'hidden';
            deleteUserModal.style.opacity = '0';
            deleteUserModal.classList.remove('show');
        }
        
        const deleteUserForm = this.app.domManager.get('deleteUserForm');
        if (deleteUserForm) {
            deleteUserForm.reset();
        }
        
        const deleteUserError = this.app.domManager.get('deleteUserError');
        if (deleteUserError) {
            deleteUserError.style.display = 'none';
        }
    }

    openChangeAdminCredentialsModal(userId) {
        const changeAdminCredentialsModal = this.app.domManager.get('changeAdminCredentialsModal');
        const adminCredentialsUserId = this.app.domManager.get('adminCredentialsUserId');
        
        if (changeAdminCredentialsModal) {
            changeAdminCredentialsModal.style.display = 'flex';
            changeAdminCredentialsModal.style.visibility = 'visible';
            changeAdminCredentialsModal.style.opacity = '1';
            changeAdminCredentialsModal.classList.add('show');
        }
        
        if (adminCredentialsUserId) {
            adminCredentialsUserId.value = userId;
        }
        
        const changeAdminCredentialsForm = this.app.domManager.get('changeAdminCredentialsForm');
        if (changeAdminCredentialsForm) {
            changeAdminCredentialsForm.reset();
            adminCredentialsUserId.value = userId;
        }
        
        const changeAdminCredentialsError = this.app.domManager.get('changeAdminCredentialsError');
        if (changeAdminCredentialsError) {
            changeAdminCredentialsError.style.display = 'none';
        }
    }

    closeChangeAdminCredentialsModal() {
        const changeAdminCredentialsModal = this.app.domManager.get('changeAdminCredentialsModal');
        if (changeAdminCredentialsModal) {
            changeAdminCredentialsModal.style.display = 'none';
            changeAdminCredentialsModal.style.visibility = 'hidden';
            changeAdminCredentialsModal.style.opacity = '0';
            changeAdminCredentialsModal.classList.remove('show');
        }
        
        const changeAdminCredentialsForm = this.app.domManager.get('changeAdminCredentialsForm');
        if (changeAdminCredentialsForm) {
            changeAdminCredentialsForm.reset();
        }
        
        const changeAdminCredentialsError = this.app.domManager.get('changeAdminCredentialsError');
        if (changeAdminCredentialsError) {
            changeAdminCredentialsError.style.display = 'none';
        }
    }

        openManualEntryModal() {
        const manualEntryModal = this.app.domManager.get('manualEntryModal');
        if (manualEntryModal) {
            manualEntryModal.style.display = 'flex';
            
            const manualEntryForm = this.app.domManager.get('manualEntryForm');
            if (manualEntryForm) {
                manualEntryForm.reset();
            }
            
            const firstInput = manualEntryForm?.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }

    closeManualEntryModal() {
        const manualEntryModal = this.app.domManager.get('manualEntryModal');
        if (manualEntryModal) {
            manualEntryModal.style.display = 'none';
        }
        
        const manualEntryForm = this.app.domManager.get('manualEntryForm');
        if (manualEntryForm) {
            manualEntryForm.reset();
        }
    }

    async handleManualEntry(event) {
        event.preventDefault();
        
        try {
            const manualEntryForm = this.app.domManager.get('manualEntryForm');
            const formData = new FormData(manualEntryForm);
            
            const soldierData = {
                rank: formData.get('rank').trim(),
                firstName: formData.get('firstName').trim(),
                middleInitial: formData.get('middleInitial')?.trim() || '',
                lastName: formData.get('lastName').trim(),
                dodId: formData.get('dodId')?.trim() || '',
                isManualEntry: true
            };
            
            // Validate required fields
            if (!soldierData.rank || !soldierData.firstName || !soldierData.lastName) {
                this.app.notificationManager.showNotification('Please fill in all required fields', 'warning');
                return;
            }
            
            // Check for duplicates
            const isDuplicate = this.app.barcodeManager.addedSoldiers.some(soldier => 
                soldier.firstName === soldierData.firstName && 
                soldier.lastName === soldierData.lastName &&
                (soldier.dodId === soldierData.dodId || (!soldier.dodId && !soldierData.dodId))
            );
            
            if (isDuplicate) {
                this.app.notificationManager.showNotification('This soldier has already been added.', 'warning');
                return;
            }
            
            // Add the full name property for consistency
            soldierData.fullName = `${soldierData.firstName} ${soldierData.middleInitial ? soldierData.middleInitial + ' ' : ''}${soldierData.lastName}`;
            
            // Add to the soldiers list
            this.app.barcodeManager.addedSoldiers.push(soldierData);
            this.app.barcodeManager.renderSoldierChips();
            
            this.closeManualEntryModal();
            this.app.notificationManager.showNotification(
                `Successfully added: ${soldierData.rank} ${soldierData.fullName} (Manual Entry)`, 
                'success'
            );
            
        } catch (error) {
            console.error('Error adding manual entry:', error);
            this.app.notificationManager.showNotification('Failed to add soldier', 'error');
        }
    }

    async openManagePermissionsModal(userId, userName) {
        if (!this.app.permissionsManager?.canManagePermissions()) {
            this.app.permissionsManager?.showPermissionDenied('manage user permissions');
            return;
        }

        // Check if trying to edit own permissions
        if (this.app.currentUser && this.app.currentUser.id == userId) {
            this.app.notificationManager.showNotification(
                'You cannot edit your own permissions', 
                'error'
            );
            return;
        }

        try {
            // Refresh DOM manager to ensure we have the latest elements
            this.app.domManager.refresh();
            
            const modal = this.app.domManager.get('managePermissionsModal');
            const userNameElement = this.app.domManager.get('permissionsUserName');
            const permissionsCheckboxes = this.app.domManager.get('permissionsCheckboxes');
            
            console.log('Modal element:', modal);
            console.log('UserName element:', userNameElement);
            console.log('Checkboxes element:', permissionsCheckboxes);
            
            if (!modal) {
                // Try direct DOM query as fallback
                const modalDirect = document.getElementById('managePermissionsModal');
                console.log('Direct modal query:', modalDirect);
                
                if (!modalDirect) {
                    throw new Error('Manage permissions modal not found in DOM - modal does not exist');
                } else {
                    // Use direct query result
                    throw new Error('Manage permissions modal found via direct query but not through DOM manager');
                }
            }
            
            if (userNameElement) {
                userNameElement.textContent = userName;
            }
            
            // Store user ID for later use
            modal.dataset.userId = userId;
            
            // Load all available permissions with dependencies
            const allPermissions = await this.app.permissionsManager.fetchAllPermissions();
            
            // Load user's current permissions
            const response = await Utils.fetchWithAuth(`/api/permissions/user/${userId}`);
            if (!response.ok) throw new Error('Failed to load user permissions');
            
            const result = await response.json();
            const userPermissions = result.success ? result.permissions : [];
            
            // Load current user's permissions to check what they can grant
            const currentUserPermissions = this.app.permissionsManager.userPermissions || [];
            
            // Populate permissions checkboxes with hierarchy
            this.populatePermissionsWithHierarchy(permissionsCheckboxes, allPermissions, userPermissions, currentUserPermissions);
            
            // Add event listeners for dependency checking
            this.setupPermissionDependencyListeners(permissionsCheckboxes, allPermissions, userPermissions, currentUserPermissions);
            
            this.clearManagePermissionsError();
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error opening manage permissions modal:', error);
            this.app.notificationManager.showNotification('Failed to load permissions data', 'error');
        }
    }

    populatePermissionsWithHierarchy(container, allPermissions, userPermissions, currentUserPermissions) {
        // Define permission categories for better organization
        const permissionCategories = {
            'Basic Dashboard Access': ['view_dashboard'],
            'Logging & Reports': ['view_logs'],
            'System Settings': ['view_settings'],
            'System Administration': ['system_admin']
        };
        
        // Create a map of permissions
        const permissionMap = new Map();
        const processedPermissions = new Set();
        
        // First pass: create permission objects
        allPermissions.forEach(permission => {
            permissionMap.set(permission.name, {
                ...permission,
                children: permission.children || [],
                parent: permission.parent || null
            });
        });
        
        // Third pass: build hierarchical HTML by categories
        const permissionHtml = [];
        
        // Process each category
        Object.entries(permissionCategories).forEach(([categoryName, rootPermissions]) => {
            const categoryPerms = rootPermissions.filter(permName => permissionMap.has(permName));
            if (categoryPerms.length === 0) return;
            
            // Add category header
            permissionHtml.push(`
                <div class="permission-group ${categoryName.includes('Administration') ? 'admin-group' : ''}">
                    <div class="permission-group-header">${categoryName}</div>
                    <div class="permission-group-content">
            `);
            
            // Process root permissions and their hierarchy
            categoryPerms.forEach(rootPermName => {
                if (processedPermissions.has(rootPermName)) return;
                
                this.addPermissionWithChildren(
                    permissionHtml, 
                    permissionMap, 
                    rootPermName, 
                    userPermissions, 
                    currentUserPermissions,
                    processedPermissions, 
                    0
                );
            });
            
            permissionHtml.push(`
                    </div>
                </div>
            `);
        });

        container.innerHTML = permissionHtml.join('');
    }

    addPermissionWithChildren(htmlArray, permissionMap, permissionName, userPermissions, currentUserPermissions, processedPermissions, depth) {
        if (processedPermissions.has(permissionName)) return;
        
        const permission = permissionMap.get(permissionName);
        if (!permission) return;
        
        processedPermissions.add(permissionName);
        
        const isChecked = userPermissions.includes(permissionName);
        const isSystemAdmin = permissionName === 'system_admin';
        const canGrant = currentUserPermissions.includes(permissionName) || currentUserPermissions.includes('system_admin');
        
        // Add the permission
        htmlArray.push(this.createPermissionHtml(permission, isChecked, depth, isSystemAdmin, canGrant));
        
        // Add children recursively
        if (permission.children && permission.children.length > 0) {
            permission.children.forEach(childName => {
                this.addPermissionWithChildren(
                    htmlArray, 
                    permissionMap, 
                    childName, 
                    userPermissions, 
                    currentUserPermissions,
                    processedPermissions, 
                    depth + 1
                );
            });
        }
    }

    createPermissionHtml(permission, isChecked, depth, isSystemAdmin = false, canGrant = true) {
        const indentClass = depth > 0 ? ` permission-child depth-${depth}` : '';
        const adminClass = isSystemAdmin ? ' system-admin-permission' : '';
        
        // Format permission name for display
        const displayName = permission.name.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        // Special styling for default permissions
        const isDefault = ['view_dashboard', 'view_settings','create_signout', 'sign_in_soldiers', 'view_logs', 'change_own_credentials','export_data'].includes(permission.name);
        const defaultNote = isDefault ? '<div class="permission-default-note">Default permission</div>' : '';
        
        // Disable checkbox if user can't grant this permission
        const disabled = !canGrant ? 'disabled' : '';
        const disabledNote = !canGrant ? '<div class="permission-disabled-note">You don\'t have permission to grant this</div>' : '';
        
        return `
            <div class="permission-item${indentClass}${adminClass}" data-permission="${permission.name}" data-depth="${depth}">
                <input type="checkbox" 
                       id="perm_${permission.id}" 
                       value="${permission.name}" 
                       ${isChecked ? 'checked' : ''}
                       ${disabled}
                       data-depth="${depth}"
                       data-is-system-admin="${isSystemAdmin}"
                       data-can-grant="${canGrant}">
                <div class="permission-info">
                    <div class="permission-name">${displayName}</div>
                    <div class="permission-description">${permission.description || 'No description available'}</div>
                    ${defaultNote}
                    ${disabledNote}
                </div>
            </div>
        `;
    }

    setupPermissionDependencyListeners(container, allPermissions, userPermissions, currentUserPermissions) {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([disabled])');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const permissionName = e.target.value;
                const isChecked = e.target.checked;
                const isSystemAdmin = e.target.dataset.isSystemAdmin === 'true';
                const canGrant = e.target.dataset.canGrant === 'true';
                
                if (!canGrant) {
                    // Prevent changes if user doesn't have permission to grant this
                    e.target.checked = !isChecked;
                    this.app.notificationManager.showNotification(
                        `You don't have permission to modify ${permissionName.replace(/_/g, ' ')}`, 
                        'error'
                    );
                    return;
                }
                
                if (isSystemAdmin && isChecked) {
                    // System admin permission - check all other permissions
                    this.autoCheckAllPermissions(container);
                } else if (isChecked) {
                    // Auto-check parent permissions
                    this.autoCheckParentPermissions(permissionName, allPermissions, container);
                } else {
                    // Remove children automatically when parent is unchecked
                    this.autoRemoveChildren(permissionName, allPermissions, container);
                }
            });
        });
    }

    autoCheckAllPermissions(container) {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:not([disabled])');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                checkbox.checked = true;
            }
        });
        this.app.notificationManager.showNotification(
            'System Admin: All permissions automatically enabled', 
            'info'
        );
    }

    autoCheckParentPermissions(permissionName, allPermissions, container) {
        const permission = allPermissions.find(p => p.name === permissionName);
        const parent = permission?.parent;
        
        if (parent) {
            const parentCheckbox = container.querySelector(`input[value="${parent}"]`);
            if (parentCheckbox && !parentCheckbox.checked) {
                parentCheckbox.checked = true;
                this.app.notificationManager.showNotification(
                    `Auto-enabled parent permission: ${parent.replace(/_/g, ' ')}`, 
                    'info'
                );
                
                // Recursively check parent's parent
                this.autoCheckParentPermissions(parent, allPermissions, container);
            }
        }
    }

    autoRemoveChildren(permissionName, allPermissions, container) {
        // Find and uncheck all children of this permission
        const children = this.getPermissionChildren(permissionName, allPermissions);
        
        children.forEach(childName => {
            const childCheckbox = container.querySelector(`input[value="${childName}"]`);
            if (childCheckbox && childCheckbox.checked) {
                childCheckbox.checked = false;
                this.app.notificationManager.showNotification(
                    `Auto-removed child permission: ${childName.replace(/_/g, ' ')}`, 
                    'info'
                );
                
                // Recursively remove grandchildren
                this.autoRemoveChildren(childName, allPermissions, container);
            }
        });
    }

    handlePermissionRemoval(permissionName, allPermissions, container) {
        // This method is no longer needed since we auto-remove children
        // But keeping it for compatibility
        this.autoRemoveChildren(permissionName, allPermissions, container);
    }

    getPermissionChildren(permissionName, allPermissions) {
        const permission = allPermissions.find(p => p.name === permissionName);
        return permission?.children || [];
    }

    closeManagePermissionsModal() {
        const modal = this.app.domManager.get('managePermissionsModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.clearManagePermissionsError();
    }

    clearManagePermissionsError() {
        const errorElement = this.app.domManager.get('managePermissionsError');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    }

    showManagePermissionsError(message) {
        const errorElement = this.app.domManager.get('managePermissionsError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Show audit details modal
     * @param {Object} log - Audit log entry
     */
    showAuditDetailsModal(log) {
        // Create modal HTML using the existing modal structure
        const modalHTML = `
            <div id="auditDetailsModal" class="modal show">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Audit Log Details</h3>
                        <button type="button" class="modal-close-btn" id="auditDetailsCloseBtn">
                            <span class="icon">×</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="audit-details-content">
                            <div class="detail-row">
                                <strong>Log ID:</strong> #${log.id}
                            </div>
                            <div class="detail-row">
                                <strong>Action:</strong> 
                                <span class="badge ${this.getActionBadgeClass(log.action_type)}">${log.action_type}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Target:</strong> ${this.formatTargetInfoForModal(log)}
                            </div>
                            <div class="detail-row">
                                <strong>User:</strong> ${this.formatUserDisplay(log)}
                            </div>
                            <div class="detail-row">
                                <strong>Timestamp:</strong> ${Utils.formatDateTime(log.timestamp)}
                            </div>
                            <div class="detail-row">
                                <strong>Description:</strong> ${log.description}
                            </div>
                            ${log.ip_address ? `<div class="detail-row"><strong>IP Address:</strong> ${log.ip_address}</div>` : ''}
                            ${log.user_agent ? `<div class="detail-row"><strong>User Agent:</strong> ${log.user_agent}</div>` : ''}
                            ${this.renderValueChanges(log)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="auditDetailsCloseFooterBtn">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('auditDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('auditDetailsModal');
        const closeBtn = document.getElementById('auditDetailsCloseBtn');
        const closeFooterBtn = document.getElementById('auditDetailsCloseFooterBtn');
        
        // Close modal when clicking the X button
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeAuditDetailsModal());
        }
        
        // Close modal when clicking the Close button
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => this.closeAuditDetailsModal());
        }
        
        // Close modal when clicking the overlay (outside the modal content)
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAuditDetailsModal();
                }
            });
        }
    }

    /**
     * Close audit details modal
     */
    closeAuditDetailsModal() {
        const modal = document.getElementById('auditDetailsModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Format user display as "Rank Name (UserID)"
     * @param {Object} log - Audit log entry
     * @returns {string} Formatted user display
     */
    formatUserDisplay(log) {
        const userName = log.user_name || 'System';
        const userId = log.user_id;
        
        if (userId && userName !== 'System') {
            return `${userName} (${userId})`;
        }
        
        return userName;
    }

    /**
     * Get CSS class for action badge
     * @param {string} actionType - Action type
     * @returns {string} CSS class
     */
    getActionBadgeClass(actionType) {
        switch (actionType) {
            case 'CREATE': return 'badge-success';
            case 'UPDATE': return 'badge-warning';
            case 'DELETE': return 'badge-danger';
            case 'ACTIVATE': return 'badge-success';
            case 'DEACTIVATE': return 'badge-warning';
            case 'VIEW': return 'badge-info';
            default: return 'badge-secondary';
        }
    }

    /**
     * Format target information for modal display
     * @param {Object} log - Audit log entry
     * @returns {string} Formatted target info
     */
    formatTargetInfoForModal(log) {
        if (log.table_name === 'users') {
            // For user operations, try to extract user info from values
            let userInfo = null;
            
            // Try new_values first (for CREATE/UPDATE), then old_values (for DELETE)
            if (log.new_values && (log.new_values.rank || log.new_values.full_name || log.new_values.username)) {
                userInfo = log.new_values;
            } else if (log.old_values && (log.old_values.rank || log.old_values.full_name || log.old_values.username)) {
                userInfo = log.old_values;
            }
            
            if (userInfo) {
                const rank = userInfo.rank || '';
                const fullName = userInfo.full_name || '';
                const username = userInfo.username || '';
                const userId = log.record_id || '';
                
                // Format as "Rank Name (UserID)"
                let display = '';
                if (rank && fullName) {
                    display = `${rank} ${fullName}`;
                } else if (fullName) {
                    display = fullName;
                } else if (username) {
                    display = username;
                } else {
                    display = 'User';
                }
                
                if (userId) {
                    display += ` (${userId})`;
                }
                
                return display;
            } else {
                // Fallback when user info is not available in values
                // This happens for PIN updates where only the pin field is changed
                const userId = log.record_id || '';
                if (userId) {
                    return `User #${userId}`;
                }
                return 'User';
            }
        }
        
        // Default format for non-user tables or when user info is not available
        let info = log.table_name;
        if (log.record_id) {
            info += ` #${log.record_id}`;
        }
        return info;
    }

    /**
     * Render value changes section
     * @param {Object} log - Audit log entry
     * @returns {string} HTML for value changes
     */
    renderValueChanges(log) {
        if (!log.old_values && !log.new_values) {
            return '';
        }

        let html = '<div class="detail-section"><strong>Changes:</strong>';
        
        if (log.old_values && log.new_values) {
            // Show comparison for updates
            html += '<div class="value-comparison">';
            const allKeys = new Set([...Object.keys(log.old_values), ...Object.keys(log.new_values)]);
            
            for (const key of allKeys) {
                const oldValue = log.old_values[key];
                const newValue = log.new_values[key];
                
                if (oldValue !== newValue) {
                    html += `
                        <div class="change-row">
                            <strong>${key}:</strong>
                            <div class="value-change">
                                <span class="old-value">From: ${this.formatValue(oldValue)}</span>
                                <span class="arrow">→</span>
                                <span class="new-value">To: ${this.formatValue(newValue)}</span>
                            </div>
                        </div>
                    `;
                }
            }
            html += '</div>';
        } else if (log.new_values) {
            // Show new values for creates
            html += '<div class="new-values">';
            for (const [key, value] of Object.entries(log.new_values)) {
                html += `<div class="value-row"><strong>${key}:</strong> ${this.formatValue(value)}</div>`;
            }
            html += '</div>';
        } else if (log.old_values) {
            // Show old values for deletes
            html += '<div class="old-values">';
            for (const [key, value] of Object.entries(log.old_values)) {
                html += `<div class="value-row"><strong>${key}:</strong> ${this.formatValue(value)}</div>`;
            }
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Format value for display
     * @param {any} value - Value to format
     * @returns {string} Formatted value
     */
    formatValue(value) {
        if (value === null || value === undefined) {
            return '<em>null</em>';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Open the change own credentials modal
     */
    openChangeOwnCredentialsModal() {
        const modal = this.app.domManager.get('changeOwnCredentialsModal');
        const userDisplay = this.app.domManager.get('myAccountUserDisplay');
        
        if (!modal) {
            console.error('Change own credentials modal not found');
            return;
        }

        // Update user display
        if (userDisplay && this.app.currentUser) {
            userDisplay.textContent = `${this.app.currentUser.rank} ${this.app.currentUser.full_name}`;
        }

        // Clear any previous errors and form data
        this.clearChangeOwnCredentialsError();
        this.clearChangeOwnCredentialsForm();
        
        modal.style.display = 'flex';
    }

    /**
     * Close the change own credentials modal
     */
    closeChangeOwnCredentialsModal() {
        const modal = this.app.domManager.get('changeOwnCredentialsModal');
        if (modal) {
            modal.style.display = 'none';
            this.clearChangeOwnCredentialsError();
            this.clearChangeOwnCredentialsForm();
        }
    }

    /**
     * Clear change own credentials form
     */
    clearChangeOwnCredentialsForm() {
        const currentPin = this.app.domManager.get('currentPinOwn');
        const newPin = this.app.domManager.get('newPinOwn');
        const confirmPin = this.app.domManager.get('confirmPinOwn');
        
        if (currentPin) currentPin.value = '';
        if (newPin) newPin.value = '';
        if (confirmPin) confirmPin.value = '';
    }

    /**
     * Clear change own credentials error message
     */
    clearChangeOwnCredentialsError() {
        const errorElement = this.app.domManager.get('changeOwnCredentialsError');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    }

    /**
     * Show change own credentials error message
     * @param {string} message - Error message to show
     */
    showChangeOwnCredentialsError(message) {
        const errorElement = this.app.domManager.get('changeOwnCredentialsError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
}

export default ModalManager;
