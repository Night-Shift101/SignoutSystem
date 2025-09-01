import DOMManager from './modules/dom-manager.js';
import NotificationManager from './modules/notifications.js';
import BarcodeManager from './modules/barcode-manager.js';
import BarcodeParser from './modules/barcode-parser.js';
import AuthManager from './modules/auth-manager.js';
import ModalManager from './modules/modal-manager.js';
import ViewManager from './modules/view-manager.js';
import EventManager from './modules/event-manager.js';
import SignOutManager from './modules/signout-manager.js';
import LogsManager from './modules/logs-manager.js';
import UserManager from './modules/user-manager.js';
import SettingsManager from './modules/settings-manager.js';
import AuditLogsManager from './modules/audit-logs-manager.js';
import ThemeManager from './modules/theme-manager.js';
import KeyboardManager from './modules/keyboard-manager.js';
import ConnectionManager from './modules/connection-manager.js';
import PermissionsManager from './modules/permissions-manager.js';
import ConfigManager from './modules/config-manager.js';
import PDFGenerator from './modules/pdf-generator.js';
import Utils from './modules/utils.js';
import { globalFrontendErrorHandler } from './modules/frontend-error-handler.js';

class SoldierSignOutApp {
    constructor() {
        this.currentUser = null;
        this.currentSignOutId = null;
        
        // Initialize error handler first
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('SoldierSignOutApp');
        
        this.initializeManagers();
        this.initializeElements();
        this.attachEventListeners();
        this.loadConfigurationAndAuth();
    }

    async loadConfigurationAndAuth() {
        // Load configuration first
        await this.configManager.loadConfig();
        this.applyConfiguration();
        
        // Then check authentication
        this.authManager.checkAuthentication();
    }

    /**
     * Apply configuration settings to UI elements
     */
    applyConfiguration() {
        const noCacBtn = document.getElementById('noCacBtn');
        const devFillBtn = document.getElementById('devFillBtn');
        
        // Show/hide No CAC link based on configuration
        if (noCacBtn) {
            noCacBtn.style.display = this.configManager.shouldShowNoCacLink() ? 'inline-block' : 'none';
        }
        
        // Show/hide Dev button based on configuration
        if (devFillBtn) {
            devFillBtn.style.display = this.configManager.shouldShowDevButton() ? 'inline-block' : 'none';
        }
        
        console.log('Configuration applied:', {
            showNoCacLink: this.configManager.shouldShowNoCacLink(),
            showDevButton: this.configManager.shouldShowDevButton()
        });
    }

    initializeManagers() {
        this.domManager = new DOMManager();
        this.notificationManager = new NotificationManager();
        this.configManager = new ConfigManager();
        
        // Configure global error handler with notification manager
        globalFrontendErrorHandler.notificationManager = this.notificationManager;
        
        this.barcodeManager = new BarcodeManager(this.notificationManager);
        this.authManager = new AuthManager(this);
        this.permissionsManager = new PermissionsManager(this);
        this.modalManager = new ModalManager(this);
        this.viewManager = new ViewManager(this);
        this.eventManager = new EventManager(this);
        this.signOutManager = new SignOutManager(this);
        this.logsManager = new LogsManager(this);
        this.userManager = new UserManager(this);
        this.settingsManager = new SettingsManager(this);
        this.auditLogsManager = new AuditLogsManager(this);
        this.themeManager = new ThemeManager(this);
        this.keyboardManager = new KeyboardManager(this);
        this.connectionManager = new ConnectionManager(this);
        this.pdfGenerator = new PDFGenerator(this);
        window.barcodeManager = this.barcodeManager;
        window.BarcodeParser = BarcodeParser;
        window.Utils = Utils;
    }

    initializeElements() {
        this.domManager.initializeElements();
    }

    attachEventListeners() {
        this.eventManager.attachEventListeners();
    }

    toggleHamburgerMenu() {
        this.viewManager.toggleHamburgerMenu();
    }

    openHamburgerMenu() {
        this.viewManager.openHamburgerMenu();
    }

    closeHamburgerMenu() {
        this.viewManager.closeHamburgerMenu();
    }

    toggleUserSelector() {
        this.viewManager.toggleUserSelector();
    }

    openUserSelector() {
        this.viewManager.openUserSelector();
    }

    closeUserSelector() {
        this.viewManager.closeUserSelector();
    }

    showDashboardView() {
        this.viewManager.showDashboardView();
    }

    showLogsView() {
        this.viewManager.showLogsView();
    }

    showSettingsView() {
        this.viewManager.showSettingsView();
    }

    showSettingsWithAuth() {
        this.viewManager.showSettingsWithAuth();
    }

    toggleDarkMode() {
        this.themeManager.toggleTheme();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new SoldierSignOutApp();
});
