// Admin Dashboard Core Functionality
document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInit();
});

async function checkAuthAndInit() {
    try {
        // The HttpOnly cookie is sent automatically by the browser.
        const response = await fetch('/api/admin/status');
        
        if (!response.ok) {
            // This will catch 401, 403, 500 etc.
            throw new Error('Authentication check failed');
        }

        const authData = await response.json();
        
        // If we get here, the user is authenticated.
        // Store user info for the UI.
        sessionStorage.setItem('adminUser', JSON.stringify(authData.user));

        // Now initialize the dashboard
        populateAdminHeader(authData.user);

        initSidebar();
        initNavigation();
        initModals();
        initEventListeners();
        
        loadAdminData();
        
        window.addEventListener('hashchange', handleHashChange);
        setTimeout(handleHashChange, 0);

    } catch (error) {
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

function populateAdminHeader(user) {
    const adminAvatar = document.getElementById('adminAvatar');
    const adminUsername = document.getElementById('adminUsername');

    if (!user || !adminAvatar || !adminUsername) return;

    const initials = (user.first_name?.[0] || 'A').toUpperCase();
    adminAvatar.textContent = initials;
    adminUsername.textContent = user.username || 'Admin';
}

// Initialize sidebar functionality
function initSidebar() {
    const sidebarToggle = document.querySelector('.hamburger-menu'); // Assuming a toggle button exists
    const sidebar = document.querySelector('.admin-sidebar');
    const mainContent = document.querySelector('.admin-main');
    
    if (!sidebarToggle || !sidebar || !mainContent) return;
    
    // Toggle sidebar on mobile
    sidebarToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleSidebar();
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && 
            !sidebar.contains(e.target) && 
            !sidebarToggle.contains(e.target) &&
            sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });
}

// Toggle sidebar visibility
function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    const sidebar = document.querySelector('.admin-sidebar');
    const mainContent = document.querySelector('.admin-main');
    if (sidebar) sidebar.classList.toggle('active');
    if (mainContent) mainContent.classList.toggle('sidebar-open');
}

// Close sidebar
function closeSidebar() {
    if (window.innerWidth <= 1024) {
        document.body.classList.remove('sidebar-open');
        const sidebar = document.querySelector('.admin-sidebar');
        const mainContent = document.querySelector('.admin-main');
        if (sidebar) sidebar.classList.remove('active');
        if (mainContent) mainContent.classList.remove('sidebar-open');
    }
}

// Initialize navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href');
            if (!target.startsWith('#')) {
                // Handle external links
                window.location.href = target;
            }
        });
    });
}

