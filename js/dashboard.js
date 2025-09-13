// Dashboard JavaScript with API Integration
document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInitDashboard();
});

async function checkAuthAndInitDashboard() {
    try {
        const response = await fetch('/api/auth/status');
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        const authData = await response.json();
        
        // Store user data for UI
        sessionStorage.setItem('user', JSON.stringify(authData.user));

        // Initialize dashboard
        initializeDashboard(authData.user);
        loadDashboardData();
    } catch (error) {
        window.location.href = '/login.html';
    }
}

function initializeDashboard(user) {
    // Set user information from the data we already have
    document.getElementById('userName').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('userLoginId').textContent = user.login_id;
    document.getElementById('welcomeName').textContent = user.first_name;
    
    // Set user avatar initials
    const initials = `${user.first_name[0]}${user.last_name[0]}`;
    document.getElementById('userAvatar').textContent = initials;

    // Add event listener for logout
    const logoutButton = document.querySelector('a[onclick="logout()"]');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await api.logout();
            } catch (err) {
                console.error('Logout API call failed, but logging out client-side anyway.', err);
            }
            sessionStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }
}

async function loadDashboardData() {
    try {
        // Load dashboard data from API
        const dashboardData = await api.getDashboard();
        
        updateDashboardUI(dashboardData);

        // Fetch and display crypto prices
        await loadAndDisplayCryptoPrices();
        
    } catch (error) {
        utils.showNotification('Failed to load dashboard data', 'error');
    }
}

function updateDashboardUI(data) {
    // Update summary cards
    document.getElementById('accountBalance').textContent = utils.formatCurrency(data.user.accountBalance);
    document.getElementById('totalInvested').textContent = utils.formatCurrency(data.user.totalInvested);
    document.getElementById('totalProfit').textContent = utils.formatCurrency(data.user.totalProfit);
    document.getElementById('activePackages').textContent = data.investments.summary.count;
    
    // Calculate profit percentage
    if (data.user.totalInvested > 0) {
        const profitPercentage = (data.user.totalProfit / data.user.totalInvested * 100).toFixed(1);
        document.getElementById('profitPercentage').textContent = `${profitPercentage}%`;
    }

    // Update investments grid
    const investmentsGrid = document.getElementById('investmentsGrid');
    if (data.investments.active.length > 0) {
        investmentsGrid.innerHTML = data.investments.active.map(inv => `
            <div class="investment-card">
                <h3>${inv.package_name}</h3>
                <p>Invested: ${utils.formatCurrency(inv.amount)}</p>
                <p>Status: <span class="status-${inv.status}">${inv.status}</span></p>
            </div>
        `).join('');
    }

    // Update transactions list
    const transactionsList = document.getElementById('transactionsList');
    if (data.transactions.length > 0) {
        transactionsList.innerHTML = data.transactions.map(tx => `
            <div class="transaction-item">
                <div class="transaction-icon ${tx.type}">
                    <i class="fas fa-${getTxIcon(tx.type)}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">${tx.description || tx.type}</div>
                    <div class="transaction-date">${new Date(tx.created_at).toLocaleString()}</div>
                </div>
                <div class="transaction-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
                    ${tx.amount > 0 ? '+' : ''}${utils.formatCurrency(tx.amount)}
                </div>
                <div class="transaction-status ${tx.status}">${tx.status}</div>
            </div>
        `).join('');
    }
}

async function loadAndDisplayCryptoPrices() {
    try {
        const prices = await api.getCryptoPrices();

        if (prices.BTC) document.getElementById('btc-price-display').textContent = utils.formatCurrency(prices.BTC.price);
        if (prices.ETH) document.getElementById('eth-price-display').textContent = utils.formatCurrency(prices.ETH.price);
        if (prices.LTC) document.getElementById('ltc-price-display').textContent = utils.formatCurrency(prices.LTC.price);
    } catch (error) {
        utils.showNotification('Could not fetch live crypto prices.', 'warning');
        document.getElementById('btc-price-display').textContent = 'Error';
        document.getElementById('eth-price-display').textContent = 'Error';
        document.getElementById('ltc-price-display').textContent = 'Error';
    }
}

