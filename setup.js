#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class SystemSetup {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.dbPath = path.join(__dirname, 'data', 'soldiers.db');
        this.systemPassword = null;
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async questionHidden(prompt) {
        return this.question(prompt);
    }

    validatePassword(password) {
        if (password.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        if (!/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(password)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(password)) {
            return 'Password must contain at least one number';
        }
        return null;
    }

    validatePin(pin) {
        if (!/^\d{4,6}$/.test(pin)) {
            return 'PIN must be 4-6 digits only';
        }
        return null;
    }


    validateName(name) {
        if (name.length < 2) {
            return 'Name must be at least 2 characters long';
        }
        if (!/^[a-zA-Z\s'-]+$/.test(name)) {
            return 'Name can only contain letters, spaces, hyphens, and apostrophes';
        }
        return null;
    }

    

    async wipeDatabase() {
        console.log('\n🗑️  Database Wipe');
        console.log('================');
        
        const confirm = await this.question('⚠️  This will permanently delete ALL data including users, sign-outs, and preferences.\nType "CONFIRM WIPE" to proceed: ');
        
        if (confirm !== 'CONFIRM WIPE') {
            console.log('❌ Database wipe cancelled.');
            return false;
        }

        try {
            if (fs.existsSync(this.dbPath)) {
                fs.unlinkSync(this.dbPath);
                console.log('✅ Database wiped successfully.');
            } else {
                console.log('ℹ️  No existing database found.');
            }
            return true;
        } catch (error) {
            console.error('❌ Error wiping database:', error.message);
            return false;
        }
    }

    async initializeDatabase() {
        console.log('\n🏗️  Database Initialization');
        console.log('=========================');

        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error creating database:', err.message);
                    reject(err);
                    return;
                }

                const createUsersTable = `
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        pin_hash TEXT NOT NULL,
                        rank TEXT NOT NULL,
                        full_name TEXT NOT NULL,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME
                    )
                `;

                const createSignOutsTable = `
                    CREATE TABLE IF NOT EXISTS signouts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        signout_id TEXT NOT NULL,
                        soldier_rank TEXT NOT NULL,
                        soldier_first_name TEXT NOT NULL,
                        soldier_last_name TEXT NOT NULL,
                        soldier_dod_id TEXT,
                        location TEXT NOT NULL,
                        location_options TEXT,
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

                const createUserPreferencesTable = `
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        setting_key TEXT NOT NULL,
                        setting_value TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(user_id, setting_key)
                    )
                `;

                db.serialize(() => {
                    db.run(createUsersTable);
                    db.run(createSignOutsTable);
                    db.run(createUserPreferencesTable);
                });

                db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Database initialized successfully.');
                        resolve();
                    }
                });
            });
        });
    }

    async createAdminUser() {
        console.log('\n👤 Admin User Creation');
        console.log('=====================');

        let adminData = {};

        // Set admin rank
        adminData.rank = "ADMIN"
        
        

        // Get admin full name
        while (true) {
            const fullName = await this.question('Enter a name for the admin account. (e.g., Root Admin): ');
            const nameError = this.validateName(fullName);
            if (nameError) {
                console.log(`❌ ${nameError}`);
                continue;
            }
            adminData.fullName = fullName;
            break;
        }

        // Generate random password for admin account
        console.log('⚠️  Please save this password securely - you\'ll need it for admin account login!');

        // Get admin PIN
        while (true) {
            const pin = await this.questionHidden('Enter admin PIN (4-6 digits): ');
            const pinError = this.validatePin(pin);
            if (pinError) {
                console.log(`❌ ${pinError}`);
                continue;
            }

            const confirmPin = await this.questionHidden('Confirm admin PIN: ');
            if (pin !== confirmPin) {
                console.log('❌ PINs do not match.');
                continue;
            }

            adminData.pin = pin;
            break;
        }

        // Create admin user in database
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err.message);
                    reject(err);
                    return;
                }

                const passwordHash = bcrypt.hashSync(this.systemPassword, 10);
                const pinHash = bcrypt.hashSync(adminData.pin, 10);

                db.run(
                    'INSERT INTO users (username, password_hash, pin_hash, rank, full_name) VALUES (?, ?, ?, ?, ?)',
                    ['admin', passwordHash, pinHash, adminData.rank, adminData.fullName],
                    function(err) {
                        db.close();
                        if (err) {
                            console.error('❌ Error creating admin user:', err.message);
                            reject(err);
                        } else {
                            console.log(`✅ Admin user created successfully: ${adminData.rank} ${adminData.fullName}`);
                            console.log('ℹ️  Username: admin');
                            // Store admin password for summary
                            resolve(adminData);
                        }
                    }
                );
            });
        });
    }

    async setSystemPassword() {
        console.log('\n🔐 System Password Setup');
        console.log('========================');
        console.log('The system password is used to access the application.');
        console.log('This is the first password users enter when logging in.\n');

        while (true) {
            const password = await this.questionHidden('Enter system password (8+ chars, must include uppercase, lowercase, number): ');
            const passwordError = this.validatePassword(password);
            if (passwordError) {
                console.log(`❌ ${passwordError}`);
                continue;
            }

            const confirmPassword = await this.questionHidden('Confirm system password: ');
            if (password !== confirmPassword) {
                console.log('❌ Passwords do not match.');
                continue;
            }

            this.systemPassword = password;
            console.log('✅ System password set successfully.');
            break;
        }
    }

    async showSummary(adminData) {
        console.log('\n🎉 Setup Complete!');
        console.log('==================');
        console.log('✅ Database initialized');
        console.log('✅ System password configured');
        console.log('✅ Admin user created');
        console.log('\n📋 Login Credentials:');
        console.log('=====================');
        console.log(`🔐 System Password: ${this.systemPassword}`);
        console.log(`👤 Admin Username: admin`);
        console.log(`📱 Admin PIN: ${adminData.pin}`);
        console.log('\nNext steps:');
        console.log('1. Start the application: npm run dev');
        console.log('2. Navigate to: http://localhost:3000');
        console.log('3. Log in with the credentials above');
        console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
        console.log('   - The system password allows access to the application');
        console.log('   - The admin password is for the admin user account login');
        console.log('   - The admin PIN is used for administrative actions');
    }

    async run() {
        console.log('🚀 Soldier Sign-Out System Setup');
        console.log('=================================\n');

        try {
            console.log('This setup will:');
            console.log('• Optionally wipe the existing database');
            console.log('• Initialize a fresh database');
            console.log('• Set up the system password');
            console.log('• Create an admin user account\n');

            const shouldWipe = await this.question('Do you want to wipe the existing database? (y/N): ');
            if (shouldWipe.toLowerCase() === 'y' || shouldWipe.toLowerCase() === 'yes') {
                const wiped = await this.wipeDatabase();
                if (!wiped) {
                    console.log('❌ Setup cancelled.');
                    process.exit(1);
                }
            }

            await this.initializeDatabase();
            await this.setSystemPassword();
            const adminData = await this.createAdminUser();
            await this.showSummary(adminData);

        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new SystemSetup();
    setup.run().catch((error) => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = SystemSetup;
