class EventManager {
    constructor(app) {
        this.app = app;
    }

    attachEventListeners() {
        this.attachUserSelectorEvents();
        this.attachNavigationEvents();
        this.attachMainButtonEvents();
        this.attachModalEvents();
        this.attachFilterEvents();
        this.attachSettingsEvents();
        this.attachUserManagementEvents();
        this.attachGlobalEvents();
    }

    attachUserSelectorEvents() {
        const userSelectorBtn = this.app.domManager.get('userSelectorBtn');
        const userSelectorEyeBtn = this.app.domManager.get('userSelectorEyeBtn');
        
        userSelectorBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.viewManager.toggleUserSelector();
        });

        userSelectorEyeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleUserSelectorEyeClick();
        });
        
        document.addEventListener('click', (e) => {
            const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
            if (!userSelectorDropdown?.parentElement.contains(e.target)) {
                this.app.viewManager.closeUserSelector();
            }
        });
    }

    attachNavigationEvents() {
        const hamburgerBtn = this.app.domManager.get('hamburgerBtn');
        
        hamburgerBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.viewManager.toggleHamburgerMenu();
        });
        
        document.addEventListener('click', (e) => {
            const hamburgerMenu = this.app.domManager.get('hamburgerMenu');
            if (!hamburgerMenu?.contains(e.target)) {
                this.app.viewManager.closeHamburgerMenu();
            }
        });
        
        const hamburgerDropdown = this.app.domManager.get('hamburgerDropdown');
        hamburgerDropdown?.addEventListener('click', () => {
            this.app.viewManager.closeHamburgerMenu();
        });
    }

    attachMainButtonEvents() {
        const refreshBtn = this.app.domManager.get('refreshBtn');
        const newSignOutBtn = this.app.domManager.get('newSignOutBtn');
        const logsBtn = this.app.domManager.get('logsBtn');
        const settingsBtn = this.app.domManager.get('settingsBtn');
        const logoutBtn = this.app.domManager.get('logoutBtn');
        const backToDashboard = this.app.domManager.get('backToDashboard');
        const backToMainBtn = this.app.domManager.get('backToMainBtn');
        const darkModeToggle = this.app.domManager.get('darkModeToggle');
        
        refreshBtn?.addEventListener('click', () => this.app.signOutManager.loadCurrentSignOuts());
        newSignOutBtn?.addEventListener('click', (e) => {
            // Prevent action if button is disabled due to permissions
            if (newSignOutBtn.disabled || newSignOutBtn.classList.contains('disabled-no-permission')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            this.app.modalManager.openNewSignOutModal();
        });
        logsBtn?.addEventListener('click', () => this.app.viewManager.showLogsView());
        settingsBtn?.addEventListener('click', () => this.app.viewManager.showSettingsWithAuth());
        logoutBtn?.addEventListener('click', () => this.app.authManager.logout());
        backToDashboard?.addEventListener('click', () => this.app.viewManager.showDashboardView());
        backToMainBtn?.addEventListener('click', () => this.app.viewManager.showDashboardView());
        darkModeToggle?.addEventListener('click', () => this.app.toggleDarkMode());
    }

    attachModalEvents() {
        // Sign-out modal events
        const closeModal = this.app.domManager.get('closeModal');
        const cancelBtn = this.app.domManager.get('cancelBtn');
        const signOutForm = this.app.domManager.get('signOutForm');
        
        closeModal?.addEventListener('click', () => this.app.modalManager.closeNewSignOutModal());
        cancelBtn?.addEventListener('click', () => this.app.modalManager.closeNewSignOutModal());
        signOutForm?.addEventListener('submit', (e) => this.app.signOutManager.handleSignOut(e));
        
        signOutForm?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.app.signOutManager.handleSignOut(e);
                }
            }
        });
        
        // PIN modal events
        const closePinModalBtn = this.app.domManager.get('closePinModalBtn');
        const pinCancel = this.app.domManager.get('pinCancel');
        const pinSubmit = this.app.domManager.get('pinSubmit');
        const pinInput = this.app.domManager.get('pinInput');
        
        closePinModalBtn?.addEventListener('click', () => this.app.modalManager.closePinModal());
        pinCancel?.addEventListener('click', () => this.app.modalManager.closePinModal());
        pinSubmit?.addEventListener('click', () => this.app.modalManager.handleSignIn());
        pinInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.app.modalManager.handleSignIn();
        });
        
        // Info modal events
        const closeInfoModalBtn = this.app.domManager.get('closeInfoModalBtn');
        closeInfoModalBtn?.addEventListener('click', () => this.app.modalManager.closeInfoModal());
        
        // Manual entry modal events
        const noCacBtn = this.app.domManager.get('noCacBtn');
        const devFillBtn = this.app.domManager.get('devFillBtn');
        const closeManualEntryModal = this.app.domManager.get('closeManualEntryModal');
        const cancelManualEntry = this.app.domManager.get('cancelManualEntry');
        const manualEntryForm = this.app.domManager.get('manualEntryForm');
        
        noCacBtn?.addEventListener('click', () => this.app.modalManager.openManualEntryModal());
        
        if (devFillBtn) {
            console.log('Dev fill button found, attaching event listener');
            devFillBtn.addEventListener('click', () => {
                console.log('Dev fill button clicked');
                this.app.barcodeManager.fillRandomSoldiers();
            });
        } else {
            console.log('Dev fill button not found in DOM');
        }
        
        closeManualEntryModal?.addEventListener('click', () => this.app.modalManager.closeManualEntryModal());
        cancelManualEntry?.addEventListener('click', () => this.app.modalManager.closeManualEntryModal());
        manualEntryForm?.addEventListener('submit', (e) => this.app.modalManager.handleManualEntry(e));
        
        // Large group alert modal events
        const closeLargeGroupAlertModal = this.app.domManager.get('closeLargeGroupAlertModal');
        const goBackFromAlert = this.app.domManager.get('goBackFromAlert');
        const approveGroupSignOut = this.app.domManager.get('approveGroupSignOut');
        
        closeLargeGroupAlertModal?.addEventListener('click', () => this.app.signOutManager.closeLargeGroupAlert());
        goBackFromAlert?.addEventListener('click', () => this.app.signOutManager.closeLargeGroupAlert());
        approveGroupSignOut?.addEventListener('click', () => this.app.signOutManager.approveLargeGroup());
        
        // Global modal events
        window.addEventListener('click', (e) => {
            const signOutModal = this.app.domManager.get('signOutModal');
            const pinModal = this.app.domManager.get('pinModal');
            const infoModal = this.app.domManager.get('infoModal');
            const addUserModal = this.app.domManager.get('addUserModal');
            const changePinModal = this.app.domManager.get('changePinModal');
            const deleteUserModal = this.app.domManager.get('deleteUserModal');
            const managePermissionsModal = this.app.domManager.get('managePermissionsModal');
            const largeGroupAlertModal = this.app.domManager.get('largeGroupAlertModal');
            
            if (e.target === signOutModal) this.app.modalManager.closeNewSignOutModal();
            if (e.target === pinModal) this.app.modalManager.closePinModal();
            if (e.target === infoModal) this.app.modalManager.closeInfoModal();
            if (e.target === addUserModal) this.app.modalManager.closeAddUserModal();
            if (e.target === changePinModal) this.app.modalManager.closeChangePinModal();
            if (e.target === deleteUserModal) this.app.modalManager.closeDeleteUserModal();
            if (e.target === managePermissionsModal) this.app.modalManager.closeManagePermissionsModal();
            if (e.target === largeGroupAlertModal) this.app.signOutManager.closeLargeGroupAlert();
            if (e.target === deleteUserModal) this.app.modalManager.closeDeleteUserModal();
            if (e.target === managePermissionsModal) this.app.modalManager.closeManagePermissionsModal();
        });
    }

    attachFilterEvents() {
        const searchInput = this.app.domManager.get('searchInput');
        const clearSearchBtn = this.app.domManager.get('clearSearchBtn');
        const applyFiltersBtn = this.app.domManager.get('applyFiltersBtn');
        const clearFiltersBtn = this.app.domManager.get('clearFiltersBtn');
        const exportCsvBtn = this.app.domManager.get('exportCsvBtn');
        const exportLogsPdfBtn = this.app.domManager.get('exportLogsPdfBtn');
        
        searchInput?.addEventListener('input', () => {
            this.app.signOutManager.filterCurrentSignOuts();
            this.handleSearchInputChange();
        });
        
        // Initialize search state on page load
        if (searchInput) {
            this.handleSearchInputChange();
        }
        
        clearSearchBtn?.addEventListener('click', () => {
            this.clearSearch();
        });
        
        applyFiltersBtn?.addEventListener('click', () => this.app.logsManager.loadFilteredLogs());
        clearFiltersBtn?.addEventListener('click', () => this.app.logsManager.clearFilters());
        exportCsvBtn?.addEventListener('click', () => this.app.logsManager.exportLogs());
        exportLogsPdfBtn?.addEventListener('click', () => this.app.logsManager.exportLogsPDF());
    }

    handleSearchInputChange() {
        const searchInput = this.app.domManager.get('searchInput');
        const clearSearchBtn = this.app.domManager.get('clearSearchBtn');
        const searchContainer = searchInput?.parentElement;
        
        if (!searchInput || !clearSearchBtn || !searchContainer) return;
        
        const hasText = searchInput.value.trim().length > 0;
        
        if (hasText) {
            searchContainer.classList.add('expanded');
            clearSearchBtn.style.display = 'block';
            setTimeout(() => {
                clearSearchBtn.classList.add('visible');
            }, 50);
        } else {
            searchContainer.classList.remove('expanded');
            clearSearchBtn.classList.remove('visible');
            setTimeout(() => {
                clearSearchBtn.style.display = 'none';
            }, 300);
        }
    }

    clearSearch() {
        const searchInput = this.app.domManager.get('searchInput');
        const clearSearchBtn = this.app.domManager.get('clearSearchBtn');
        const searchContainer = searchInput?.parentElement;
        
        if (!searchInput || !clearSearchBtn || !searchContainer) return;
        
        searchInput.value = '';
        searchContainer.classList.remove('expanded');
        clearSearchBtn.classList.remove('visible');
        
        setTimeout(() => {
            clearSearchBtn.style.display = 'none';
        }, 300);
        
        // Trigger the filter update
        this.app.signOutManager.filterCurrentSignOuts();
    }

    attachSettingsEvents() {
        const updateDurationBtn = this.app.domManager.get('updateDurationBtn');
        const updateWarningBtn = this.app.domManager.get('updateWarningBtn');
        const exportAllDataBtn = this.app.domManager.get('exportAllDataBtn');
        const backupDataBtn = this.app.domManager.get('backupDataBtn');
        const clearOldRecordsBtn = this.app.domManager.get('clearOldRecordsBtn');
        const resetSystemBtn = this.app.domManager.get('resetSystemBtn');
        
        updateDurationBtn?.addEventListener('click', () => this.app.settingsManager.updateMaxDuration());
        updateWarningBtn?.addEventListener('click', () => this.app.settingsManager.updateWarningThreshold());
        exportAllDataBtn?.addEventListener('click', () => this.app.settingsManager.exportAllData());
        backupDataBtn?.addEventListener('click', () => this.app.settingsManager.createBackup());
        clearOldRecordsBtn?.addEventListener('click', () => this.app.settingsManager.clearOldRecords());
        resetSystemBtn?.addEventListener('click', () => this.app.settingsManager.resetSystem());
    }

    attachUserManagementEvents() {
        const addUserBtn = this.app.domManager.get('addUserBtn');
        
        // Add user modal events
        const closeAddUserModalBtn = this.app.domManager.get('closeAddUserModalBtn');
        const cancelAddUser = this.app.domManager.get('cancelAddUser');
        const submitAddUser = this.app.domManager.get('submitAddUser');
        const addUserForm = this.app.domManager.get('addUserForm');
        
        addUserBtn?.addEventListener('click', () => this.app.modalManager.openAddUserModal());
        closeAddUserModalBtn?.addEventListener('click', () => this.app.modalManager.closeAddUserModal());
        cancelAddUser?.addEventListener('click', () => this.app.modalManager.closeAddUserModal());
        submitAddUser?.addEventListener('click', () => this.app.userManager.handleAddUser());
        addUserForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleAddUser();
        });
        
        // Change PIN modal events
        const closeChangePinModalBtn = this.app.domManager.get('closeChangePinModalBtn');
        const cancelChangePin = this.app.domManager.get('cancelChangePin');
        const submitChangePin = this.app.domManager.get('submitChangePin');
        const changePinForm = this.app.domManager.get('changePinForm');
        
        closeChangePinModalBtn?.addEventListener('click', () => this.app.modalManager.closeChangePinModal());
        cancelChangePin?.addEventListener('click', () => this.app.modalManager.closeChangePinModal());
        submitChangePin?.addEventListener('click', () => this.app.userManager.handleChangePin());
        changePinForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleChangePin();
        });
        
        // Delete user modal events
        const closeDeleteUserModalBtn = this.app.domManager.get('closeDeleteUserModalBtn');
        const cancelDeleteUser = this.app.domManager.get('cancelDeleteUser');
        const submitDeleteUser = this.app.domManager.get('submitDeleteUser');
        const deleteUserForm = this.app.domManager.get('deleteUserForm');
        
        closeDeleteUserModalBtn?.addEventListener('click', () => this.app.modalManager.closeDeleteUserModal());
        cancelDeleteUser?.addEventListener('click', () => this.app.modalManager.closeDeleteUserModal());
        submitDeleteUser?.addEventListener('click', () => this.app.userManager.handleDeleteUser());
        deleteUserForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleDeleteUser();
        });
        
        const closeChangeAdminCredentialsModalBtn = this.app.domManager.get('closeChangeAdminCredentialsModalBtn');
        const cancelChangeAdminCredentials = this.app.domManager.get('cancelChangeAdminCredentials');
        const submitChangeAdminCredentials = this.app.domManager.get('submitChangeAdminCredentials');
        const changeAdminCredentialsForm = this.app.domManager.get('changeAdminCredentialsForm');
        
        closeChangeAdminCredentialsModalBtn?.addEventListener('click', () => this.app.modalManager.closeChangeAdminCredentialsModal());
        cancelChangeAdminCredentials?.addEventListener('click', () => this.app.modalManager.closeChangeAdminCredentialsModal());
        submitChangeAdminCredentials?.addEventListener('click', () => this.app.userManager.handleChangeAdminCredentials());
        changeAdminCredentialsForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleChangeAdminCredentials();
        });
        
        // Manage permissions modal events
        const closeManagePermissionsModalBtn = this.app.domManager.get('closeManagePermissionsModalBtn');
        const cancelManagePermissions = this.app.domManager.get('cancelManagePermissions');
        const submitManagePermissions = this.app.domManager.get('submitManagePermissions');
        const managePermissionsForm = this.app.domManager.get('managePermissionsForm');
        
        closeManagePermissionsModalBtn?.addEventListener('click', () => this.app.modalManager.closeManagePermissionsModal());
        cancelManagePermissions?.addEventListener('click', () => this.app.modalManager.closeManagePermissionsModal());
        submitManagePermissions?.addEventListener('click', () => this.app.userManager.handleManagePermissions());
        managePermissionsForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleManagePermissions();
        });

        // Change own credentials modal events
        const changeOwnCredentialsBtn = this.app.domManager.get('changeOwnCredentialsBtn');
        const closeChangeOwnCredentialsModal = this.app.domManager.get('closeChangeOwnCredentialsModal');
        const cancelChangeOwnCredentials = this.app.domManager.get('cancelChangeOwnCredentials');
        const submitChangeOwnCredentials = this.app.domManager.get('submitChangeOwnCredentials');
        const changeOwnCredentialsForm = this.app.domManager.get('changeOwnCredentialsForm');
        
        changeOwnCredentialsBtn?.addEventListener('click', () => this.app.modalManager.openChangeOwnCredentialsModal());
        closeChangeOwnCredentialsModal?.addEventListener('click', () => this.app.modalManager.closeChangeOwnCredentialsModal());
        cancelChangeOwnCredentials?.addEventListener('click', () => this.app.modalManager.closeChangeOwnCredentialsModal());
        submitChangeOwnCredentials?.addEventListener('click', () => this.app.userManager.handleChangeOwnCredentials());
        changeOwnCredentialsForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.app.userManager.handleChangeOwnCredentials();
        });
    }

    attachGlobalEvents() {
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.sign-in-btn')) {
                const button = e.target.closest('.sign-in-btn');
                const signoutId = button.dataset.signoutId;
                const soldierNames = button.dataset.soldierNames;
                await this.app.modalManager.promptSignIn(signoutId, soldierNames);
            }
            if (e.target.closest('.info-btn')) {
                const button = e.target.closest('.info-btn');
                const signoutId = button.dataset.signoutId;
                this.app.modalManager.showSignOutInfo(signoutId);
            }
            if (e.target.closest('.change-pin-btn') && !e.target.closest('.change-pin-btn').disabled) {
                const button = e.target.closest('.change-pin-btn');
                this.app.modalManager.openChangePinModal(button.dataset.userId, button.dataset.userName);
            }
            if (e.target.closest('.activate-user-btn') && !e.target.closest('.activate-user-btn').disabled) {
                const button = e.target.closest('.activate-user-btn');
                this.app.userManager.handleActivateUser(button.dataset.userId, button.dataset.userName);
            }
            if (e.target.closest('.deactivate-user-btn') && !e.target.closest('.deactivate-user-btn').disabled) {
                const button = e.target.closest('.deactivate-user-btn');
                this.app.userManager.handleDeactivateUser(button.dataset.userId, button.dataset.userName);
            }
            if (e.target.closest('.delete-user-btn') && !e.target.closest('.delete-user-btn').disabled) {
                const button = e.target.closest('.delete-user-btn');
                this.app.modalManager.openDeleteUserModal(button.dataset.userId, button.dataset.userName);
            }
            if (e.target.closest('.change-admin-credentials-btn')) {
                const button = e.target.closest('.change-admin-credentials-btn');
                this.app.modalManager.openChangeAdminCredentialsModal(button.dataset.userId);
            }
            if (e.target.closest('.manage-permissions-btn')) {
                const button = e.target.closest('.manage-permissions-btn');
                this.app.modalManager.openManagePermissionsModal(button.dataset.userId, button.dataset.userName);
            }
        });
        
        // this.app.domManager.get('logsTableBody')?.addEventListener('click', (e) => {
        //     const row = e.target.closest('.log-row');
        //     if (row && row.dataset.signoutId) {
        //         this.app.modalManager.showSignOutDetails(row.dataset.signoutId);
        //     }
        // });
    }

    handleUserSelectorEyeClick() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        const header = userSelectorDropdown?.querySelector('.user-selector-header');
        
        if (!header) return;
        
        // Check if we're already in filter mode
        const isFilterMode = header.classList.contains('filter-mode');
        
        if (isFilterMode) {
            // Switch back to normal mode
            this.exitUserFilterMode();
        } else {
            // Switch to filter mode
            this.enterUserFilterMode();
        }
    }

    enterUserFilterMode() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        const header = userSelectorDropdown?.querySelector('.user-selector-header');
        
        if (!header) return;
        
        // Store original content
        const originalContent = header.innerHTML;
        header.dataset.originalContent = originalContent;
        
        // Replace with filter input
        header.classList.add('filter-mode');
        header.innerHTML = `
            <div class="user-filter-container">
                <input type="text" id="userFilterInput" class="user-filter-input" 
                       placeholder="Filter users..." autofocus>
                <button id="exitFilterBtn" class="exit-filter-btn" title="Exit Filter">
                    <span>✕</span>
                </button>
            </div>
        `;
        
        // Add event listeners for the new elements
        const filterInput = header.querySelector('#userFilterInput');
        const exitBtn = header.querySelector('#exitFilterBtn');
        
        filterInput?.addEventListener('input', (e) => {
            this.filterUsersList(e.target.value);
        });
        
        filterInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.exitUserFilterMode();
            }
        });
        
        exitBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exitUserFilterMode();
        });
        
        // Focus the input
        setTimeout(() => filterInput?.focus(), 50);
    }

    exitUserFilterMode() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        const header = userSelectorDropdown?.querySelector('.user-selector-header');
        
        if (!header || !header.classList.contains('filter-mode')) return;
        
        // Restore original content
        const originalContent = header.dataset.originalContent;
        header.innerHTML = originalContent;
        header.classList.remove('filter-mode');
        delete header.dataset.originalContent;
        
        // Show all users again
        this.showAllUsers();
        
        // Re-attach eye button event listener
        const eyeBtn = header.querySelector('#userSelectorEyeBtn');
        eyeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleUserSelectorEyeClick();
        });
    }

    filterUsersList(searchTerm) {
        const usersList = this.app.domManager.get('usersList');
        const userItems = usersList?.querySelectorAll('.user-item');
        
        if (!userItems) return;
        
        const term = searchTerm.toLowerCase().trim();
        
        userItems.forEach(item => {
            const nameElement = item.querySelector('.user-item-name');
            const name = nameElement?.textContent?.toLowerCase() || '';
            
            if (term === '' || name.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
        
        // Show/hide "no results" message
        this.updateFilterResults(term, userItems);
    }

    updateFilterResults(searchTerm, userItems) {
        const usersList = this.app.domManager.get('usersList');
        if (!usersList) return;
        
        const visibleItems = Array.from(userItems).filter(item => 
            item.style.display !== 'none'
        );
        
        // Remove existing no results message
        const existingMessage = usersList.querySelector('.filter-no-results');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Show no results message if needed
        if (searchTerm && visibleItems.length === 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'filter-no-results';
            noResultsDiv.innerHTML = `
                <div class="no-results-content">
                    <span class="no-results-icon">🔍</span>
                    <span class="no-results-text">No users found matching "${searchTerm}"</span>
                </div>
            `;
            usersList.appendChild(noResultsDiv);
        }
    }

    showAllUsers() {
        const usersList = this.app.domManager.get('usersList');
        const userItems = usersList?.querySelectorAll('.user-item');
        const noResultsMessage = usersList?.querySelector('.filter-no-results');
        
        // Show all user items
        userItems?.forEach(item => {
            item.style.display = 'flex';
        });
        
        // Remove no results message
        if (noResultsMessage) {
            noResultsMessage.remove();
        }
    }
}

export default EventManager;
