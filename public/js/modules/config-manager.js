/**
 * Configuration Manager - Handles frontend configuration from environment variables
 * @author PFC Fox, Gavin
 */
class ConfigManager {
    constructor() {
        this.config = {
            showNoCacLink: true,
            showDevButton: false
        };
        this.loaded = false;
    }

    /**
     * Load configuration from the server
     * @returns {Promise<Object>} Configuration object
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const result = await response.json();
            
            if (result.success) {
                this.config = result.data;
                this.loaded = true;
                console.log('Configuration loaded:', this.config);
                return this.config;
            } else {
                console.warn('Failed to load configuration:', result.error);
                return this.config; // Return defaults
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            return this.config; // Return defaults
        }
    }

    /**
     * Get configuration value
     * @param {string} key - Configuration key
     * @returns {any} Configuration value
     */
    get(key) {
        return this.config[key];
    }

    /**
     * Check if No CAC link should be shown
     * @returns {boolean}
     */
    shouldShowNoCacLink() {
        return this.config.showNoCacLink;
    }

    /**
     * Check if Dev button should be shown
     * @returns {boolean}
     */
    shouldShowDevButton() {
        return this.config.showDevButton;
    }

    /**
     * Check if configuration is loaded
     * @returns {boolean}
     */
    isLoaded() {
        return this.loaded;
    }
}

export default ConfigManager;
