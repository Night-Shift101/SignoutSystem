/**
 * Audit Logs Manager - Frontend
 * Handles audit logs viewing, filtering, and pagination in the settings section
 * 
 * @author SignOuts System
 * @version 1.0.0
 */

import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';
import Utils from './utils.js';

class AuditLogsManager {
    constructor(app) {
        this.app = app;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('AuditLogsManager');
        
        // Pagination and filtering state
        this.currentPage = 1;
        this.pageSize = 5; // Default to 5 entries
        this.totalEntries = 0;
        this.currentFilters = {};
        this.isLoading = false;
        
        // Data storage
        this.auditLogsData = [];
        
        // Cache for users list (for filter dropdown)
        this.usersCache = [];
        
        this.initializeElements();
        this.attachEventListeners();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Main containers
        this.auditLogsSection = document.getElementById('auditLogsSection');
        this.auditLogsTableBody = document.getElementById('auditLogsTableBody');
        this.auditLogsEmptyState = document.getElementById('auditLogsEmptyState');
        this.auditLogsLoadingState = document.getElementById('auditLogsLoadingState');
        
        // Stats elements
        this.totalAuditEntries = document.getElementById('totalAuditEntries');
        this.recentAuditEntries = document.getElementById('recentAuditEntries');
        this.userActionCount = document.getElementById('userActionCount');
        
        // Filter controls
        this.auditActionFilter = document.getElementById('auditActionFilter');
        this.auditTableFilter = document.getElementById('auditTableFilter');
        this.auditUserFilter = document.getElementById('auditUserFilter');
        this.auditSearchInput = document.getElementById('auditSearchInput');
        this.auditPageSizeSelect = document.getElementById('auditPageSizeSelect');
        
        // Action buttons
        this.clearAuditFiltersBtn = document.getElementById('clearAuditFiltersBtn');
        this.refreshAuditLogsBtn = document.getElementById('refreshAuditLogsBtn');
        
        // Pagination controls
        this.auditLogsPagination = document.getElementById('auditLogsPagination');
        this.auditPaginationInfo = document.getElementById('auditPaginationInfo');
        this.auditPageStatus = document.getElementById('auditPageStatus');
        this.auditPrevPageBtn = document.getElementById('auditPrevPageBtn');
        this.auditNextPageBtn = document.getElementById('auditNextPageBtn');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Filter controls
        this.auditActionFilter?.addEventListener('change', () => this.applyFilters());
        this.auditTableFilter?.addEventListener('change', () => this.applyFilters());
        this.auditUserFilter?.addEventListener('change', () => this.applyFilters());
        
        // Search input with debounce
        this.auditSearchInput?.addEventListener('input', this.debounce(() => this.applyFilters(), 500));
        
        // Page size selector
        this.auditPageSizeSelect?.addEventListener('change', () => this.changePageSize());
        
        // Action buttons
        this.clearAuditFiltersBtn?.addEventListener('click', () => this.clearFilters());
        this.refreshAuditLogsBtn?.addEventListener('click', () => this.refreshAuditLogs());
        
        // Pagination buttons
        this.auditPrevPageBtn?.addEventListener('click', () => this.previousPage());
        this.auditNextPageBtn?.addEventListener('click', () => this.nextPage());
    }

    /**
     * Check if user has permission to view audit logs
     * @returns {boolean}
     */
    canViewAuditLogs() {
        return this.app.permissionsManager?.canViewAuditLogs() || false;
    }

    /**
     * Initialize audit logs section (called when settings are loaded)
     */
    async initializeAuditLogs() {
        try {
            if (!this.canViewAuditLogs()) {
                // Hide audit logs section if user doesn't have permission
                if (this.auditLogsSection) {
                    this.auditLogsSection.style.display = 'none';
                }
                return;
            }

            // Show audit logs section
            if (this.auditLogsSection) {
                this.auditLogsSection.style.display = 'block';
            }

            // Load initial data
            await this.loadUsersForFilter();
            await this.loadAuditStats();
            await this.loadAuditLogs();

        } catch (error) {
            console.error('Error initializing audit logs:', error);
            this.app.notificationManager?.showNotification('Failed to initialize audit logs', 'error');
        }
    }