// Set active navigation item and show corresponding section
function setActiveNav() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-item');
    const adminSections = document.querySelectorAll('.admin-section');
    const DEFAULT_SECTION = 'dashboard';
    
    let currentHash = window.location.hash.substring(1);
    
    // If no hash or invalid section, default to dashboard
    if (!currentHash || !document.getElementById(currentHash)) {
        currentHash = DEFAULT_SECTION;
        window.history.replaceState(null, null, `#${currentHash}`);
    }
    
    // Update active nav item
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentHash}`) {
            link.classList.add('active');
        }
    });
    
    // Show current section and hide others
    adminSections.forEach(section => {
        if (section.id === currentHash) {
            section.style.display = 'block';
            section.classList.add('active');
            window.scrollTo(0, 0);
            refreshSection(section.id);
        } else {
            section.style.display = 'none';
            section.classList.remove('active');
        }
    });
    
    // Update page title
    updatePageTitle(currentHash);
}

// Update page title based on current section
function updatePageTitle(sectionName) {
    const pageTitle = document.getElementById('pageTitle');
    if (!pageTitle) return;
    const section = document.getElementById(sectionName);
    if (section) {
        const sectionTitle = section.querySelector('h2') || { textContent: sectionName.charAt(0).toUpperCase() + sectionName.slice(1) };
        pageTitle.textContent = sectionTitle.textContent;
    } else {
        pageTitle.textContent = 'Dashboard';
    }
}

// Initialize modals
function initModals() {
    // Close modal when clicking the close button or outside the modal
    document.querySelectorAll('.modal-close, [data-action="closeModal"]').forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            } else {
                closeAllModals();
            }
        });
    });
    
    // Close modal when clicking outside the modal content
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            adminLogout();
        });
    }
}

// Handle hash change for direct URL access
function handleHashChange() {
    setActiveNav();
    closeSidebar();
}

// Global admin data
let adminData = {
    users: [],
    // State for tables
    tableState: {
        investments: { page: 1, totalPages: 1 },
        transactions: { page: 1, totalPages: 1 },
        deposits: { page: 1, totalPages: 1 },
    },
    tokens: [],
    deposits: [],
    investments: [],
    transactions: [],
    settings: {
        btcWallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        ltcWallet: 'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        packages: {
            starter: 8,
            professional: 10,
            premium: 12
        }
    }
};

async function changeTablePage(tableName, direction) {
    const state = adminData.tableState[tableName];
    const newPage = state.page + direction;
    if (newPage > 0 && newPage <= state.totalPages) {
        state.page = newPage;
        if (tableName === 'investments') await loadInvestmentsTable();
        if (tableName === 'transactions') await loadTransactionsTable();
        if (tableName === 'deposits') await loadDepositsTable();
    }
}

async function loadAdminData() {
    try {
        // The auth check is now done by `checkAuthAndInit`.
        // The HttpOnly cookie is sent automatically.
        const response = await fetch('/api/admin/dashboard');

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                adminLogout();
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch dashboard data');
        }

        const data = await response.json();
        
        // Update global data object
        adminData.users = data.recentActivity.users || [];
        adminData.transactions = data.recentActivity.transactions || [];
        adminData.deposits = data.recentActivity.transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
        
        // Update dashboard stats
        updateDashboardStats(data.statistics);

        // Refresh UI sections with new data
        refreshAllSections();

    } catch (error) {
        utils.showNotification(error.message, 'error');
        adminLogout(); // If anything fails, log out.
    }
}

function updateDashboardStats(stats) {
    if (!stats) return;
    document.getElementById('totalUsers').textContent = stats.users?.total_users || 0;
    document.getElementById('totalDeposits').textContent = formatCurrency(stats.transactions?.total_deposits || 0);
    document.getElementById('totalInvestments').textContent = formatCurrency(stats.investments?.total_invested || 0);
    document.getElementById('totalProfits').textContent = formatCurrency(stats.transactions?.total_profits_paid || 0);
}

function refreshSection(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            loadRecentUsers();
            loadPendingDeposits();
            break;
        case 'deposits':
            loadDepositsTable();
            break;
        case 'investments':
            loadInvestmentsTable();
            break;
        case 'transactions':
            loadTransactionsTable();
            break;
        // 'users' and 'tokens' sections are handled by their own dedicated JS files (users.js, tokens.js)
    }
}

function refreshAllSections() {
    loadRecentUsers();
    loadPendingDeposits();
    // Other sections are loaded when they become active
}

function loadRecentUsers() {
    const container = document.getElementById('recentUsers');
    if (!container) return;
    const recentUsers = adminData.users.slice(0, 3);
    
    if (recentUsers.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: #6c757d;">No recent users</div>';
        return;
    }
    
    container.innerHTML = recentUsers.map(user => {
        const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
        return `
        <div class="user-item">
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${user.first_name} ${user.last_name}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <div class="user-status active">Active</div>
        </div>
    `}).join('');
}

function loadPendingDeposits() {
    const container = document.getElementById('pendingDeposits');
    const pendingDeposits = adminData.deposits.filter(d => d.status === 'pending');
    
    if (pendingDeposits.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: #6c757d;">No pending deposits</div>';
        return;
    }
    
    container.innerHTML = pendingDeposits.map(deposit => `
        <div class="deposit-item">
            <div class="deposit-info">
                <div class="deposit-amount">${formatCurrency(deposit.amount)}</div>
                <div class="deposit-user">${deposit.first_name} ${deposit.last_name}</div>
            </div>
            <div class="deposit-actions">
                <button class="btn btn-success btn-small" data-action="approveDeposit" data-deposit-id="${deposit.id}">Approve</button>
                <button class="btn btn-danger btn-small" data-action="rejectDeposit" data-deposit-id="${deposit.id}">Reject</button>
            </div>
        </div>
    `).join('');
}

async function loadDepositsTable() {
    const tbody = document.getElementById('depositsTable');
    const filter = document.getElementById('depositFilter')?.value || 'all';
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading deposits...</td></tr>';

    try {
        let url = '/api/admin/transactions?type=deposit&limit=100'; // Fetch more deposits
        if (filter !== 'all') {
            url += `&status=${filter}`;
        }

        const response = await fetch(url, {
            // No headers needed, cookie is sent automatically
        });

        if (!response.ok) throw new Error('Failed to load deposits');

        const data = await response.json();
        const deposits = data.transactions;

        if (deposits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No deposits found for this filter.</td></tr>';
            return;
        }

        tbody.innerHTML = deposits.map(deposit => `
            <tr>
                <td class="font-mono">${deposit.id.substring(0, 8)}...</td>
                <td>${deposit.first_name} ${deposit.last_name}</td>
                <td class="font-mono">${formatCurrency(deposit.amount)}</td>
                <td>${deposit.payment_method?.toUpperCase() || 'N/A'}</td>
                <td><span class="status status-${deposit.status.toLowerCase()}">${deposit.status}</span></td>
                <td>${formatDateTime(deposit.created_at)}</td>
                <td>
                    ${deposit.status === 'pending' ?
                        `<button class="btn btn-success btn-small" data-action="approveDeposit" data-deposit-id="${deposit.id}"><i class="fas fa-check"></i> Approve</button>
                         <button class="btn btn-danger btn-small" data-action="rejectDeposit" data-deposit-id="${deposit.id}"><i class="fas fa-times"></i> Reject</button>` :
                        `<button class="btn btn-secondary btn-small" data-action="viewDeposit" data-deposit-id="${deposit.id}">View</button>`
                    }
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state text-danger">Error loading deposits.</td></tr>';
    }
}

