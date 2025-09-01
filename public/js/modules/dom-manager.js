class DOMManager {
    constructor() {
        this.elements = {};
        this.initializeElements();
    }

    initializeElements() {
        this.elements = {
            // User selector elements
            userSelectorBtn: document.getElementById('userSelectorBtn'),
            userSelectorDropdown: document.getElementById('userSelectorDropdown'),
            userSelectorEyeBtn: document.getElementById('userSelectorEyeBtn'),
            currentUserName: document.getElementById('currentUserName'),
            usersList: document.getElementById('usersList'),
            
            // Navigation elements
            hamburgerBtn: document.getElementById('hamburgerBtn'),
            hamburgerMenu: document.querySelector('.hamburger-menu'),
            hamburgerDropdown: document.getElementById('hamburgerDropdown'),
            
            // Main action buttons
            refreshBtn: document.getElementById('refreshBtn'),
            newSignOutBtn: document.getElementById('newSignOutBtn'),
            logsBtn: document.getElementById('logsBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            changeUserBtn: document.getElementById('changeUserBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            backToDashboard: document.getElementById('backToDashboard'),
            backToMainBtn: document.getElementById('backToMainBtn'),
            darkModeToggle: document.getElementById('darkModeToggle'),
            darkModeText: document.getElementById('darkModeText'),
            
            // Views
            dashboardView: document.getElementById('dashboardView'),
            logsView: document.getElementById('logsView'),
            settingsView: document.getElementById('settingsView'),
            
            // Sign-out modal elements
            signOutModal: document.getElementById('signOutModal'),
            closeModal: document.getElementById('closeModal'),
            cancelBtn: document.getElementById('cancelBtn'),
            signOutForm: document.getElementById('signOutForm'),
            
            // PIN modal elements
            pinModal: document.getElementById('pinModal'),
            closePinModalBtn: document.getElementById('closePinModal'),
            pinInput: document.getElementById('pinInput'),
            pinSubmit: document.getElementById('pinSubmit'),
            pinCancel: document.getElementById('pinCancel'),
            pinError: document.getElementById('pinError'),
            signInDetails: document.getElementById('signInDetails'),
            
            // Manual entry modal elements
            noCacBtn: document.getElementById('noCacBtn'),
            devFillBtn: document.getElementById('devFillBtn'),
            manualEntryModal: document.getElementById('manualEntryModal'),
            closeManualEntryModal: document.getElementById('closeManualEntryModal'),
            cancelManualEntry: document.getElementById('cancelManualEntry'),
            manualEntryForm: document.getElementById('manualEntryForm'),
            manualRank: document.getElementById('manualRank'),
            manualFirstName: document.getElementById('manualFirstName'),
            manualMiddleInitial: document.getElementById('manualMiddleInitial'),
            manualLastName: document.getElementById('manualLastName'),
            manualDodId: document.getElementById('manualDodId'),
            
            // Large group alert modal elements
            largeGroupAlertModal: document.getElementById('largeGroupAlertModal'),
            closeLargeGroupAlertModal: document.getElementById('closeLargeGroupAlertModal'),
            alertSoldierCount: document.getElementById('alertSoldierCount'),
            goBackFromAlert: document.getElementById('goBackFromAlert'),
            approveGroupSignOut: document.getElementById('approveGroupSignOut'),
            
            // Info modal elements
            infoModal: document.getElementById('infoModal'),
            closeInfoModalBtn: document.getElementById('closeInfoModal'),
            infoModalContent: document.getElementById('infoModalContent'),
            
            // Search and filter elements
            searchInput: document.getElementById('searchInput'),
            clearSearchBtn: document.getElementById('clearSearchBtn'),
            
            // Table elements
            currentSignOutsTableBody: document.getElementById('currentSignOutsTableBody'),
            logsTableBody: document.getElementById('logsTableBody'),
            emptyState: document.getElementById('emptyState'),
            logsEmptyState: document.getElementById('logsEmptyState'),
            
            // Statistics elements
            currentlyOutCount: document.getElementById('currentlyOutCount'),
            totalTodayCount: document.getElementById('totalTodayCount'),
            totalRecordsCount: document.getElementById('totalRecordsCount'),
            
            // Filter elements
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            soldierNameFilter: document.getElementById('soldierNameFilter'),
            locationFilter: document.getElementById('locationFilter'),
            statusFilter: document.getElementById('statusFilter'),
            applyFiltersBtn: document.getElementById('applyFiltersBtn'),
            clearFiltersBtn: document.getElementById('clearFiltersBtn'),
            exportCsvBtn: document.getElementById('exportCsvBtn'),
            
            // Sign out details modal
            // signOutDetailsModal: document.getElementById('signOutDetailsModal'),
            // signOutDetailsContent: document.getElementById('signOutDetailsContent'),
            // closeSignOutDetailsModal: document.getElementById('closeSignOutDetailsModal'),
            // exportPdfBtn: document.getElementById('exportPdfBtn'),

            // Settings elements
            currentUserDisplay: document.getElementById('currentUserDisplay'),
            maxSignOutDuration: document.getElementById('maxSignOutDuration'),
            warningThreshold: document.getElementById('warningThreshold'),
            updateDurationBtn: document.getElementById('updateDurationBtn'),
            updateWarningBtn: document.getElementById('updateWarningBtn'),
            exportAllDataBtn: document.getElementById('exportAllDataBtn'),
            backupDataBtn: document.getElementById('backupDataBtn'),
            clearOldRecordsBtn: document.getElementById('clearOldRecordsBtn'),
            resetSystemBtn: document.getElementById('resetSystemBtn'),
            
            // User accounts elements
            accountsTableBody: document.getElementById('accountsTableBody'),
            accountsEmptyState: document.getElementById('accountsEmptyState'),
            addUserBtn: document.getElementById('addUserBtn'),
            
            // Add user modal elements
            addUserModal: document.getElementById('addUserModal'),
            closeAddUserModalBtn: document.getElementById('closeAddUserModal'),
            addUserForm: document.getElementById('addUserForm'),
            cancelAddUser: document.getElementById('cancelAddUser'),
            submitAddUser: document.getElementById('submitAddUser'),
            addUserError: document.getElementById('addUserError'),
            
            // Change PIN modal elements
            changePinModal: document.getElementById('changePinModal'),
            closeChangePinModalBtn: document.getElementById('closeChangePinModal'),
            changePinForm: document.getElementById('changePinForm'),
            changePinUserId: document.getElementById('changePinUserId'),
            changePinUserInfo: document.getElementById('changePinUserInfo'),
            cancelChangePin: document.getElementById('cancelChangePin'),
            submitChangePin: document.getElementById('submitChangePin'),
            changePinError: document.getElementById('changePinError'),
            
            // Delete user modal elements
            deleteUserModal: document.getElementById('deleteUserModal'),
            closeDeleteUserModalBtn: document.getElementById('closeDeleteUserModal'),
            deleteUserForm: document.getElementById('deleteUserForm'),
            deleteUserId: document.getElementById('deleteUserId'),
            deleteUserInfo: document.getElementById('deleteUserInfo'),
            cancelDeleteUser: document.getElementById('cancelDeleteUser'),
            submitDeleteUser: document.getElementById('submitDeleteUser'),
            deleteUserError: document.getElementById('deleteUserError'),
            
            // Change admin credentials modal elements
            changeAdminCredentialsModal: document.getElementById('changeAdminCredentialsModal'),
            closeChangeAdminCredentialsModalBtn: document.getElementById('closeChangeAdminCredentialsModalBtn'),
            changeAdminCredentialsForm: document.getElementById('changeAdminCredentialsForm'),
            adminCredentialsUserId: document.getElementById('adminCredentialsUserId'),
            cancelChangeAdminCredentials: document.getElementById('cancelChangeAdminCredentials'),
            submitChangeAdminCredentials: document.getElementById('submitChangeAdminCredentials'),
            changeAdminCredentialsError: document.getElementById('changeAdminCredentialsError'),
            
            // Manage permissions modal elements
            managePermissionsModal: document.getElementById('managePermissionsModal'),
            closeManagePermissionsModalBtn: document.getElementById('closeManagePermissionsModalBtn'),
            managePermissionsForm: document.getElementById('managePermissionsForm'),
            permissionsUserName: document.getElementById('permissionsUserName'),
            permissionsCheckboxes: document.getElementById('permissionsCheckboxes'),
            cancelManagePermissions: document.getElementById('cancelManagePermissions'),
            submitManagePermissions: document.getElementById('submitManagePermissions'),
            managePermissionsError: document.getElementById('managePermissionsError'),
            
            // Change own credentials modal elements
            changeOwnCredentialsBtn: document.getElementById('changeOwnCredentialsBtn'),
            changeOwnCredentialsModal: document.getElementById('changeOwnCredentialsModal'),
            closeChangeOwnCredentialsModal: document.getElementById('closeChangeOwnCredentialsModal'),
            changeOwnCredentialsForm: document.getElementById('changeOwnCredentialsForm'),
            currentPinOwn: document.getElementById('currentPinOwn'),
            newPinOwn: document.getElementById('newPinOwn'),
            confirmPinOwn: document.getElementById('confirmPinOwn'),
            cancelChangeOwnCredentials: document.getElementById('cancelChangeOwnCredentials'),
            submitChangeOwnCredentials: document.getElementById('submitChangeOwnCredentials'),
            changeOwnCredentialsError: document.getElementById('changeOwnCredentialsError'),
            myAccountUserDisplay: document.getElementById('myAccountUserDisplay')
        };
    }

    get(elementName) {
        return this.elements[elementName];
    }

    getAll() {
        return this.elements;
    }

    refresh() {
        this.initializeElements();
    }

    /**
     * Refresh specific DOM element references (useful when elements are recreated)
     */
    refreshElement(elementName) {
        switch(elementName) {
            case 'searchInput':
                this.elements.searchInput = document.getElementById('searchInput');
                break;
            case 'currentSignOutsTableBody':
                this.elements.currentSignOutsTableBody = document.getElementById('currentSignOutsTableBody');
                break;
            // Add more cases as needed
        }
    }

    /**
     * Refresh all DOM element references
     */
    refreshAllElements() {
        this.initializeElements();
    }
}


export default DOMManager;
