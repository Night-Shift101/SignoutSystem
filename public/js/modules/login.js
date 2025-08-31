import { globalFrontendErrorHandler, ErrorCategory, ErrorSeverity } from './frontend-error-handler.js';

class LoginApp {
    constructor() {
        this.currentStep = 'system'; 
        this.users = [];
        this.authCheckInProgress = false;
        this.errorHandler = globalFrontendErrorHandler.createContextHandler('LoginApp');
        this.initializeElements();
        this.attachEventListeners();
        this.checkExistingSession();
    }

    initializeElements() {
        
        this.loginContainer = document.getElementById('loginContainer');
        this.animatedBg = document.getElementById('animatedBg');
        
        
        this.systemPasswordForm = document.getElementById('systemPasswordForm');
        this.userSelectionForm = document.getElementById('userSelectionForm');
        
        
        this.systemPassword = document.getElementById('systemPassword');
        this.systemLoginBtn = document.getElementById('systemLoginBtn');
        this.systemErrorMessage = document.getElementById('systemErrorMessage');
        
        
        this.userSelect = document.getElementById('userSelect');
        this.userPin = document.getElementById('userPin');
        this.userLoginBtn = document.getElementById('userLoginBtn');
        this.userErrorMessage = document.getElementById('userErrorMessage');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        
        this.loginSubtitle = document.getElementById('loginSubtitle');
    }