async function loadInvestmentsTable() {
    const tbody = document.getElementById('investmentsTable');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading investments...</td></tr>';

    try {
        const params = new URLSearchParams({ page: adminData.tableState.investments.page, limit: 15 });
        const response = await fetch(`/api/admin/investments?${params}`);

        if (!response.ok) throw new Error('Failed to load investments');

        const data = await response.json();
        adminData.tableState.investments.totalPages = data.totalPages || 1;

        if (data.investments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No investments found.</td></tr>';
        } else {
            tbody.innerHTML = data.investments.map(inv => `
                <tr>
                    <td class="font-mono">${inv.id.substring(0, 8)}...</td>
                    <td>${inv.first_name} ${inv.last_name} (${inv.user_login_id})</td>
                    <td>${inv.package_name}</td>
                    <td class="font-mono">${formatCurrency(inv.amount)}</td>
                    <td><span class="status status-${inv.status.toLowerCase()}">${inv.status}</span></td>
                    <td>${formatDateTime(inv.start_date)}</td>
                    <td>${formatDateTime(inv.end_date)}</td>
                </tr>
            `).join('');
        }
        updatePaginationControls('investments');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state text-danger">Error loading investments.</td></tr>';
    }
}

async function loadTransactionsTable(page = null) {
    const tbody = document.getElementById('transactionsTable');
    if (!tbody) return;

    if (page) adminData.tableState.transactions.page = page;

    const typeFilter = document.getElementById('transactionFilter')?.value || 'all';
    const statusFilter = document.getElementById('transactionStatusFilter')?.value || 'all';

    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading transactions...</td></tr>';

    try {
        const params = new URLSearchParams({ page: adminData.tableState.transactions.page, limit: 15 });
        if (typeFilter !== 'all') params.append('type', typeFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);

        const response = await fetch(`/api/admin/transactions?${params}`);

        if (!response.ok) throw new Error('Failed to load transactions');

        const data = await response.json();
        adminData.tableState.transactions.totalPages = data.pagination.pages || 1;

        if (data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No transactions found.</td></tr>';
        } else {
            tbody.innerHTML = data.transactions.map(tx => `
                <tr>
                    <td>${tx.id.substring(0, 8)}...</td>
                    <td>${tx.first_name} ${tx.last_name} (${tx.login_id})</td>
                    <td><span class="status status-${tx.type.toLowerCase()}">${tx.type}</span></td>
                    <td class="font-mono">${formatCurrency(tx.amount)}</td>
                    <td><span class="status status-${tx.status.toLowerCase()}">${tx.status}</span></td>
                    <td>${formatDateTime(tx.created_at)}</td>
                    <td>
                        <button class="btn btn-secondary btn-small" data-action="viewTransaction" data-transaction-id="${tx.id}">View</button>
                    </td>
                </tr>
            `).join('');
        }
        updatePaginationControls('transactions');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state text-danger">Error loading transactions.</td></tr>';
    }
}