    /**
     * Load users for the filter dropdown
     */
    async loadUsersForFilter() {
        try {
            const response = await Utils.fetchWithAuth('/api/users');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load users');
            }

            this.usersCache = result.data || [];
            this.populateUserFilter();

        } catch (error) {
            console.error('Error loading users for filter:', error);
            // Don't show notification for this, it's not critical
        }
    }

    /**
     * Populate the user filter dropdown
     */
    populateUserFilter() {
        if (!this.auditUserFilter) return;

        // Clear existing options (except "All Users")
        this.auditUserFilter.innerHTML = '<option value="">All Users</option>';

        this.usersCache.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.rank} ${user.full_name}`;
            this.auditUserFilter.appendChild(option);
        });
    }

    /**
     * Load audit log statistics
     */
    async loadAuditStats() {
        try {
            const response = await Utils.fetchWithAuth('/api/audit-logs/stats');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load audit statistics');
            }

            const stats = result.data;
            this.updateStatsDisplay(stats);

        } catch (error) {
            console.error('Error loading audit stats:', error);
            // Reset stats display to defaults
            this.updateStatsDisplay({});
        }
    }

    /**
     * Update the statistics display
     * @param {Object} stats - Statistics data
     */
    updateStatsDisplay(stats = {}) {
        if (this.totalAuditEntries) {
            this.totalAuditEntries.textContent = stats.totalEntries || '-';
        }
        if (this.recentAuditEntries) {
            this.recentAuditEntries.textContent = stats.last24Hours || '-';
        }
        if (this.userActionCount) {
            this.userActionCount.textContent = stats.userActions || '-';
        }
    }

    /**
     * Load audit logs with current filters and pagination
     */
    async loadAuditLogs() {
        if (this.isLoading) return;

        try {
            this.setLoadingState(true);

            // Build query parameters
            const params = new URLSearchParams({
                limit: this.pageSize.toString(),
                offset: ((this.currentPage - 1) * this.pageSize).toString()
            });

            // Add filters
            Object.entries(this.currentFilters).forEach(([key, value]) => {
                if (value && value.trim()) {
                    params.append(key, value.trim());
                }
            });

            const response = await Utils.fetchWithAuth(`/api/audit-logs?${params.toString()}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load audit logs');
            }

            const { logs, pagination } = result.data;
            this.totalEntries = pagination.total;

            // Store the audit logs data for details modal access
            this.auditLogsData = logs || [];

            this.renderAuditLogs(logs);
            this.updatePaginationControls(pagination);

        } catch (error) {
            console.error('Error loading audit logs:', error);
            this.showError('Failed to load audit logs. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Render audit logs in the table
     * @param {Array} logs - Array of audit log entries
     */
    renderAuditLogs(logs) {
        if (!this.auditLogsTableBody) return;

        if (!logs || logs.length === 0) {
            this.auditLogsTableBody.innerHTML = '';
            this.showEmptyState(true);
            this.auditLogsPagination.style.display = 'none';
            return;
        }

        this.showEmptyState(false);
        this.auditLogsPagination.style.display = 'flex';

        this.auditLogsTableBody.innerHTML = logs.map(log => {
            const timestamp = Utils.formatDateTime(log.timestamp);
            const date = Utils.formatDate(log.timestamp);
            const time = Utils.formatTime(log.timestamp);
            const actionBadgeClass = this.getActionBadgeClass(log.action_type);
            const targetInfo = this.formatTargetInfo(log);
            const detailsButton = this.formatDetailsButton(log);

            return `
                <tr>
                    <td>
                        <div class="timestamp-cell">
                            <span class="date">${date}</span>
                            <span class="time">${time}</span>
                        </div>
                    </td>
                    <td>
                        <div class="user-cell">
                            <span class="user-name">${this.formatUserDisplay(log)}</span>
                            <span class="user-ip">${log.ip_address || ''}</span>
                        </div>
                    </td>
                    <td>
                        <span class="action-badge ${actionBadgeClass}">${log.action_type}</span>
                    </td>
                    <td>
                        <div class="target-cell">
                            ${targetInfo}
                        </div>
                    </td>
                    <td>
                        <div class="description-cell">
                            ${log.description || '-'}
                        </div>
                    </td>
                    <td>
                        ${detailsButton}
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners for details buttons
        this.attachDetailsButtonListeners();
    }

    /**
     * Format user display as "Rank Name (UserID)"
     * @param {Object} log - Audit log entry
     * @returns {string} Formatted user display
     */
    formatUserDisplay(log) {
        // Extract user info from user_name which might be in format "Rank Name" or just "Name"
        const userName = log.user_name || 'System';
        const userId = log.user_id;
        
        if (userId && userName !== 'System') {
            return `${userName} (${userId})`;
        }
        
        return userName;
    }

    /**
     * Get CSS class for action badge based on action type
     * @param {string} actionType - The action type
     * @returns {string} CSS class name
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
     * Format target information
     * @param {Object} log - Audit log entry
     * @returns {string} Formatted target info
     */
    formatTargetInfo(log) {
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
     * Format details button for audit log entry
     * @param {Object} log - Audit log entry
     * @returns {string} HTML for details button
     */
    formatDetailsButton(log) {
        const hasOldValues = log.old_values && Object.keys(log.old_values).length > 0;
        const hasNewValues = log.new_values && Object.keys(log.new_values).length > 0;
        
        if (hasOldValues || hasNewValues) {
            return `
                <button type="button" class="btn btn-sm btn-info audit-details-btn" 
                        data-log-id="${log.id}">
                    <span class="icon">👁</span> Details
                </button>
            `;
        }
        return '-';
    }

    /**
     * Attach event listeners to details buttons
     */
    attachDetailsButtonListeners() {
        const detailsButtons = document.querySelectorAll('.audit-details-btn');
        detailsButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const logId = e.target.closest('.audit-details-btn').dataset.logId;
                this.showAuditDetails(logId);
            });
        });
    }

    /**
     * Show audit details modal
     * @param {string} logId - Audit log ID
     */
    async showAuditDetails(logId) {
        try {
            // Ensure we have audit logs data
            if (!this.auditLogsData || !Array.isArray(this.auditLogsData)) {
                console.warn('Audit logs data not available, attempting to reload...');
                await this.loadAuditLogs();
                
                // If still no data, show error
                if (!this.auditLogsData || !Array.isArray(this.auditLogsData)) {
                    this.app.notificationManager?.showNotification('Unable to load audit log details', 'error');
                    return;
                }
            }

            // Find the log entry in our current data
            const log = this.auditLogsData.find(l => l.id.toString() === logId.toString());
            if (!log) {
                console.warn(`Audit log with ID ${logId} not found in current data`);
                this.app.notificationManager?.showNotification('Audit log not found in current view', 'warning');
                return;
            }

            // Use the modal manager to show the details
            if (this.app.modalManager) {
                this.app.modalManager.showAuditDetailsModal(log);
            } else {
                // Fallback: show detailed info in notification
                const details = this.formatAuditDetailsText(log);
                this.app.notificationManager?.showNotification(details, 'info');
            }
        } catch (error) {
            console.error('Error showing audit details:', error);
            this.app.notificationManager?.showNotification('Error loading audit details', 'error');
        }
    }

    /**
     * Format audit details as text (fallback)
     * @param {Object} log - Audit log entry
     * @returns {string} Formatted details
     */
    formatAuditDetailsText(log) {
        let details = `Audit Log #${log.id}\n`;
        details += `Action: ${log.action_type}\n`;
        details += `Target: ${log.table_name}`;
        if (log.record_id) details += ` #${log.record_id}`;
        details += `\nUser: ${this.formatUserDisplay(log)}\n`;
        details += `Time: ${Utils.formatDateTime(log.timestamp)}\n`;
        details += `Description: ${log.description}\n`;
        
        if (log.old_values) {
            details += `\nOld Values:\n${JSON.stringify(log.old_values, null, 2)}`;
        }
        
        if (log.new_values) {
            details += `\nNew Values:\n${JSON.stringify(log.new_values, null, 2)}`;
        }
        
        return details;
    }

    /**
     * Update pagination controls
     * @param {Object} pagination - Pagination data
     */
    updatePaginationControls(pagination) {
        if (!this.auditLogsPagination) return;

        const { limit, offset, total, hasMore } = pagination;
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit);
        const startItem = offset + 1;
        const endItem = Math.min(offset + limit, total);

        // Update pagination info
        if (this.auditPaginationInfo) {
            this.auditPaginationInfo.textContent = `Showing ${startItem}-${endItem} of ${total} entries`;
        }

        // Update page status
        if (this.auditPageStatus) {
            this.auditPageStatus.textContent = `Page ${currentPage} of ${totalPages}`;
        }

        // Update button states
        if (this.auditPrevPageBtn) {
            this.auditPrevPageBtn.disabled = currentPage <= 1;
        }

        if (this.auditNextPageBtn) {
            this.auditNextPageBtn.disabled = !hasMore;
        }
    }

    /**
     * Apply current filters
     */
    applyFilters() {
        // Collect filter values
        this.currentFilters = {};

        if (this.auditActionFilter?.value) {
            this.currentFilters.action_type = this.auditActionFilter.value;
        }

        if (this.auditTableFilter?.value) {
            this.currentFilters.table_name = this.auditTableFilter.value;
        }

        if (this.auditUserFilter?.value) {
            this.currentFilters.user_id = this.auditUserFilter.value;
        }

        if (this.auditSearchInput?.value) {
            this.currentFilters.search = this.auditSearchInput.value;
        }

        // Reset to first page when filters change
        this.currentPage = 1;

        // Reload audit logs
        this.loadAuditLogs();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        if (this.auditActionFilter) this.auditActionFilter.value = '';
        if (this.auditTableFilter) this.auditTableFilter.value = '';
        if (this.auditUserFilter) this.auditUserFilter.value = '';
        if (this.auditSearchInput) this.auditSearchInput.value = '';

        this.currentFilters = {};
        this.currentPage = 1;

        this.loadAuditLogs();
    }

    /**
     * Refresh audit logs
     */
    async refreshAuditLogs() {
        await this.loadAuditStats();
        await this.loadAuditLogs();
        this.app.notificationManager?.showNotification('Audit logs refreshed', 'success');
    }

    /**
     * Change page size and reload data
     */
    changePageSize() {
        const newPageSize = parseInt(this.auditPageSizeSelect?.value) || 5;
        this.pageSize = newPageSize;
        this.currentPage = 1; // Reset to first page
        this.loadAuditLogs();
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadAuditLogs();
        }
    }

    /**
     * Go to next page
     */
    nextPage() {
        this.currentPage++;
        this.loadAuditLogs();
    }

    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     */
    setLoadingState(loading) {
        this.isLoading = loading;

        if (this.auditLogsLoadingState) {
            this.auditLogsLoadingState.style.display = loading ? 'block' : 'none';
        }

        if (this.refreshAuditLogsBtn) {
            this.refreshAuditLogsBtn.disabled = loading;
        }
    }

    /**
     * Show/hide empty state
     * @param {boolean} show - Whether to show empty state
     */
    showEmptyState(show) {
        if (this.auditLogsEmptyState) {
            this.auditLogsEmptyState.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.app.notificationManager?.showNotification(message, 'error');
        this.showEmptyState(true);
    }

    /**
     * Utility function for debouncing
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

export default AuditLogsManager;