    attachEventListeners() {
        
        this.systemLoginBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSystemLogin();
        });

        this.systemPassword?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleSystemLogin();
            }
        });

        
        this.userLoginBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleUserLogin();
        });

        this.userPin?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleUserLogin();
            }
        });

        
        this.logoutBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        
        document.querySelectorAll('.password-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePasswordVisibility(button);
            });
        });
    }

    togglePasswordVisibility(button) {
        const targetId = button.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        const iconSpan = button.querySelector('.icon');
        
        if (!targetInput || !iconSpan) {
            return;
        }
        
        if (targetInput.type === 'password') {
            targetInput.type = 'text';
            iconSpan.textContent = '🙈';
        } else {
            targetInput.type = 'password';
            iconSpan.textContent = '👁';
        }
    }

    async checkExistingSession() {
        try {
            
            if (this.authCheckInProgress) {
                return;
            }
            this.authCheckInProgress = true;
            
            const response = await fetch('/api/auth/status', {
                credentials: 'same-origin'
            });
            const result = await response.json();
            
            if (result.userAuthenticated) {
                console.log('User authenticated, but checking if redirect is safe');
                const referrer = document.referrer;
                const currentPath = window.location.pathname;
                if (currentPath === '/login' && (!referrer || !referrer.includes('/login'))) {
                    console.log('Safe to redirect to dashboard');
                    window.location.href = '/';
                } else {
                    console.log('Redirect loop detected, staying on login page');
                    this.showMessage('You are already logged in. Click here to go to dashboard.');
                }
            } else if (result.systemAuthenticated) {
                // Load users and check for success before showing user step
                const loadResult = await this.loadUsers();
                if (loadResult.success) {
                    this.showUserStep();
                } else {
                    // If loading users failed, fall back to system step
                    console.error('Failed to load users during session check:', loadResult.error);
                    this.showSystemStep();
                }
            } else {
                
                this.showSystemStep();
            }
        } catch (error) {
            console.error('Session check error:', error);
            this.showSystemStep();
        } finally {
            this.authCheckInProgress = false;
        }
    }

    /**
     * Handles system password authentication
     * @returns {Promise<StandardResponse>} Success/failure response
     */
    async handleSystemLogin() {
        const password = this.systemPassword.value.trim();
        
        if (!password) {
            this.showSystemError('Please enter the system password.');
            return this.errorHandler.validationError('System password is required');
        }

        this.setSystemLoading(true);
        this.hideSystemError();

        try {
            const response = await fetch('/api/auth/system', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Extract users from the correct location in the response
                const users = result.data?.users || result.users;
                
                // Validate that we received users data
                if (!users || !Array.isArray(users)) {
                    const errorMsg = 'Invalid user data received from server';
                    console.error('System login error: Invalid users data', result);
                    this.showSystemError('Failed to load user list. Please try again.');
                    return this.errorHandler.failure(errorMsg, {
                        category: ErrorCategory.DATA,
                        severity: ErrorSeverity.HIGH,
                        details: { serverResponse: result }
                    });
                }

                this.users = users; // Use users from system auth response
                
                // Safely populate user select with error handling
                const populateResult = this.populateUserSelect();
                if (!populateResult.success) {
                    return populateResult; // Return the error from populateUserSelect
                }

                this.showUserStep();
                return this.errorHandler.success(
                    { userCount: this.users.length }, 
                    'System authentication successful', 
                    false
                );
            } else {
                const errorMsg = result.error || 'Invalid system password';
                this.showSystemError(errorMsg);
                return this.errorHandler.failure(errorMsg, {
                    category: ErrorCategory.AUTHENTICATION,
                    severity: ErrorSeverity.MEDIUM
                });
            }
        } catch (error) {
            console.error('System login error:', error);
            const errorMsg = 'Connection failed. Please try again.';
            this.showSystemError(errorMsg);
            return this.errorHandler.failure(errorMsg, {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
        } finally {
            this.setSystemLoading(false);
        }
    }

    /**
     * Loads users from the API with standardized error handling
     * @returns {Promise<StandardResponse>} Success/failure response
     */
    async loadUsers() {
        try {
            const response = await fetch('/api/users', {
                credentials: 'same-origin'
            });

            if (response.ok) {
                const result = await response.json();
                
                // Handle standardized response format
                if (result.success) {
                    const users = result.data; // Users are directly in result.data for this endpoint
                    
                    // Validate that we received valid users data
                    if (!users || !Array.isArray(users)) {
                        const errorMsg = 'Invalid user data received from server';
                        console.error('LoadUsers error: Invalid users data', result);
                        this.showSystemError('Failed to load user list. Please try again.');
                        return this.errorHandler.failure(errorMsg, {
                            category: ErrorCategory.DATA,
                            severity: ErrorSeverity.HIGH,
                            details: { serverResponse: result }
                        });
                    }

                    this.users = users;
                } else {
                    // Server returned an error in standardized format
                    const errorMsg = result.error || 'Failed to load users';
                    console.error('LoadUsers error:', result);
                    this.showSystemError('Failed to load user list. Please try again.');
                    return this.errorHandler.failure(errorMsg, {
                        category: ErrorCategory.NETWORK,
                        severity: ErrorSeverity.HIGH,
                        details: { serverResponse: result }
                    });
                }
                
                // Safely populate user select with error handling
                const populateResult = this.populateUserSelect();
                if (!populateResult.success) {
                    return populateResult; // Return the error from populateUserSelect
                }

                return this.errorHandler.success(
                    { userCount: this.users.length }, 
                    `Loaded ${this.users.length} users successfully`
                );
            } else {
                throw new Error(`Failed to load users: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            const errorMsg = 'Failed to load user list. Please try again.';
            this.showSystemError(errorMsg);
            return this.errorHandler.failure(errorMsg, {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
        }
    }

    /**
     * Populates the user select dropdown with available NCOs
     * @returns {StandardResponse} Success/failure response
     */
    populateUserSelect() {
        try {
            // Defensive check - ensure users array exists and is valid
            if (!this.users || !Array.isArray(this.users)) {
                const errorMsg = 'No user data available to populate selection';
                console.error('PopulateUserSelect error: Invalid users data', this.users);
                this.showSystemError('Failed to load user list. Please try again.');
                return this.errorHandler.failure(errorMsg, {
                    category: ErrorCategory.DATA,
                    severity: ErrorSeverity.HIGH,
                    details: { usersData: this.users }
                });
            }

            this.userSelect.innerHTML = '<option value="">Choose an NCO...</option>';
            
            this.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                
                // Add visual indicator for disabled accounts
                option.textContent = `${user.rank} ${user.full_name}`;
                
                // Add data attribute to track status
                option.dataset.isActive = user.is_active ? '1' : '0';
                
                this.userSelect.appendChild(option);
            });

            return this.errorHandler.success(
                { userCount: this.users.length }, 
                `Loaded ${this.users.length} users successfully`
            );
        } catch (error) {
            console.error('PopulateUserSelect error:', error);
            this.showSystemError('Failed to load user list. Please try again.');
            return this.errorHandler.failure('Failed to populate user selection', {
                category: ErrorCategory.SYSTEM,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
        }
    }

    /**
     * Handles user PIN authentication
     * @returns {Promise<StandardResponse>} Success/failure response
     */
    async handleUserLogin() {
        const userId = this.userSelect.value;
        const pin = this.userPin.value.trim();
        
        if (!userId) {
            this.showUserError('Please select an NCO.');
            return this.errorHandler.validationError('User selection is required');
        }
        
        if (!pin) {
            this.showUserError('Please enter your PIN.');
            return this.errorHandler.validationError('PIN is required');
        }

        this.setUserLoading(true);
        this.hideUserError();

        try {
            // Debug logging for login authentication
            console.log('🔐 LoginApp.handleUserLogin called');
            console.log('🆔 User ID selected:', userId);
            console.log('🔢 PIN provided:', pin ? '***' : 'NONE');

            const requestData = { userId: parseInt(userId), pin };
            console.log('📤 Sending login request data:', { userId: requestData.userId, pin: '***' });

            const response = await fetch('/api/auth/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(requestData)
            });

            const result = await response.json();
            console.log('📥 Login response received:', result);

            if (response.ok && result.success) {
                // Successful authentication - redirect to main app
                window.location.href = '/';
                return this.errorHandler.success(
                    { userId: parseInt(userId) }, 
                    'User authentication successful'
                );
            } else {
                const errorMsg = result.error || 'Invalid PIN';
                this.showUserError(errorMsg);
                return this.errorHandler.failure(errorMsg, {
                    category: ErrorCategory.AUTHENTICATION,
                    severity: ErrorSeverity.MEDIUM
                });
            }
        } catch (error) {
            console.error('User login error:', error);
            const errorMsg = 'Connection failed. Please try again.';
            this.showUserError(errorMsg);
            return this.errorHandler.failure(errorMsg, {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.HIGH,
                originalError: error
            });
        } finally {
            this.setUserLoading(false);
        }
    }

    /**
     * Handles user logout
     * @returns {Promise<StandardResponse>} Success/failure response
     */
    async handleLogout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin'
            });
            
            // Clear form data and return to system step
            this.systemPassword.value = '';
            this.userPin.value = '';
            this.showSystemStep();
            
            if (response.ok) {
                return this.errorHandler.success(null, 'Logged out successfully');
            } else {
                // Even if logout failed on server, we still cleared client state
                console.warn('Server logout failed, but client state cleared');
                return this.errorHandler.success(null, 'Client logout completed');
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Still show system step even if logout failed
            this.showSystemStep();
            return this.errorHandler.failure('Logout request failed', {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.LOW, // Low severity since client state is cleared
                originalError: error
            });
        }
    }

    showSystemStep() {
        this.currentStep = 'system';
        
        
        this.loginContainer.classList.remove('user-step');
        this.animatedBg.classList.remove('user-step');
        
        
        this.userSelectionForm.style.display = 'none';
        this.systemPasswordForm.style.display = 'block';
        
        this.loginSubtitle.textContent = 'NCO Access Required';
        this.systemPassword.value = '';
        this.hideSystemError();
        
        
        this.systemPassword.focus();
    }

    showUserStep() {
        this.currentStep = 'user';
        
        
        this.animatedBg.classList.add('user-step');
        this.loginContainer.classList.add('user-step');
        
        
        this.systemPasswordForm.style.display = 'none';
        this.userSelectionForm.style.display = 'block';
        
        this.loginSubtitle.textContent = 'Select NCO and Enter PIN';
        this.userPin.value = '';
        this.hideUserError();
        
        
        setTimeout(() => {
            this.userSelect.focus();
        }, 200);
    }

    setSystemLoading(loading) {
        this.systemLoginBtn.disabled = loading;
        const btnText = this.systemLoginBtn.querySelector('.btn-text');
        const btnLoader = this.systemLoginBtn.querySelector('.btn-loader');
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoader.style.display = loading ? 'inline-block' : 'none';
    }

    setUserLoading(loading) {
        this.userLoginBtn.disabled = loading;
        const btnText = this.userLoginBtn.querySelector('.btn-text');
        const btnLoader = this.userLoginBtn.querySelector('.btn-loader');
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoader.style.display = loading ? 'inline-block' : 'none';
    }

    showSystemError(message) {
        this.systemErrorMessage.textContent = message;
        this.systemErrorMessage.style.display = 'block';
    }

    hideSystemError() {
        this.systemErrorMessage.style.display = 'none';
    }

    showUserError(message) {
        this.userErrorMessage.textContent = message;
        this.userErrorMessage.style.display = 'block';
    }

    hideUserError() {
        this.userErrorMessage.style.display = 'none';
    }

    showMessage(message) {
        
        let messageDiv = document.getElementById('loginMessage');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'loginMessage';
            messageDiv.style.cssText = `
                background: #4CAF50;
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
                cursor: pointer;
                font-weight: 500;
            `;
            
            
            const loginHeader = document.querySelector('.login-header');
            if (loginHeader) {
                loginHeader.parentNode.insertBefore(messageDiv, loginHeader.nextSibling);
            }
        }
        
        messageDiv.textContent = message;
        messageDiv.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    try {
        new LoginApp();
        
        // Initialize basic connection monitoring for login page
        import('./connection-manager.js').then(({ default: ConnectionManager }) => {
            const fakeApp = {
                notificationManager: {
                    showNotification: (message, type) => {
                        console.log(`${type.toUpperCase()}: ${message}`);
                    }
                }
            };
            new ConnectionManager(fakeApp);
        }).catch(error => {
            console.error('Error loading connection manager:', error);
        });
    } catch (error) {
        console.error('Error initializing LoginApp:', error);
    }
});