function updatePaginationControls(tableName) {
    const state = adminData.tableState[tableName];
    const pageInfo = document.getElementById(`${tableName}PageInfo`);
    const prevBtn = document.getElementById(`${tableName}PrevPage`);
    const nextBtn = document.getElementById(`${tableName}NextPage`);

    if (pageInfo) pageInfo.textContent = `Page ${state.page} of ${state.totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= state.totalPages;
}

// Settings Management
function saveWalletSettings() {
    adminData.settings.btcWallet = document.getElementById('btcWallet').value;
    adminData.settings.ltcWallet = document.getElementById('ltcWallet').value;
    saveAdminData();
    utils.showNotification('Wallet settings saved!', 'success');
}

function savePackageSettings() {
    adminData.settings.packages.starter = parseFloat(document.getElementById('starterRate').value);
    adminData.settings.packages.professional = parseFloat(document.getElementById('professionalRate').value);
    adminData.settings.packages.premium = parseFloat(document.getElementById('premiumRate').value);
    saveAdminData();
    utils.showNotification('Package settings saved!', 'success');
}

async function processMonthlyPayouts() {
    const button = document.getElementById('processPayoutsBtn');
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const response = await fetch('/api/admin/process-payouts', {
            method: 'POST',
            // No headers needed, cookie is sent automatically
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to process payouts');

        utils.showNotification(`Payouts processed successfully! Total payout: ${formatCurrency(result.totalPayout)}`, 'success');
    } catch (error) {
        utils.showNotification(error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

// Initialize event listeners
function initEventListeners() {
    // Filter change listeners
    document.getElementById('depositFilter')?.addEventListener('change', loadDepositsTable);
    document.getElementById('transactionFilter')?.addEventListener('change', () => loadTransactionsTable(1));
    document.getElementById('transactionStatusFilter')?.addEventListener('change', () => loadTransactionsTable(1));

    // Pagination listeners
    document.getElementById('investmentsPrevPage')?.addEventListener('click', () => changeTablePage('investments', -1));
    document.getElementById('investmentsNextPage')?.addEventListener('click', () => changeTablePage('investments', 1));
    document.getElementById('transactionsPrevPage')?.addEventListener('click', () => changeTablePage('transactions', -1));
    document.getElementById('transactionsNextPage')?.addEventListener('click', () => changeTablePage('transactions', 1));

    // Navigation listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
            window.location.hash = sectionId;
        });
    });
    
    // Search functionality
    document.getElementById('userSearch')?.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#usersTable tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
    
    // Static button listeners
    document.getElementById('logoutBtn')?.addEventListener('click', adminLogout);
    document.getElementById('exportUsersBtn')?.addEventListener('click', exportUsers);
    document.getElementById('generateTokenBtn')?.addEventListener('click', generateToken);
    document.getElementById('createTokenBtn')?.addEventListener('click', createToken);
    document.getElementById('cancelTokenModalBtn')?.addEventListener('click', closeTokenModal);
    document.getElementById('saveWalletSettingsBtn')?.addEventListener('click', saveWalletSettings);
    document.getElementById('savePackageSettingsBtn')?.addEventListener('click', savePackageSettings);
    document.getElementById('exportTransactionsBtn')?.addEventListener('click', exportTransactions);
    document.getElementById('processPayoutsBtn')?.addEventListener('click', processMonthlyPayouts);
    document.getElementById('editUserForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveUserChanges(); });

    // Event delegation for dynamic buttons
    document.body.addEventListener('click', function(event) {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        if (action) {
            switch (action) {
                case 'viewUser':
                    viewUser(target.dataset.userId);
                    break;
                case 'editUser':
                    UsersManager.editUser(target.dataset.userId);
                    break;
                case 'closeModal':
                    closeAllModals();
                    break;
                case 'copyToken':
                    copyToken(target.dataset.tokenCode);
                    break;
                case 'revokeToken':
                    deleteToken(target.dataset.tokenCode); // Assuming token code is the identifier
                    break;
                case 'viewDeposit':
                    viewDeposit(target.dataset.depositId);
                    break;
                case 'viewTransaction':
                    viewTransaction(target.dataset.transactionId);
                    break;
                case 'suspendUser':
                    UsersManager.suspendUser(target.dataset.userId, target.dataset.status);
                    break;
                case 'approveDeposit':
                    approveDeposit(target.dataset.depositId, target);
                    break;
                case 'rejectDeposit':
                    rejectDeposit(target.dataset.depositId, target);
                    break;
                case 'deleteUser':
                    UsersManager.deleteUser(target.dataset.userId);
                    break;
            }
        }
    });
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

function saveAdminData() {
    localStorage.setItem('adminData', JSON.stringify(adminData));
}

// User Management Modals
async function viewUser(userId) {
    const modal = document.getElementById('viewUserModal');
    const detailsContainer = document.getElementById('viewUserDetails');
    if (!modal || !detailsContainer) return;

    detailsContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading details...';
    try {
        const response = await fetch(`/api/admin/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user details.');

        const data = await response.json();
        const user = data.user;

        modal.style.display = 'flex';

        detailsContainer.innerHTML = `
            <div class="user-details-grid" style="display: grid; grid-template-columns: auto 1fr; gap: 10px 20px;">
                <div><strong>User ID:</strong></div><div>${user.id}</div>
                <div><strong>Login ID:</strong></div><div>${user.login_id}</div>
                <div><strong>Name:</strong></div><div>${user.first_name} ${user.last_name}</div>
                <div><strong>Email:</strong></div><div>${user.email}</div>
                <div><strong>Phone:</strong></div><div>${user.phone || 'N/A'}</div>
                <div><strong>Status:</strong></div><div><span class="status status-${user.account_status.toLowerCase()}">${user.account_status}</span></div>
                <div><strong>KYC Status:</strong></div><div><span class="status status-${user.kyc_status.toLowerCase()}">${user.kyc_status}</span></div>
                <div><strong>Registered:</strong></div><div>${formatDateTime(user.created_at)}</div>
                <div class="font-mono"><strong>Balance:</strong></div><div class="font-mono">${formatCurrency(user.account_balance)}</div>
                <div class="font-mono"><strong>Total Invested:</strong></div><div class="font-mono">${formatCurrency(user.total_invested)}</div>
                <div class="font-mono"><strong>Total Profit:</strong></div><div class="font-mono">${formatCurrency(user.total_profit)}</div>
            </div>
        `;
    } catch (error) {
        utils.showNotification(error.message, 'error');
        detailsContainer.innerHTML = `<div class="text-danger">${error.message}</div>`;
    }
}

