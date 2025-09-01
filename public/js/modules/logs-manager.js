import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class LogsManager {
    constructor(app) {
        this.app = app;
        this.currentLogs = null;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('LogsManager');
    }

    async loadFilteredLogs() {
        try {
            const startDate = this.app.domManager.get('startDate');
            const endDate = this.app.domManager.get('endDate');
            const soldierNameFilter = this.app.domManager.get('soldierNameFilter');
            const locationFilter = this.app.domManager.get('locationFilter');
            const statusFilter = this.app.domManager.get('statusFilter');
            
            const params = new URLSearchParams();
            if (startDate?.value) params.append('startDate', startDate.value);
            if (endDate?.value) params.append('endDate', endDate.value);
            if (soldierNameFilter?.value) params.append('soldierName', soldierNameFilter.value);
            if (locationFilter?.value) params.append('location', locationFilter.value);
            if (statusFilter?.value) params.append('status', statusFilter.value);
            
            const response = await Utils.fetchWithAuth(`/api/signouts?${params}`);
            
            if (!response.ok) throw new Error('Failed to fetch logs');
            
            const result = await response.json();
            
            // Handle standardized response format
            if (!result.success) {
                console.error('Error loading logs:', result.error || 'Unknown error');
                throw new Error(result.error || 'Failed to load logs');
            }
            
            let logs = result.data; // Extract logs from standardized response
            
            // Validate that we received valid logs data
            if (!logs || !Array.isArray(logs)) {
                console.error('Error loading logs: Invalid logs data', result);
                throw new Error('Invalid logs data received from server');
            }
            
            // If soldier name filter is applied, get all soldiers from matching sign-out groups
            if (soldierNameFilter?.value) {
                logs = await this.expandLogsWithGroupMembers(logs);
            }
            
            this.currentLogs = logs;
            this.renderLogsTable(logs);
            
            // Reapply permission-based visibility after loading data
            if (this.app.permissionsManager) {
                this.app.permissionsManager.applyPermissionBasedVisibility();
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            this.app.notificationManager.showNotification('Failed to load logs', 'error');
        }
    }

    async expandLogsWithGroupMembers(logs) {
        try {
            // Extract unique sign-out IDs from the filtered results
            const signOutIds = [...new Set(logs.map(log => log.signout_id))];
            
            if (signOutIds.length === 0) return logs;
            
            // Fetch all soldiers for these sign-out IDs
            const response = await Utils.fetchWithAuth('/api/signouts/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signOutIds })
            });
            
            if (!response.ok) {
                console.warn('Failed to fetch group members, returning original logs');
                return logs;
            }
            
            const result = await response.json();
            
            // Handle standardized response format
            if (!result.success) {
                console.warn('Failed to fetch group members:', result.error || 'Unknown error');
                return logs;
            }
            
            const expandedLogs = result.data; // Extract logs from standardized response
            
            // Validate that we received valid data
            if (!expandedLogs || !Array.isArray(expandedLogs)) {
                console.warn('Invalid group members data received, returning original logs');
                return logs;
            }
            
            return expandedLogs;
            
        } catch (error) {
            console.error('Error expanding logs with group members:', error);
            return logs; // Return original logs if expansion fails
        }
    }

    renderLogsTable(logs) {
        const tbody = this.app.domManager.get('logsTableBody');
        const emptyState = this.app.domManager.get('logsEmptyState');
        
        if (!logs || logs.length === 0) {
            if (tbody) tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        if (tbody) {
            tbody.innerHTML = logs.map(log => {
                const signOutTime = Utils.formatTime(log.sign_out_time);
                const signInTime = log.sign_in_time ? Utils.formatTime(log.sign_in_time) : 'N/A';
                const duration = log.sign_in_time 
                    ? Utils.calculateDuration(log.sign_out_time, log.sign_in_time)
                    : Utils.calculateDuration(log.sign_out_time);
                
                // Create location options badges
                let locationOptions = [];
                try {
                    locationOptions = log.location_options ? JSON.parse(log.location_options) : [];
                } catch (e) {
                    console.warn('Invalid location_options JSON:', log.location_options);
                    locationOptions = [];
                }
                const locationBadges = locationOptions.map(option => {
                    const shortCodes = {
                        'Off Post': 'OP',
                        'VI+ Escort': 'VI+',
                        'Pass': 'P',
                        'Leave': 'L'
                    };
                    return `<span class="location-badge">${shortCodes[option] || option}</span>`;
                }).join('');
                
                return `
                    <tr data-signout-id="${log.signout_id}" class="log-row">
                        <td>
                            <div class="signout-id">
                                <span class="id-badge">${log.signout_id}</span>
                                ${locationBadges ? `<div class="location-badges">${locationBadges}</div>` : ''}
                            </div>
                        </td>
                        <td>
                            ${Utils.renderSoldierChipsForTable(log.soldiers, log.soldier_count)}
                        </td>
                        <td>${log.location}</td>
                        <td>${signOutTime}</td>
                        <td>${signInTime}</td>
                        <td>${duration}</td>
                        <td>${log.signed_out_by_name}</td>
                        <td>${log.signed_in_by_name || 'N/A'}</td>
                        <td><span class="status-badge status-${log.status.toLowerCase()}">${log.status}</span></td>
                        <td>${log.notes || ''}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    clearFilters() {
        const startDate = this.app.domManager.get('startDate');
        const endDate = this.app.domManager.get('endDate');
        const soldierNameFilter = this.app.domManager.get('soldierNameFilter');
        const locationFilter = this.app.domManager.get('locationFilter');
        const statusFilter = this.app.domManager.get('statusFilter');
        
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        if (soldierNameFilter) soldierNameFilter.value = '';
        if (locationFilter) locationFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        
        this.currentLogs = null; // Clear cached logs
        this.loadFilteredLogs();
    }

    async exportLogs() {
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('export_data')) {
            this.app.permissionsManager?.showPermissionDenied('export data');
            return;
        }
        
        try {
            Utils.showLoading(true);            
            const startDate = this.app.domManager.get('startDate');
            const endDate = this.app.domManager.get('endDate');
            const soldierNameFilter = this.app.domManager.get('soldierNameFilter');
            const locationFilter = this.app.domManager.get('locationFilter');
            const statusFilter = this.app.domManager.get('statusFilter');
            
            const params = new URLSearchParams();
            if (startDate?.value) params.append('startDate', startDate.value);
            if (endDate?.value) params.append('endDate', endDate.value);
            if (soldierNameFilter?.value) params.append('soldierName', soldierNameFilter.value);
            if (locationFilter?.value) params.append('location', locationFilter.value);
            if (statusFilter?.value) params.append('status', statusFilter.value);
            
            const response = await Utils.fetchWithAuth(`/api/signouts/export/logs?${params}`);
            
            if (!response.ok) throw new Error('Failed to export logs');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `signout-logs-${Utils.getCurrentUTC().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.app.notificationManager.showNotification('Logs exported successfully', 'success');
            
        } catch (error) {
            console.error('Error exporting logs:', error);
            this.app.notificationManager.showNotification('Failed to export logs', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    generateCSVFromLogs(logs) {
        let csvContent = 'Sign-Out ID,Soldiers,Location,Sign Out Time,Sign In Time,Duration,Signed Out By,Signed In By,Status,Notes\n';
        
        logs.forEach(log => {
            const soldierNames = log.soldiers && Array.isArray(log.soldiers) 
                ? log.soldiers.map(s => `${s.rank} ${s.lastName}`).join('; ')
                : 'Unknown';
            const signOutTime = Utils.formatDateTime(log.sign_out_time);
            const signInTime = log.sign_in_time ? Utils.formatDateTime(log.sign_in_time) : 'N/A';
            const duration = log.sign_in_time 
                ? Utils.calculateDuration(log.sign_out_time, log.sign_in_time)
                : Utils.calculateDuration(log.sign_out_time);
            
            const row = [
                log.signout_id,
                soldierNames,
                log.location,
                signOutTime,
                signInTime,
                duration,
                log.signed_out_by_name || '',
                log.signed_in_by_name || 'N/A',
                log.status,
                log.notes || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            
            csvContent += row + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `signout-logs-${Utils.getCurrentUTC().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.app.notificationManager.showNotification('Logs exported successfully', 'success');
    }

    async exportLogsPDF() {
        console.log('exportLogsPDF called');
        
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('export_data')) {
            this.app.permissionsManager?.showPermissionDenied('export data');
            return;
        }
        
        console.log('Permissions check passed');
        
        // Check if jsPDF is loaded
        if (!window.jspdf?.jsPDF) {
            console.error('jsPDF library not loaded');
            this.app.notificationManager.showNotification('PDF library not loaded', 'error');
            return;
        }
        
        console.log('jsPDF library available');
        
        // Check if PDF generator is available
        if (!this.app.pdfGenerator) {
            console.error('PDF generator not available');
            this.app.notificationManager.showNotification('PDF generator not initialized', 'error');
            return;
        }
        
        console.log('PDF generator available');
        
        try {
            Utils.showLoading(true);
            
            // Use currentLogs if available (which includes expanded groups), otherwise fetch fresh data
            if (this.currentLogs && this.currentLogs.length > 0) {
                this.generateLogsPDF(this.currentLogs);
                return;
            }
            
            const startDate = this.app.domManager.get('startDate');
            const endDate = this.app.domManager.get('endDate');
            const soldierNameFilter = this.app.domManager.get('soldierNameFilter');
            const locationFilter = this.app.domManager.get('locationFilter');
            const statusFilter = this.app.domManager.get('statusFilter');
            
            const params = new URLSearchParams();
            if (startDate?.value) params.append('startDate', startDate.value);
            if (endDate?.value) params.append('endDate', endDate.value);
            if (soldierNameFilter?.value) params.append('soldierName', soldierNameFilter.value);
            if (locationFilter?.value) params.append('location', locationFilter.value);
            if (statusFilter?.value) params.append('status', statusFilter.value);
            
            const response = await Utils.fetchWithAuth(`/api/signouts/logs?${params}`);
            
            if (!response.ok) throw new Error('Failed to fetch logs for PDF export');
            
            const logs = await response.json();
            this.generateLogsPDF(logs);
            
        } catch (error) {
            console.error('Error exporting logs as PDF:', error);
            this.app.notificationManager.showNotification('Failed to export logs as PDF', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    generateLogsPDF(logs) {
        try {
            // Transform logs data to match PDFGenerator expected format
            const transformedData = {
                signOuts: logs.map(log => ({
                    id: log.signout_id,
                    soldiers: log.soldiers && Array.isArray(log.soldiers) 
                        ? log.soldiers.map(s => ({
                            rank: s.rank,
                            lastName: s.last_name,
                            firstName: s.first_name || ''
                        }))
                        : [{
                            rank: log.soldier_rank || '',
                            lastName: log.soldier_last_name || 'Unknown',
                            firstName: log.soldier_first_name || ''
                        }],
                    location: log.location || 'Unknown',
                    signOutTime: log.sign_out_time,
                    expectedReturnTime: log.expected_return_time,
                    returnTime: log.return_time,
                    status: log.status || 'Unknown'
                })),
                summary: {
                    totalSignOuts: logs.length,
                    activeSignOuts: logs.filter(log => log.status === 'Out').length,
                    returnedSignOuts: logs.filter(log => log.status === 'Returned').length
                }
            };

            // Get applied filters for report context
            const filters = this.getAppliedFilters();
            
            // Generate PDF using the enhanced PDFGenerator
            this.app.pdfGenerator.generateSignOutPDF(transformedData, {
                title: 'Sign-Out Logs Report',
                filters: filters,
                includeStats: true
            });
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.app.notificationManager.showNotification('Failed to generate PDF report', 'error');
        }
    }

    getAppliedFilters() {
        const filters = {};
        
        const startDate = this.app.domManager.get('startDate');
        const endDate = this.app.domManager.get('endDate');
        const soldierNameFilter = this.app.domManager.get('soldierNameFilter');
        const locationFilter = this.app.domManager.get('locationFilter');
        const statusFilter = this.app.domManager.get('statusFilter');
        
        if (startDate?.value) filters.startDate = startDate.value;
        if (endDate?.value) filters.endDate = endDate.value;
        if (soldierNameFilter?.value) filters.soldierName = soldierNameFilter.value;
        if (locationFilter?.value) filters.location = locationFilter.value;
        if (statusFilter?.value) filters.status = statusFilter.value;
        
        return filters;
    }
}

export default LogsManager;
