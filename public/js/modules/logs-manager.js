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
                
                return `
                    <tr data-signout-id="${log.signout_id}" class="log-row">
                        <td><span class="id-badge">${log.signout_id}</span></td>
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
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('export_data')) {
            this.app.permissionsManager?.showPermissionDenied('export data');
            return;
        }
        
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
        const doc = new window.jsPDF();
        
        doc.setFontSize(20);
        doc.text('Sign-Out Logs Report', 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Generated: ${Utils.formatDateTime(Utils.getCurrentUTC())}`, 20, 30);
        
        doc.text(`Total Records: ${logs.length}`, 20, 40);
        
        let y = 55;
        
        doc.setFontSize(10);
        doc.text('ID', 20, y);
        doc.text('Soldiers', 35, y);
        doc.text('Location', 80, y);
        doc.text('Out Time', 120, y);
        doc.text('Status', 160, y);
        
        y += 10;
        
        doc.line(20, y - 5, 190, y - 5);
        
        logs.forEach((log, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
                
                doc.text('ID', 20, y);
                doc.text('Soldiers', 35, y);
                doc.text('Location', 80, y);
                doc.text('Out Time', 120, y);
                doc.text('Status', 160, y);
                y += 10;
                doc.line(20, y - 5, 190, y - 5);
            }
            
            const soldierNames = log.soldiers && Array.isArray(log.soldiers) 
                ? log.soldiers.map(s => `${s.rank} ${s.last_name}`).join(', ')
                : `${log.soldier_rank} ${log.soldier_last_name}` || 'Unknown';
            
            doc.text(String(log.signout_id), 20, y);
            doc.text(soldierNames.substring(0, 25), 35, y);
            doc.text(log.location.substring(0, 20), 80, y);
            doc.text(Utils.formatDate(log.sign_out_time), 120, y);
            doc.text(log.status, 160, y);
            
            y += 8;
        });
        
        doc.save(`signout-logs-${Utils.getCurrentUTC().split('T')[0]}.pdf`);
        this.app.notificationManager.showNotification('PDF exported successfully', 'success');
    }
}

export default LogsManager;
