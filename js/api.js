// API Configuration and Utilities
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL || window.location.origin;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = { ...options.headers };

        // Let the browser set the Content-Type for FormData, otherwise set to JSON
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method: options.method || 'GET',
            headers,
            credentials: 'include',
            mode: 'cors',
            ...options
        };

        // Only stringify the body if it's not FormData
        if (options.body && !(options.body instanceof FormData)) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const responseText = await response.text();
            
            let responseData;
            try {
                responseData = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
                responseData = { message: responseText };
            }

            if (!response.ok) {
                const error = new Error(responseData.message || `HTTP error! status: ${response.status}`);
                error.response = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    data: responseData
                };
                throw error;
            }

            return responseData;
        } catch (error) {
            throw error;
        }
    }

    // HTTP Methods
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: data });
    }

    async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: data });
    }

    async patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body: data });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // File upload
    async uploadFile(endpoint, file, fieldName = 'file', data = {}) {
        const formData = new FormData();
        formData.append(fieldName, file);

        // Append additional data to formData
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value);
            }
        });

        return this.request(endpoint, {
            method: 'POST',
            body: formData,
            headers: {} // Content-Type is set by the browser for FormData
        });
    }

    // Download file
    async downloadFile(endpoint, filename, type = 'blob') {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            headers: {}, // Rely on HttpOnly cookie
            credentials: 'include',
            mode: 'cors'
        });

        if (type === 'pdf') {
            return await response.blob();
        }
        return await response.json();
    }

    // Authentication methods
    async register(userData) {
        try {
            console.log('Registering user with data:', userData);
            const response = await this.post('/auth/register', userData);
            console.log('Registration successful:', response);
            return response;
        } catch (error) {
            console.error('Registration error:', error);
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
                throw new Error(error.response.data?.message || error.response.data?.error || 'Registration failed');
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response received:', error.request);
                throw new Error('No response from server. Please check your connection.');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Request setup error:', error.message);
                throw new Error('Error setting up registration request');
            }
        }
    }

    async login(credentials) {
        const response = await this.post('/auth/login', credentials);
        return response;
    }

    async adminLogin(credentials) {
        const response = await this.post('/auth/admin/login', credentials);
        return response;
    }

    async logout() {
        // The server will clear the HttpOnly cookie upon receiving this request.
        // No client-side token management is needed.
        await this.post('/auth/logout');
    }

    async forgotPassword(email) {
        return this.request('POST', '/auth/forgot-password', { email });
    }

    async resetPassword(token, newPassword) {
        return this.request('POST', '/auth/reset-password', { token, newPassword });
    }

    // Crypto methods
    async getCryptoPrices() {
        return this.get('/api/crypto/prices');
    }

    // User methods
    async getProfile() {
        return this.request('GET', '/users/profile');
    }

    async updateProfile(profileData) {
        return this.request('PUT', '/users/profile', profileData);
    }

    async changePassword(passwordData) {
        return this.request('PUT', '/users/change-password', passwordData);
    }

    async getDashboard() {
        return this.request('GET', '/users/dashboard');
    }

    async updateKYCStatus(kycData) {
        return this.request('POST', '/users/kyc', kycData);
    }

    // Investment methods
    async getInvestments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('GET', `/investments${queryString ? '?' + queryString : ''}`);
    }

    async createInvestment(investmentData) {
        return this.request('POST', '/investments', investmentData);
    }

    async getInvestment(id) {
        return this.request('GET', `/investments/${id}`);
    }

    async cancelInvestment(id) {
        return this.request('POST', `/investments/${id}/cancel`);
    }

    // Transaction methods
    async getTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('GET', `/transactions${queryString ? '?' + queryString : ''}`);
    }

    async createDeposit(depositData) {
        return this.request('POST', '/transactions/deposit', depositData);
    }

    async createWithdrawal(withdrawalData) {
        return this.request('POST', '/transactions/withdraw', withdrawalData);
    }

    async getTransaction(id) {
        return this.request('GET', `/transactions/${id}`);
    }

    async cancelTransaction(id) {
        return this.request('POST', `/transactions/${id}/cancel`);
    }

    // Package methods
    async getPackages() {
        return this.request('GET', '/packages');
    }

    async getPackage(id) {
        return this.request('GET', `/packages/${id}`);
    }

    // Admin methods
    async getAdminDashboard() {
        return this.request('GET', '/admin/dashboard');
    }

    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('GET', `/admin/users${queryString ? '?' + queryString : ''}`);
    }

    async getUser(id) {
        return this.request('GET', `/admin/users/${id}`);
    }

    async updateUserStatus(id, statusData) {
        return this.request('PUT', `/admin/users/${id}/status`, statusData);
    }

    async getAdminTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('GET', `/admin/transactions${queryString ? '?' + queryString : ''}`);
    }

    async updateTransactionStatus(id, statusData) {
        return this.request('PUT', `/admin/transactions/${id}/status`, statusData);
    }

    async getAdminPackages() {
        return this.request('GET', '/admin/packages');
    }

    async createPackage(packageData) {
        return this.request('POST', '/admin/packages', packageData);
    }

    async getAuditLogs(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('GET', `/admin/audit-logs${queryString ? '?' + queryString : ''}`);
    }

    async generateReport(type, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const headers = {
            ...this.getHeaders(),
            'Accept': 'application/pdf,application/json'
        };
        
        const response = await fetch(`${this.baseURL}/admin/reports/${type}${queryString ? '?' + queryString : ''}`, {
            method: 'GET',
            headers,
            credentials: 'include',
            mode: 'cors'
        });

        if (type === 'pdf') {
            return await response.blob();
        }
        return await response.json();
    }
}

// Create global API client instance
window.api = new APIClient();

// Add CSS for notifications if not already added
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .notification-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 1.2em;
            cursor: pointer;
            margin-left: 10px;
            padding: 0;
            line-height: 1;
        }
        
        .spinner {
            display: inline-block;
            width: 1em;
            height: 1em;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
