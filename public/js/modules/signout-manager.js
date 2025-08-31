class SignOutManager {
    constructor(app) {
        this.app = app;
        this.signouts = [];
        this.filteredSignouts = [];
        this.durationInterval = null;
    }

    async loadCurrentSignOuts() {
        try {
            Utils.showLoading(true);
            const response = await Utils.fetchWithAuth('/api/signouts/reports/current');
            if (!response.ok) throw new Error('Failed to fetch current sign-outs');
            this.signouts = await response.json();
            this.filteredSignouts = [...this.signouts];
            this.renderCurrentSignOuts();
            this.updateCounts();
            
            // Reapply permission-based visibility after loading data
            if (this.app.permissionsManager) {
                this.app.permissionsManager.applyPermissionBasedVisibility();
            }
        } catch (error) {
            console.error('Error loading current sign-outs:', error);
            this.app.notificationManager.showNotification('Failed to load current sign-outs', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    async loadAllSignOuts() {
        try {
            const response = await Utils.fetchWithAuth('/api/signouts');
            if (!response.ok) throw new Error('Failed to fetch all sign-outs');
            return await response.json();
        } catch (error) {
            console.error('Error loading all sign-outs:', error);
            return [];
        }
    }

    async updateCounts() {
        try {
            const allSignOuts = await this.loadAllSignOuts();
            // Get today's date in EST timezone for proper comparison
            const today = Utils.getTodayInDisplayTimezone();
            
            const currentlyOutCount = this.app.domManager.get('currentlyOutCount');
            const totalTodayCount = this.app.domManager.get('totalTodayCount');
            const totalRecordsCount = this.app.domManager.get('totalRecordsCount');
            
            if (currentlyOutCount) {
                currentlyOutCount.textContent = this.signouts.length;
            }
            if (totalTodayCount) {
                totalTodayCount.textContent = allSignOuts.filter(s => {
                    // Convert UTC stored time to display timezone date for comparison
                    const signOutDate = Utils.formatDateForComparison(s.sign_out_time);
                    return signOutDate === today;
                }).length;
            }
            if (totalRecordsCount) {
                totalRecordsCount.textContent = allSignOuts.length;
            }
        } catch (error) {
            console.error('Error updating counts:', error);
        }
    }

    filterCurrentSignOuts() {
        const searchInput = this.app.domManager.get('searchInput');
        const searchTerm = searchInput?.value.toLowerCase() || '';
        
        this.filteredSignouts = this.signouts.filter(signout => {
            const soldierNames = signout.soldier_names.toLowerCase();
            const location = signout.location.toLowerCase();
            const notes = (signout.notes || '').toLowerCase();
            const signedOutBy = signout.signed_out_by_name.toLowerCase();
            
            return soldierNames.includes(searchTerm) ||
                   location.includes(searchTerm) ||
                   notes.includes(searchTerm) ||
                   signedOutBy.includes(searchTerm) ||
                   signout.signout_id.toString().includes(searchTerm);
        });
        
        this.renderCurrentSignOuts();
    }

    renderCurrentSignOuts() {
        const tbody = this.app.domManager.get('currentSignOutsTableBody');
        const emptyState = this.app.domManager.get('emptyState');
        
        if (!tbody) {
            console.warn('Table body not found');
            return;
        }
        
        if (!this.filteredSignouts || this.filteredSignouts.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        tbody.innerHTML = this.filteredSignouts.map(signout => {
            const duration = Utils.calculateDuration(signout.sign_out_time);
            const signOutTime = Utils.formatTime(signout.sign_out_time);
            
            const hours = Utils.getDurationHours(signout.sign_out_time);
            let statusClass = 'status-normal';
            
            if (hours > 8) {
                statusClass = 'status-overdue';
            } else if (hours > 4) {
                statusClass = 'status-warning';
            }
            
            return `
                <tr class="signout-row ${statusClass}">
                    <td>
                        <div class="signout-id">
                            <span class="id-badge">${signout.signout_id}</span>
                        </div>
                    </td>
                    <td>
                        ${Utils.renderSoldierChipsForTable(signout.soldiers || [], signout.soldier_count || 1)}
                    </td>
                    <td>
                        <div class="location-info">
                            <strong>${signout.location}</strong>
                            ${signout.notes ? `<div class="notes">${signout.notes}</div>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="time-info">
                            <div class="sign-out-time">${signOutTime}</div>
                        </div>
                    </td>
                    <td>
                        <div class="duration ${statusClass}">${duration}</div>
                    </td>
                    <td>
                        <div class="signed-by">
                            ${signout.signed_out_by_name}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-secondary btn-sm sign-in-btn" data-signout-id="${signout.signout_id}" data-soldier-names="${signout.soldier_names || 'Unknown'}">
                                Sign In
                            </button>
                            <button class="btn btn-secondary btn-sm info-btn" data-signout-id="${signout.signout_id}" title="View Details">
                                Signout Details
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async handleSignOut(event) {
        event.preventDefault();
        
        // Check permissions
        if (!this.app.permissionsManager?.hasPermission('create_signout')) {
            this.app.permissionsManager?.showPermissionDenied('create sign-outs');
            return;
        }
        
        try {
            const signOutForm = this.app.domManager.get('signOutForm');
            const formData = new FormData(signOutForm);
            const soldiers = this.app.barcodeManager.getSoldiers().map(soldier => {
                // Remove the isManualEntry flag as it's only for UI display
                const { isManualEntry, ...cleanSoldier } = soldier;
                return cleanSoldier;
            });
            
            const signOutData = {
                soldiers: soldiers, 
                location: formData.get('location'),
                notes: formData.get('notes') || '',
                pin: formData.get('pin') 
            };
            
            if (!signOutData.soldiers || signOutData.soldiers.length === 0) {
                this.app.notificationManager.showNotification('Please select at least one soldier', 'warning');
                return;
            }
            
            if (!signOutData.location) {
                this.app.notificationManager.showNotification('Please enter a location', 'warning');
                return;
            }
            
            if (!signOutData.pin) {
                this.app.notificationManager.showNotification('Please enter your PIN', 'warning');
                return;
            }
            
            Utils.showLoading(true);
            
            const response = await Utils.fetchWithAuth('/api/signouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signOutData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to create sign-out');
            }
            
            const result = await response.json();
            
            this.app.modalManager.closeNewSignOutModal();
            this.app.barcodeManager.clearSoldiers(); 
            this.loadCurrentSignOuts();
            this.app.notificationManager.showNotification('Sign-out created successfully', 'success');
            
        } catch (error) {
            console.error('Error creating sign-out:', error);
            this.app.notificationManager.showNotification('Failed to create sign-out', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }

    startDurationUpdates() {
        console.log('Starting duration updates...');
        
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
        }
        
        this.durationInterval = setInterval(() => {
            console.log('Duration update interval triggered');
            
            const dashboardView = this.app.domManager.get('dashboardView');
            if (dashboardView && dashboardView.style.display !== 'none' && this.signouts) {
                console.log('Updating durations...');
                this.loadCurrentSignOuts();
            }
        }, 60000); 
        
        console.log('Duration update interval set up with ID:', this.durationInterval);
    }

    stopDurationUpdates() {
        console.log('Stopping duration updates...');
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = null;
            console.log('Duration updates stopped');
        }
    }
}

export default SignOutManager;
