class UtilitiesManager {
    constructor(db) {
        this.db = db;
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
    
    migrateSignOutsTable() {
        this.db.all("PRAGMA table_info(signouts)", (err, columns) => {
            if (err) {
                console.error('Error checking table structure:', err.message);
                return;
            }
            
            const hasOldStructure = columns.some(col => col.name === 'soldier_names');
            const hasLocationOptions = columns.some(col => col.name === 'location_options');
            
            if (hasOldStructure) {
                console.log('Migrating signouts table to new structure...');
                this.performSignOutsMigration();
            } else if (!hasLocationOptions) {
                console.log('Adding location_options column to signouts table...');
                this.addLocationOptionsColumn();
            } else {
                console.log('SignOuts table already has correct structure');
            }
        });
    }

    addLocationOptionsColumn() {
        const addColumnQuery = `
            ALTER TABLE signouts 
            ADD COLUMN location_options TEXT
        `;
        
        this.db.run(addColumnQuery, (err) => {
            if (err) {
                console.error('Error adding location_options column:', err.message);
            } else {
                console.log('Successfully added location_options column to signouts table');
            }
        });
    }

    performSignOutsMigration() {
        const backupTableQuery = `
            CREATE TABLE IF NOT EXISTS signouts_backup AS 
            SELECT * FROM signouts
        `;
        
        this.db.run(backupTableQuery, (err) => {
            if (err) {
                console.error('Error creating backup table:', err.message);
                return;
            }
            
            this.db.run('DROP TABLE signouts', (err) => {
                if (err) {
                    console.error('Error dropping old table:', err.message);
                    return;
                }
                
                const createNewTable = `
                    CREATE TABLE signouts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        signout_id TEXT NOT NULL,
                        soldier_rank TEXT NOT NULL,
                        soldier_first_name TEXT NOT NULL,
                        soldier_last_name TEXT NOT NULL,
                        soldier_dod_id TEXT,
                        location TEXT NOT NULL,
                        sign_out_time DATETIME NOT NULL,
                        sign_in_time DATETIME,
                        signed_out_by_id INTEGER NOT NULL,
                        signed_out_by_name TEXT NOT NULL,
                        signed_in_by_id INTEGER,
                        signed_in_by_name TEXT,
                        status TEXT DEFAULT 'OUT' CHECK(status IN ('OUT', 'IN')),
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (signed_out_by_id) REFERENCES users(id),
                        FOREIGN KEY (signed_in_by_id) REFERENCES users(id)
                    )
                `;
                
                this.db.run(createNewTable, (err) => {
                    if (err) {
                        console.error('Error creating new table:', err.message);
                        return;
                    }
                    
                    this.migrateOldData();
                });
            });
        });
    }

    migrateOldData() {
        this.db.all('SELECT * FROM signouts_backup', (err, oldRecords) => {
            if (err) {
                console.error('Error reading backup data:', err.message);
                return;
            }
            
            if (oldRecords.length === 0) {
                console.log('No old data to migrate');
                this.db.run('DROP TABLE signouts_backup');
                return;
            }
            
            console.log(`Migrating ${oldRecords.length} old records...`);
            
            oldRecords.forEach(record => {
                const soldierNames = record.soldier_names.split(',').map(name => name.trim());
                
                soldierNames.forEach(soldierName => {
                    const nameParts = soldierName.trim().split(' ');
                    let rank = 'Unknown';
                    let firstName = 'Unknown';
                    let lastName = 'Unknown';
                    
                    if (nameParts.length >= 3) {
                        rank = nameParts[0];
                        firstName = nameParts[1];
                        lastName = nameParts.slice(2).join(' ');
                    } else if (nameParts.length === 2) {
                        firstName = nameParts[0];
                        lastName = nameParts[1];
                    } else if (nameParts.length === 1) {
                        lastName = nameParts[0];
                    }
                    
                    const insertQuery = `
                        INSERT INTO signouts (
                            signout_id, soldier_rank, soldier_first_name, soldier_last_name,
                            location, sign_out_time, sign_in_time, signed_out_by_id, 
                            signed_out_by_name, signed_in_by_id, signed_in_by_name, 
                            status, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    this.db.run(insertQuery, [
                        record.signout_id,
                        rank,
                        firstName,
                        lastName,
                        record.location,
                        record.sign_out_time,
                        record.sign_in_time,
                        record.signed_out_by_id,
                        record.signed_out_by_name,
                        record.signed_in_by_id,
                        record.signed_in_by_name,
                        record.status,
                        record.notes,
                        record.created_at,
                        record.updated_at
                    ], (err) => {
                        if (err) {
                            console.error('Error migrating record:', err.message);
                        }
                    });
                });
            });
            
            console.log('Migration completed');
            
            setTimeout(() => {
                this.db.run('DROP TABLE signouts_backup');
            }, 1000);
        });
    }
    
    clearOldRecords(cutoffDate, callback) {
        const deleteOldRecords = `
            DELETE FROM signouts 
            WHERE created_at < ? 
            AND status = 'IN'
        `;
        
        this.db.run(deleteOldRecords, [cutoffDate.toISOString()], function(err) {
            if (err) {
                console.error('Error clearing old records:', err.message);
                return callback(err);
            }
            console.log(`Cleared ${this.changes} old records`);
            callback(null, this.changes);
        });
    }
    
    resetSystem(callback) {
        const deleteSignouts = 'DELETE FROM signouts';
        const deleteSystemPasswords = 'DELETE FROM system_passwords';
        
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            this.db.run(deleteSignouts, (err) => {
                if (err) {
                    console.error('Error deleting signouts:', err.message);
                    this.db.run('ROLLBACK');
                    return callback(err);
                }
            });
            
            this.db.run(deleteSystemPasswords, (err) => {
                if (err) {
                    console.error('Error deleting system passwords:', err.message);
                    this.db.run('ROLLBACK');
                    return callback(err);
                }
            });
            
            this.db.run('COMMIT', (err) => {
                if (err) {
                    console.error('Error committing system reset:', err.message);
                    this.db.run('ROLLBACK');
                    return callback(err);
                }
                console.log('System reset completed successfully');
                callback(null);
            });
        });
    }

    getSystemSetting(key, callback) {
        this.db.get('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key], callback);
    }

    updateSystemSetting(key, value, callback) {
        this.db.run(
            'UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
            [value, key],
            callback
        );
    }

    exportSignoutsCSV(filters, requestedBy, callback) {
        let baseQuery = `
            SELECT 
                signout_id,
                soldier_rank,
                soldier_first_name,
                soldier_last_name,
                soldier_dod_id,
                location,
                sign_out_time,
                sign_in_time,
                signed_out_by_id,
                signed_out_by_name,
                signed_in_by_id,
                signed_in_by_name,
                status,
                notes,
                created_at,
                updated_at
            FROM signouts
            WHERE 1=1
        `;
        const params = [];

        if (filters.startDate) {
            baseQuery += ' AND sign_out_time >= ?';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            baseQuery += ' AND sign_out_time <= ?';
            params.push(filters.endDate);
        }

        if (filters.soldierName) {
            baseQuery += ' AND (soldier_first_name LIKE ? OR soldier_last_name LIKE ? OR (soldier_rank || " " || soldier_first_name || " " || soldier_last_name) LIKE ?)';
            params.push(`%${filters.soldierName}%`, `%${filters.soldierName}%`, `%${filters.soldierName}%`);
        }

        if (filters.location) {
            baseQuery += ' AND location LIKE ?';
            params.push(`%${filters.location}%`);
        }

        if (filters.status) {
            baseQuery += ' AND status = ?';
            params.push(filters.status);
        }

        baseQuery += ' ORDER BY sign_out_time DESC';

        this.db.all(baseQuery, params, (err, rows) => {
            if (err) {
                return callback(err);
            }

            const metadataRows = [
                `Requested by: ${requestedBy}`,
                `Requested at: ${new Date().toISOString()}`
            ];

            const headerRow = [
                'Signout ID',
                'Rank',
                'First Name',
                'Last Name',
                'DOD ID',
                'Location',
                'Sign Out Time',
                'Sign In Time',
                'Signed Out By ID',
                'Signed Out By Name',
                'Signed In By ID',
                'Signed In By Name',
                'Status',
                'Notes',
                'Created At',
                'Updated At'
            ].join(',');

            const dataRows = rows.map(row => {
                return [
                    row.signout_id,
                    row.soldier_rank,
                    row.soldier_first_name,
                    row.soldier_last_name,
                    row.soldier_dod_id || 'N/A',
                    row.location,
                    row.sign_out_time,
                    row.sign_in_time || 'N/A',
                    row.signed_out_by_id,
                    row.signed_out_by_name,
                    row.signed_in_by_id || 'N/A',
                    row.signed_in_by_name || 'N/A',
                    row.status,
                    row.notes || '',
                    row.created_at,
                    row.updated_at
                ].join(',');
            });

            const csvContent = [
                ...metadataRows,
                '',
                headerRow,
                ...dataRows
            ].join('\n');

            callback(null, csvContent);
        });
    }

    getSignOutsByIds(signOutIds, callback) {
        if (!signOutIds || signOutIds.length === 0) {
            return callback(null, []);
        }
        const placeholders = signOutIds.map(() => '?').join(',');
        const query = `
            SELECT 
                signout_id,
                location,
                sign_out_time,
                sign_in_time,
                signed_out_by_id,
                signed_out_by_name,
                signed_in_by_id,
                signed_in_by_name,
                status,
                notes,
                created_at,
                updated_at,
                GROUP_CONCAT(
                    CASE 
                        WHEN soldier_rank != '' THEN soldier_rank || ' ' || soldier_first_name || ' ' || soldier_last_name
                        ELSE soldier_first_name || ' ' || soldier_last_name
                    END, ', '
                ) as soldier_names,
                COUNT(*) as soldier_count,
                '[' || GROUP_CONCAT(
                    '{"rank":"' || COALESCE(soldier_rank, '') || 
                    '","firstName":"' || soldier_first_name || 
                    '","lastName":"' || soldier_last_name || 
                    '","dodId":"' || COALESCE(soldier_dod_id, '') || '"}'
                    , ',') || ']' as soldiers
            FROM signouts 
            WHERE signout_id IN (${placeholders})
            GROUP BY signout_id, location, sign_out_time, sign_in_time, signed_out_by_id, signed_out_by_name, signed_in_by_id, signed_in_by_name, status, notes, created_at, updated_at
            ORDER BY sign_out_time DESC
        `;

        this.db.all(query, signOutIds, (err, rows) => {
            if (err) {
                return callback(err);
            }
            
            const processedRows = rows.map(row => {
                try {
                    row.soldiers = JSON.parse(row.soldiers);
                } catch (e) {
                    console.error('Error parsing soldiers JSON:', e);
                    row.soldiers = [];
                }
                return row;
            });
            
            callback(null, processedRows);
        });
    }
}

module.exports = UtilitiesManager;