function loadInvestments(investments) { // This function seems unused, but keeping it for now.
    const container = document.getElementById('investmentsGrid');
    
    if (investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>No Active Investments</h3>
                <p>Start your investment journey today</p>
                <a href="#" onclick="showTab('packages')" class="btn btn-primary">Choose Package</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = investments.map(investment => `
        <div class="investment-card">
            <div class="investment-header">
                <h3>${investment.packageName}</h3>
                <span class="investment-status ${investment.status}">${investment.status}</span>
            </div>
            <div class="investment-details">
                <div class="detail-row">
                    <span>Invested Amount:</span>
                    <span>${formatCurrency(investment.amount)}</span>
                </div>
                <div class="detail-row">
                    <span>Expected Return:</span>
                    <span>${formatCurrency(investment.expectedReturn)}</span>
                </div>
                <div class="detail-row">
                    <span>Current Profit:</span>
                    <span class="profit-positive">${formatCurrency(investment.currentProfit)}</span>
                </div>
                <div class="detail-row">
                    <span>Duration:</span>
                    <span>${investment.duration} months</span>
                </div>
                <div class="detail-row">
                    <span>Start Date:</span>
                    <span>${formatDate(investment.startDate)}</span>
                </div>
                <div class="detail-row">
                    <span>End Date:</span>
                    <span>${formatDate(investment.endDate)}</span>
                </div>
            </div>
            <div class="investment-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${investment.progress}%"></div>
                </div>
                <span class="progress-text">${investment.progress}% Complete</span>
            </div>
        </div>
    `).join('');
}

function loadTransactions(transactions) { // This function seems unused, but keeping it for now.
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No Transactions Yet</h3>
                <p>Your transaction history will appear here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon ${transaction.type}">
                <i class="fas fa-${getTransactionIcon(transaction.type)}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-title">${transaction.description}</div>
                <div class="transaction-date">${formatDate(transaction.date)}</div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'deposit' || transaction.type === 'profit' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </div>
            <div class="transaction-status ${transaction.status}">${transaction.status}</div>
        </div>
    `).join('');
}

let currentInvestment = null;

function investInPackage(packageId, packageName, returnRate, duration, minAmount, maxAmount) {
    currentInvestment = { packageId, packageName, returnRate, duration, minAmount, maxAmount };
    
    // Update modal content
    document.getElementById('modalPackageName').textContent = packageName;
    document.getElementById('modalPackageDetails').textContent = `${packageName} - ${duration} Months`;
    document.getElementById('modalReturnRate').textContent = `${returnRate}%`;
    
    // Get current balance
    const user = JSON.parse(sessionStorage.getItem('user'));
    document.getElementById('modalAvailableBalance').textContent = utils.formatCurrency(user.account_balance || 0);
    
    // Show modal
    document.getElementById('investmentModal').style.display = 'flex';
    
    // Add event listener for amount input
    document.getElementById('investmentAmount').addEventListener('input', calculateReturns);
}

function calculateReturns() {
    const amount = parseFloat(document.getElementById('investmentAmount').value) || 0;
    const returnRate = currentInvestment.returnRate / 100;
    const duration = currentInvestment.duration;
    
    const monthlyReturn = (amount * returnRate) / 12;
    const totalReturn = monthlyReturn * duration;
    
    document.getElementById('monthlyReturn').textContent = formatCurrency(monthlyReturn);
    document.getElementById('totalReturn').textContent = formatCurrency(totalReturn);
}

async function confirmInvestment() {
    const amount = parseFloat(document.getElementById('investmentAmount').value);
    
    if (!currentInvestment || !currentInvestment.packageId) {
        utils.showNotification('Please select a package first.', 'error');
        return;
    }

    if (!amount || amount < currentInvestment.minAmount) {
        utils.showNotification(`Minimum investment is ${utils.formatCurrency(currentInvestment.minAmount)}.`, 'error');
        return;
    }

    try {
        const response = await api.createInvestment({
            packageId: currentInvestment.packageId,
            amount: amount
        });

        closeModal();
        utils.showNotification(response.message, 'success');
        await loadDashboardData(); // Reload data from the server

    } catch (error) {
        utils.showNotification(error.message || 'Investment failed.', 'error');
    }
}

function closeModal() {
    document.getElementById('investmentModal').style.display = 'none';
    document.getElementById('investmentAmount').value = '';
    document.getElementById('monthlyReturn').textContent = '$0.00';
    document.getElementById('totalReturn').textContent = '$0.00';
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getTransactionIcon(type) {
    const icons = {
        deposit: 'plus',
        withdrawal: 'arrow-up',
        investment: 'chart-line',
        profit: 'trophy'
    };
    return icons[type] || 'exchange-alt';
}
