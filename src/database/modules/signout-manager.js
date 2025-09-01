class SignoutManager {
    constructor(db) {
        this.db = db;
    }

    getAllSignOuts(callback) {
        const query = `
            SELECT 
                signout_id,
                location,
                location_options,
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
            GROUP BY signout_id, location, location_options, sign_out_time, sign_in_time, signed_out_by_id, signed_out_by_name, signed_in_by_id, signed_in_by_name, status, notes, created_at, updated_at
            ORDER BY sign_out_time DESC
        `;
        this.db.all(query, [], (err, rows) => {
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
    
    getCurrentSignOuts(callback) {
        const query = `
            SELECT 
                signout_id,
                location,
                location_options,
                sign_out_time,
                signed_out_by_id,
                signed_out_by_name,
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
            WHERE status = 'OUT' 
            GROUP BY signout_id, location, location_options, sign_out_time, signed_out_by_id, signed_out_by_name, status, notes, created_at, updated_at
            ORDER BY sign_out_time ASC
        `;
        this.db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Database query error in getCurrentSignOuts:', err);
                return callback(err);
            }

            const processedRows = rows.map(row => {
                try {
                    row.soldiers = JSON.parse(row.soldiers);
                } catch (e) {
                    console.error('Error parsing soldiers JSON in getCurrentSignOuts:', e);
                    row.soldiers = [];
                }
                return row;
            });
            
            callback(null, processedRows);
        });
    }
    
    addSignOut(signOutData, callback) {
        const signOutId = this.generateSignOutId();
        const signOutTime = new Date().toISOString();
        
        const soldiers = signOutData.soldiers || [];
        
        if (!soldiers || soldiers.length === 0) {
            return callback(new Error('No soldiers provided for sign-out'));
        }
        
        const db = this.db; 
        
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            let hasError = false;
            
            const insertQuery = `
                INSERT INTO signouts (
                    signout_id, soldier_rank, soldier_first_name, soldier_last_name, 
                    soldier_dod_id, location, location_options, sign_out_time, signed_out_by_id, 
                    signed_out_by_name, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            soldiers.forEach((soldier, index) => {
                const params = [
                    signOutId,
                    soldier.rank || '',
                    soldier.firstName || '',
                    soldier.lastName || '',
                    soldier.dodId || null,
                    signOutData.destination,
                    signOutData.locationOptions || null,
                    signOutData.signOutTime.toISOString(),
                    signOutData.signed_out_by_id,
                    signOutData.signed_out_by_name,
                    signOutData.notes || ''
                ];
                
                db.run(insertQuery, params, function(err) {
                    completed++;
                    
                    if (err && !hasError) {
                        hasError = true;
                        console.error('Error inserting soldier:', err.message);
                        db.run('ROLLBACK');
                        return callback(err);
                    }
                    
                    if (completed === soldiers.length && !hasError) {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                console.error('Error committing transaction:', commitErr.message);
                                return callback(commitErr);
                            }
                            
                            callback(null, { 
                                signout_id: signOutId,
                                soldiers_count: soldiers.length 
                            });
                        });
                    }
                });
            });
        });
    }
    
    signInSoldiers(signOutId, signedInById, signedInByName, callback) {
        const query = `
            UPDATE signouts 
            SET status = 'IN', sign_in_time = ?, 
                signed_in_by_id = ?, signed_in_by_name = ?
            WHERE signout_id = ? AND status = 'OUT'
        `;
        this.db.run(query, [new Date().toISOString(), signedInById, signedInByName, signOutId], function(err) {
            if (err) {
                return callback(err, null);
            }
            
            if (this.changes === 0) {
                return callback(null, { 
                    success: false, 
                    message: 'No active sign-out found or soldiers already signed in' 
                });
            }
            
            callback(null, { 
                success: true, 
                message: 'Soldiers signed in successfully',
                changes: this.changes 
            });
        });
    }
    
    getSignOutById(signOutId, callback) {
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
            WHERE signout_id = ?
            GROUP BY signout_id, location, sign_out_time, sign_in_time, signed_out_by_id, signed_out_by_name, signed_in_by_id, signed_in_by_name, status, notes, created_at, updated_at
        `;
        this.db.get(query, [signOutId], (err, row) => {
            if (err) {
                return callback(err);
            }
            if (!row) {
                return callback(null, null);
            }
            
            try {
                row.soldiers = JSON.parse(row.soldiers);
            } catch (e) {
                console.error('Error parsing soldiers JSON for signout:', signOutId, e);
                row.soldiers = [];
            }
            
            callback(null, row);
        });
    }
    
    getFilteredSignOuts(filters, callback) {
        let baseQuery = `
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
            WHERE 1=1
        `;
        let params = [];

        if (filters.startDate) {
            baseQuery += ' AND date(sign_out_time) >= date(?)';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            baseQuery += ' AND date(sign_out_time) <= date(?)';
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

        baseQuery += ` 
            GROUP BY signout_id, location, sign_out_time, sign_in_time, signed_out_by_id, signed_out_by_name, signed_in_by_id, signed_in_by_name, status, notes, created_at, updated_at
            ORDER BY sign_out_time DESC
        `;

        this.db.all(baseQuery, params, (err, rows) => {
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
    
    getIndividualSignOutRecords(filters, callback) {
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
        let params = [];

        if (filters.startDate) {
            baseQuery += ' AND date(sign_out_time) >= date(?)';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            baseQuery += ' AND date(sign_out_time) <= date(?)';
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

        baseQuery += ` ORDER BY sign_out_time DESC, signout_id, soldier_last_name, soldier_first_name`;

        this.db.all(baseQuery, params, (err, rows) => {
            if (err) {
                return callback(err);
            }
            
            callback(null, rows);
        });
    }
    
    generateSignOutId() {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const time = now.getTime().toString().slice(-4);
        
        return `SO${year}${month}${day}-${time}`;
    }
}

module.exports = SignoutManager;