async function editUser(userId) {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    if (!modal || !form) return;
    form.reset(); // Clear previous data
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user details.');

        const data = await response.json();
        const user = data.user;

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserName').value = `${user.first_name} ${user.last_name}`;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserBalance').value = user.account_balance;
        document.getElementById('editUserInvested').value = user.total_invested;
        document.getElementById('editUserProfit').value = user.total_profit;
        document.getElementById('editUserStatus').value = user.account_status;

        modal.style.display = 'flex';
    } catch (error) {
        utils.showNotification(error.message, 'error');
    }
}

async function saveUserChanges() {
    const form = document.getElementById('editUserForm');
    const userId = document.getElementById('editUserId').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const updatedData = {
        account_balance: document.getElementById('editUserBalance').value,
        account_status: document.getElementById('editUserStatus').value,
    };
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update user.');

        utils.showNotification('User updated successfully!', 'success');
        closeAllModals();
        loadAdminData(); // Refresh all data
    } catch (error) {
        utils.showNotification(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

async function viewDeposit(depositId) {
    const modal = document.getElementById('viewDepositModal');
    const detailsContainer = document.getElementById('viewDepositDetails');
    if (!modal || !detailsContainer) return;

    detailsContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`/api/admin/transactions/${depositId}`);
        if (!response.ok) throw new Error('Failed to fetch deposit details.');

        const data = await response.json();
        const deposit = data.transaction;

        detailsContainer.innerHTML = `
             <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 20px;">
                 <div><strong>Transaction ID:</strong></div><div>${deposit.id}</div>
                 <div><strong>User:</strong></div><div>${deposit.first_name} ${deposit.last_name}</div>
                 <div><strong>Amount:</strong></div><div class="font-mono">${formatCurrency(deposit.amount)}</div>
                 <div><strong>Method:</strong></div><div>${deposit.payment_method?.toUpperCase() || 'Crypto'}</div>
                 <div><strong>Status:</strong></div><div><span class="status status-${deposit.status.toLowerCase()}">${deposit.status}</span></div>
                 <div><strong>Date:</strong></div><div>${formatDateTime(deposit.created_at)}</div>
             </div>
        `;
    } catch (error) {
        utils.showNotification(error.message, 'error');
        detailsContainer.innerHTML = `<div class="text-danger">${error.message}</div>`;
    }
}

