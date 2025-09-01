class ViewManager {
    constructor(app) {
        this.app = app;
    }

    showDashboardView() {
        const dashboardView = this.app.domManager.get('dashboardView');
        const logsView = this.app.domManager.get('logsView');
        const settingsView = this.app.domManager.get('settingsView');
        
        if (dashboardView) dashboardView.style.display = 'block';
        if (logsView) logsView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';
        
        // Check permissions before loading dashboard content
        if (!this.app.permissionsManager?.hasPermission('view_dashboard')) {
            this.showNotAuthorizedMessage();
            return;
        }
        
        // If we had previously shown the unauthorized message, restore the content
        const sectionHeader = document.querySelector('#dashboardView .section-header');
        if (sectionHeader && sectionHeader.querySelector('.dashboard-unauthorized')) {
            this.restoreDashboardContent();
        }
        
        this.app.signOutManager.loadCurrentSignOuts();
        this.app.signOutManager.startDurationUpdates();
    }

    restoreDashboardContent() {
        const sectionHeader = document.querySelector('#dashboardView .section-header');
        const tableContainer = document.querySelector('#dashboardView .table-container');
        const searchInput = this.app.domManager.get('searchInput');
        
        // Restore original section header
        if (sectionHeader) {
            sectionHeader.innerHTML = `
                <h2>Currently Signed Out</h2>
                <div class="search-section">
                    <div class="search-container">
                        <input type="text" id="searchInput" placeholder="Search by names or location..." class="search-input">
                        <button id="clearSearchBtn" class="clear-search-btn" style="display: none;">Clear</button>
                    </div>
                </div>
            `;
            // Re-attach search input event listener and update DOM manager reference
            const newSearchInput = sectionHeader.querySelector('#searchInput');
            const newClearSearchBtn = sectionHeader.querySelector('#clearSearchBtn');
            if (newSearchInput) {
                newSearchInput.addEventListener('input', () => {
                    this.app.signOutManager.filterCurrentSignOuts();
                    this.app.eventManager.handleSearchInputChange();
                });
                // Update DOM manager reference
                this.app.domManager.refreshElement('searchInput');
            }
            if (newClearSearchBtn) {
                newClearSearchBtn.addEventListener('click', () => {
                    this.app.eventManager.clearSearch();
                });
                // Update DOM manager reference
                this.app.domManager.refreshElement('clearSearchBtn');
            }
        }
        
        // Restore original table container
        if (tableContainer) {
            tableContainer.innerHTML = `
                <table class="signouts-table">
                    <thead>
                        <tr>
                            <th>Sign-Out ID</th>
                            <th>Soldiers</th>
                            <th>Location</th>
                            <th>Time Out</th>
                            <th>Duration</th>
                            <th>Signed Out By</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="currentSignOutsTableBody">
                        
                    </tbody>
                </table>
                <div id="emptyState" class="empty-state" style="display: none;">
                    <div class="empty-icon">✓</div>
                    <h3>All Clear</h3>
                    <p>No soldiers are currently signed out.</p>
                </div>
            `;
            // Update DOM manager reference for the table body
            this.app.domManager.refreshElement('currentSignOutsTableBody');
        }
        
        // Show search input
        if (searchInput) {
            searchInput.style.display = '';
        }
    }

    showNotAuthorizedMessage() {
        const sectionHeader = document.querySelector('#dashboardView .section-header');
        const tableContainer = document.querySelector('#dashboardView .table-container');
        const searchInput = this.app.domManager.get('searchInput');
        
        if (sectionHeader) {
            sectionHeader.innerHTML = `
                <div class="dashboard-unauthorized">
                    <h2>🚫 Not Authorized</h2>
                    <p>Missing required permissions to view dashboard</p>
                </div>
            `;
        }
        
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="unauthorized-message">
                    <div class="unauthorized-icon">🔒</div>
                    <div class="unauthorized-text">
                        <h3>Access Denied</h3>
                        <p>You don't have permission to view the dashboard content.</p>
                        <p>Contact your administrator to request access.</p>
                    </div>
                </div>
            `;
        }
        
        if (searchInput) {
            searchInput.style.display = 'none';
        }
    }

    showLogsView() {
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('view_logs')) {
            this.app.permissionsManager?.showPermissionDenied('view logs');
            // Stay on current view instead of showing logs
            return;
        }
        
        const dashboardView = this.app.domManager.get('dashboardView');
        const logsView = this.app.domManager.get('logsView');
        const settingsView = this.app.domManager.get('settingsView');
        
        if (dashboardView) dashboardView.style.display = 'none';
        if (logsView) logsView.style.display = 'block';
        if (settingsView) settingsView.style.display = 'none';
        
        this.app.signOutManager.stopDurationUpdates();
        this.app.logsManager.loadFilteredLogs();
    }

    showSettingsWithAuth() {
        console.log('showSettingsWithAuth called');
        this.app.modalManager.requestPinForSettings();
    }

    showSettingsView() {
        console.log('showSettingsView called');
        
        // Check permissions
        if (!this.app.permissionsManager?.canViewSettings()) {
            this.app.permissionsManager?.showPermissionDenied('view settings');
            // Stay on current view instead of showing settings
            return;
        }
        
        const dashboardView = this.app.domManager.get('dashboardView');
        const logsView = this.app.domManager.get('logsView');
        const settingsView = this.app.domManager.get('settingsView');
        
        if (dashboardView) dashboardView.style.display = 'none';
        if (logsView) logsView.style.display = 'none';
        if (settingsView) {
            settingsView.style.display = 'block';
            console.log('Settings view should now be visible');
        } else {
            console.error('Settings view element not found!');
        }
        
        this.app.signOutManager.stopDurationUpdates();
        this.app.settingsManager.loadSettingsData();
    }

    toggleUserSelector() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        
        if (!userSelectorDropdown) {
            console.error('User selector dropdown element not found!');
            return;
        }
        
        if (userSelectorDropdown.parentElement.classList.contains('active')) {
            this.closeUserSelector();
        } else {
            this.openUserSelector();
        }
    }
    
    async openUserSelector() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        const userSelectorBtn = this.app.domManager.get('userSelectorBtn');
        
        if (userSelectorDropdown) {
            userSelectorDropdown.parentElement.classList.add('active');
        }
        if (userSelectorBtn) {
            userSelectorBtn.classList.add('active');
        }
        
        await this.app.userManager.loadUsers();
    }
    
    closeUserSelector() {
        const userSelectorDropdown = this.app.domManager.get('userSelectorDropdown');
        const userSelectorBtn = this.app.domManager.get('userSelectorBtn');
        
        if (userSelectorDropdown) {
            userSelectorDropdown.parentElement.classList.remove('active');
        }
        if (userSelectorBtn) {
            userSelectorBtn.classList.remove('active');
        }
    }

    toggleHamburgerMenu() {
        const hamburgerMenu = this.app.domManager.get('hamburgerMenu');
        
        if (!hamburgerMenu) {
            console.error('Hamburger menu element not found!');
            return;
        }
        
        if (hamburgerMenu.classList.contains('active')) {
            this.closeHamburgerMenu();
        } else {
            this.openHamburgerMenu();
        }
    }
    
    openHamburgerMenu() {
        const hamburgerMenu = this.app.domManager.get('hamburgerMenu');
        const hamburgerDropdown = this.app.domManager.get('hamburgerDropdown');
        
        if (hamburgerMenu) {
            hamburgerMenu.classList.add('active');
        }
        
        setTimeout(() => {
            if (hamburgerDropdown) {
                hamburgerDropdown.style.pointerEvents = 'auto';
            }
        }, 100);
    }
    
    closeHamburgerMenu() {
        const hamburgerMenu = this.app.domManager.get('hamburgerMenu');
        const hamburgerDropdown = this.app.domManager.get('hamburgerDropdown');
        
        if (hamburgerMenu) {
            hamburgerMenu.classList.remove('active');
        }
        if (hamburgerDropdown) {
            hamburgerDropdown.style.pointerEvents = 'none';
        }
    }

    validateCurrentViewPermissions() {
        // Check which view is currently visible and whether user has permission
        const dashboardView = this.app.domManager.get('dashboardView');
        const logsView = this.app.domManager.get('logsView');
        const settingsView = this.app.domManager.get('settingsView');
        
        if (logsView && window.getComputedStyle(logsView).display !== 'none') {
            if (!this.app.permissionsManager?.hasPermission('view_logs')) {
                // User is on logs view but no longer has permission - redirect to dashboard
                this.showDashboardView();
                this.app.notificationManager.showNotification('Access to logs view has been revoked', 'warning');
                return;
            } else {
                // User still has permission, refresh the logs data
                this.app.logsManager.loadFilteredLogs();
            }
        }
        
        if (settingsView && window.getComputedStyle(settingsView).display !== 'none') {
            if (!this.app.permissionsManager?.canViewSettings()) {
                // User is on settings view but no longer has permission - redirect to dashboard
                this.showDashboardView();
                this.app.notificationManager.showNotification('Access to settings view has been revoked', 'warning');
                return;
            } else {
                // User still has permission, refresh the settings data
                this.app.settingsManager.loadSettingsData();
            }
        }
        
        // If on dashboard, always refresh it to check permissions and update content
        if (dashboardView && window.getComputedStyle(dashboardView).display !== 'none') {
            this.showDashboardView();
        }
    }
}

export default ViewManager;
