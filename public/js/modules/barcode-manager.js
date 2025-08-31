class BarcodeManager {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.addedSoldiers = [];
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.barcodeInput = document.getElementById('barcodeInput');
        this.soldiersChips = document.getElementById('soldiersChips');
        this.clearAllSoldiersBtn = document.getElementById('clearAllSoldiersBtn');
        this.soldierCount = document.getElementById('soldierCount');
    }

    attachEventListeners() {
        this.clearAllSoldiersBtn.addEventListener('click', () => this.clearAllSoldiers());
        this.barcodeTimeout = null;

        this.barcodeInput.addEventListener('input', () => {
            clearTimeout(this.barcodeTimeout);
            this.barcodeTimeout = setTimeout(() => {
                this.handleBarcodeParse();
            }, 500);
        });
        
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('soldier-chip-remove')) {
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index)) {
                    this.removeSoldier(index);
                }
            }
        });
    }

    handleBarcodeParse() {
        const barcodeData = this.barcodeInput.value.trim();
        
        if (!barcodeData) {
            this.notificationManager.showNotification('Please enter or paste barcode data first.', 'warning');
            return;
        }

        try {
            const parsedInfo = window.BarcodeParser.parseSoldierInfo(barcodeData);
            
            if (parsedInfo && window.BarcodeParser.validateSoldierInfo(parsedInfo)) {
                
                const isDuplicate = this.addedSoldiers.some(soldier => 
                    soldier.firstName === parsedInfo.firstName && 
                    soldier.lastName === parsedInfo.lastName &&
                    soldier.dodId === parsedInfo.dodId
                );
                
                if (isDuplicate) {
                    this.notificationManager.showNotification('This soldier has already been added.', 'warning');
                    return;
                }
                
                
                this.addedSoldiers.push(parsedInfo);
                this.renderSoldierChips();
                
                
                this.notificationManager.showNotification(
                    `Successfully added: ${parsedInfo.rank} ${parsedInfo.fullName}`, 
                    'success'
                );
                
                
                this.barcodeInput.value = '';
                
                console.log('Added soldier:', parsedInfo);
            } else {
                this.notificationManager.showNotification('Could not parse soldier information from barcode data. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error parsing barcode:', error);
            this.notificationManager.showNotification('Error parsing barcode data. Please try again.', 'error');
        }
    }

    clearBarcodeData() {
        this.barcodeInput.value = '';
        this.notificationManager.showNotification('Barcode data cleared.', 'info');
    }

    renderSoldierChips() {
        this.updateSoldierCount(); // Update the count whenever rendering
        
        if (this.addedSoldiers.length === 0) {
            this.soldiersChips.innerHTML = '<div class="empty-state-chips">No soldiers added yet. Scan CAC barcodes to add soldiers.</div>';
            this.clearAllSoldiersBtn.style.display = 'none';
            this.autoAdjustContainerHeight();
            return;
        }

        this.soldiersChips.innerHTML = this.addedSoldiers.map((soldier, index) => `
            <div class="soldier-chip${soldier.isManualEntry ? ' manual-entry' : ''}" data-index="${index}">
                <span class="soldier-chip-name">${soldier.rank} ${soldier.lastName}, ${soldier.firstName}${soldier.middleInitial ? ' ' + soldier.middleInitial + '.' : ''}</span>
                ${soldier.isManualEntry ? '<span class="manual-tag">Manual</span>' : ''}
                <button type="button" class="soldier-chip-remove" data-index="${index}" title="Remove soldier" tabindex="-1">×</button>
                <div class="soldier-chip-tooltip">DOD ID: ${soldier.dodId || 'N/A'}</div>
            </div>
        `).join('');
        
        this.clearAllSoldiersBtn.style.display = 'inline-block';
        this.autoAdjustContainerHeight();
    }

    updateSoldierCount() {
        if (this.soldierCount) {
            this.soldierCount.textContent = `(${this.addedSoldiers.length})`;
        }
    }

    autoAdjustContainerHeight() {
        
        setTimeout(() => {
            const container = this.soldiersChips;
            const contentHeight = container.scrollHeight;
            const minHeight = 60;
            const maxHeight = 300;
            
            
            const optimalHeight = Math.min(Math.max(contentHeight + 24, minHeight), maxHeight);
            
            
            if (contentHeight > container.clientHeight || contentHeight < container.clientHeight - 50) {
                container.style.height = `${optimalHeight}px`;
            }
            
            
            if (contentHeight > maxHeight) {
                container.style.overflowY = 'auto';
            } else {
                container.style.overflowY = 'visible';
            }
        }, 100);
    }

    removeSoldier(index) {
        if (index >= 0 && index < this.addedSoldiers.length) {
            const removedSoldier = this.addedSoldiers.splice(index, 1)[0];
            this.renderSoldierChips();
            this.notificationManager.showNotification(`Removed: ${removedSoldier.rank} ${removedSoldier.fullName}`, 'info');
        }
    }

    clearAllSoldiers() {
        this.addedSoldiers = [];
        this.renderSoldierChips();
        this.notificationManager.showNotification('All soldiers cleared.', 'info');
    }

    getSoldiers() {
        return this.addedSoldiers;
    }

    clearSoldiers() {
        this.addedSoldiers = [];
        this.renderSoldierChips();
    }

    /**
     * Development method to fill with random soldiers
     */
    fillRandomSoldiers() {
        console.log('fillRandomSoldiers method called');
        
        // Clear existing soldiers first
        this.clearSoldiers();
        
        const ranks = ['PVT', 'PV2', 'PFC', 'SPC'];
        const firstNames = [
            'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Ashley', 'Robert', 'Jessica',
            'William', 'Amanda', 'Christopher', 'Stephanie', 'Daniel', 'Melissa', 'Matthew', 'Nicole', 'Anthony', 'Jennifer',
            'Joshua', 'Elizabeth', 'Andrew', 'Megan', 'Joseph', 'Lauren', 'Ryan', 'Brittany', 'Brandon', 'Kayla',
            'Justin', 'Amber', 'Tyler', 'Rachel', 'Nicholas', 'Samantha', 'Alexander', 'Courtney', 'Jacob', 'Danielle',
            'Zachary', 'Heather', 'Benjamin', 'Rebecca', 'Samuel', 'Michelle', 'Logan', 'Katherine', 'Nathan', 'Victoria'
        ];
        const lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
            'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
            'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
        ];
        
        console.log('Generating random soldiers...');
        
        // Generate random number of soldiers between 3 and 15
        const randomCount = Math.floor(Math.random() * 13) + 3; // Random number between 3-15
        console.log(`Generating ${randomCount} random soldiers...`);
        
        for (let i = 0; i < randomCount; i++) {
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const dodId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            
            const soldier = {
                rank: rank,
                firstName: firstName,
                lastName: lastName,
                middleInitial: '',
                dodId: dodId,
                fullName: `${firstName} ${lastName}`,
                isManualEntry: true // Mark as manual entry since it's dev data
            };
            
            console.log(`Adding soldier ${i + 1}:`, soldier);
            this.addedSoldiers.push(soldier);
        }
        
        console.log('Total soldiers added:', this.addedSoldiers.length);
        this.renderSoldierChips();
        this.notificationManager.showNotification(`Added ${randomCount} random soldiers for development`, 'success');
    }
}

export default BarcodeManager;