async function viewTransaction(transactionId) {
    const modal = document.getElementById('viewTransactionModal');
    const detailsContainer = document.getElementById('viewTransactionDetails');
    if (!modal || !detailsContainer) return;

    detailsContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`/api/admin/transactions/${transactionId}`);
        if (!response.ok) throw new Error('Failed to fetch transaction details.');

        const data = await response.json();
        const transaction = data.transaction;

        detailsContainer.innerHTML = `
             <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 20px;">
                 <div><strong>Transaction ID:</strong></div><div>${transaction.id}</div>
                 <div><strong>User:</strong></div><div>${transaction.first_name} ${transaction.last_name}</div>
                 <div><strong>Type:</strong></div><div>${transaction.type}</div>
                 <div><strong>Amount:</strong></div><div class="font-mono">${formatCurrency(transaction.amount)}</div>
                 <div><strong>Status:</strong></div><div><span class="status status-${transaction.status.toLowerCase()}">${transaction.status}</span></div>
                 <div><strong>Date:</strong></div><div>${formatDateTime(transaction.created_at)}</div>
                 <div><strong>Description:</strong></div><div>${transaction.description || 'N/A'}</div>
             </div>
        `;
    } catch (error) {
        utils.showNotification(error.message, 'error');
        detailsContainer.innerHTML = `<div class="text-danger">${error.message}</div>`;
    }
}

async function exportUsers() {
    utils.showNotification('Generating user export...', 'info');
    try {
        const response = await fetch('/api/admin/users/export');
        if (!response.ok) {
            throw new Error('Failed to generate export file.');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'users-export.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        utils.showNotification('User data exported successfully!', 'success');
    } catch (error) {
        utils.showNotification(error.message, 'error');
    }
}

async function exportTransactions() {
    utils.showNotification('Generating transaction export...', 'info');
    try {
        const response = await fetch('/api/admin/transactions/export');
        if (!response.ok) {
            throw new Error('Failed to generate export file.');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        downloadBlob(url, 'transactions-export.csv');
        utils.showNotification('Transaction data exported successfully!', 'success');
    } catch (error) {
        utils.showNotification(error.message, 'error');
    }
}

function downloadCSV(headers, rows, filename) {
    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);
    utils.showNotification('Data exported successfully!', 'success');
}
function downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function adminLogout() {
    sessionStorage.removeItem('adminUser');
    window.location.href = 'login.html';
}

function getUserName(userId) {
    const user = adminData.users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
}