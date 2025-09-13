// Investment Forms Integration
document.addEventListener('DOMContentLoaded', function() {
    if (!utils.requireAuth()) {
        return;
    }
    
    initializeInvestmentForms();
    loadInvestmentPackages();
    loadUserInvestments();
});

function initializeInvestmentForms() {
    // Investment Form Handler
    const investmentForm = document.getElementById('investmentForm');
    if (investmentForm) {
        investmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                const errors = utils.validateForm(this);
                if (errors.length > 0) {
                    utils.showNotification(errors[0], 'error');
                    return;
                }
                
                utils.showLoading(submitBtn, true);
                
                const formData = utils.getFormData(this);
                const response = await api.createInvestment({
                    packageId: formData.packageId,
                    amount: parseFloat(formData.amount)
                });
                
                utils.showNotification('Investment created successfully!', 'success');
                
                // Show investment confirmation
                displayInvestmentConfirmation(response.investment);
                
                // Reset form and reload data
                this.reset();
                await loadUserInvestments();
                
            } catch (error) {
                utils.showNotification(error.message || 'Investment creation failed', 'error');
            } finally {
                utils.showLoading(submitBtn, false);
                submitBtn.textContent = originalText;
            }
        });
    }

    // Package selection handler
    document.addEventListener('change', function(e) {
        if (e.target.name === 'packageId') {
            updateInvestmentLimits(e.target.value);
        }
    });

    // Amount input validation
    document.addEventListener('input', function(e) {
        if (e.target.name === 'amount') {
            validateInvestmentAmount(e.target);
        }
    });
}

async function loadInvestmentPackages() {
    try {
        const response = await api.getPackages();
        displayInvestmentPackages(response.packages);
    } catch (error) {
        console.error('Failed to load investment packages:', error);
        utils.showNotification('Failed to load investment packages', 'error');
    }
}

function displayInvestmentPackages(packages) {
    const container = document.getElementById('packagesGrid');
    if (!container) return;
    
    if (packages.length === 0) {
        container.innerHTML = '<p class="no-data">No investment packages available</p>';
        return;
    }
    
    container.innerHTML = packages.map(pkg => `
        <div class="package-card" data-package-id="${pkg.id}">
            <div class="package-header">
                <h3 class="package-name">${pkg.name}</h3>
                <div class="package-risk risk-${pkg.risk_level}">${pkg.risk_level.toUpperCase()}</div>
            </div>
            <div class="package-body">
                <p class="package-description">${pkg.description}</p>
                <div class="package-details">
                    <div class="detail-item">
                        <span class="label">Return Rate:</span>
                        <span class="value">${pkg.return_rate}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Duration:</span>
                        <span class="value">${pkg.duration_days} days</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Min Investment:</span>
                        <span class="value">${utils.formatCurrency(pkg.min_amount)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Max Investment:</span>
                        <span class="value">${utils.formatCurrency(pkg.max_amount)}</span>
                    </div>
                </div>
            </div>
            <div class="package-footer">
                <button class="btn btn-primary invest-btn" onclick="selectPackage('${pkg.id}', '${pkg.name}', ${pkg.min_amount}, ${pkg.max_amount})">
                    Invest Now
                </button>
            </div>
        </div>
    `).join('');
    
    // Also populate package select dropdown if exists
    const packageSelect = document.getElementById('packageSelect');
    if (packageSelect) {
        packageSelect.innerHTML = '<option value="">Select a package...</option>' + 
            packages.map(pkg => `
                <option value="${pkg.id}" data-min="${pkg.min_amount}" data-max="${pkg.max_amount}">
                    ${pkg.name} - ${pkg.return_rate}% (${pkg.duration_days} days)
                </option>
            `).join('');
    }
}

function selectPackage(packageId, packageName, minAmount, maxAmount) {
    // Populate investment form if it exists
    const packageSelect = document.getElementById('packageSelect');
    const amountInput = document.getElementById('investmentAmount');
    
    if (packageSelect) {
        packageSelect.value = packageId;
        updateInvestmentLimits(packageId);
    }
    
    if (amountInput) {
        amountInput.min = minAmount;
        amountInput.max = maxAmount;
        amountInput.placeholder = `Min: ${utils.formatCurrency(minAmount)} - Max: ${utils.formatCurrency(maxAmount)}`;
        amountInput.focus();
    }
    
    // Scroll to investment form
    const investmentForm = document.getElementById('investmentForm');
    if (investmentForm) {
        investmentForm.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateInvestmentLimits(packageId) {
    const packageSelect = document.getElementById('packageSelect');
    const amountInput = document.getElementById('investmentAmount');
    const limitsDisplay = document.getElementById('investmentLimits');
    
    if (!packageSelect || !amountInput) return;
    
    const selectedOption = packageSelect.querySelector(`option[value="${packageId}"]`);
    if (selectedOption) {
        const minAmount = parseFloat(selectedOption.dataset.min);
        const maxAmount = parseFloat(selectedOption.dataset.max);
        
        amountInput.min = minAmount;
        amountInput.max = maxAmount;
        amountInput.placeholder = `Enter amount (${utils.formatCurrency(minAmount)} - ${utils.formatCurrency(maxAmount)})`;
        
        if (limitsDisplay) {
            limitsDisplay.textContent = `Investment range: ${utils.formatCurrency(minAmount)} - ${utils.formatCurrency(maxAmount)}`;
        }
    }
}

function validateInvestmentAmount(input) {
    const amount = parseFloat(input.value);
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    
    input.classList.remove('error');
    
    if (amount && (amount < min || amount > max)) {
        input.classList.add('error');
        const errorMsg = document.getElementById('amountError');
        if (errorMsg) {
            errorMsg.textContent = `Amount must be between ${utils.formatCurrency(min)} and ${utils.formatCurrency(max)}`;
            errorMsg.style.display = 'block';
        }
    } else {
        const errorMsg = document.getElementById('amountError');
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
    }
}

async function loadUserInvestments() {
    try {
        const response = await api.getInvestments({ limit: 10 });
        displayUserInvestments(response.investments);
        updateInvestmentSummary(response.summary);
    } catch (error) {
        console.error('Failed to load user investments:', error);
    }
}

function displayUserInvestments(investments) {
    const container = document.getElementById('userInvestments');
    if (!container) return;
    
    if (investments.length === 0) {
        container.innerHTML = '<p class="no-data">No investments found</p>';
        return;
    }
    
    container.innerHTML = investments.map(investment => {
        const progress = calculateInvestmentProgress(investment);
        const profitLoss = investment.current_value - investment.amount;
        const profitLossPercent = ((profitLoss / investment.amount) * 100).toFixed(2);
        
        return `
            <div class="investment-item" data-id="${investment.id}">
                <div class="investment-header">
                    <h4 class="package-name">${investment.package_name}</h4>
                    <span class="investment-status status-${investment.status}">${investment.status}</span>
                </div>
                <div class="investment-details">
                    <div class="detail-row">
                        <span class="label">Invested Amount:</span>
                        <span class="value">${utils.formatCurrency(investment.amount)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Current Value:</span>
                        <span class="value">${utils.formatCurrency(investment.current_value)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Profit/Loss:</span>
                        <span class="value ${profitLoss >= 0 ? 'positive' : 'negative'}">
                            ${profitLoss >= 0 ? '+' : ''}${utils.formatCurrency(profitLoss)} (${profitLossPercent}%)
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Expected Return:</span>
                        <span class="value">${utils.formatCurrency(investment.expected_return)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">End Date:</span>
                        <span class="value">${utils.formatDate(investment.end_date)}</span>
                    </div>
                </div>
                <div class="investment-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}% Complete</span>
                </div>
                <div class="investment-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewInvestmentDetails('${investment.id}')">
                        View Details
                    </button>
                    ${investment.status === 'active' ? `
                        <button class="btn btn-danger btn-sm" onclick="cancelInvestment('${investment.id}')">
                            Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function calculateInvestmentProgress(investment) {
    const startDate = new Date(investment.start_date);
    const endDate = new Date(investment.end_date);
    const now = new Date();
    
    const totalDuration = endDate - startDate;
    const elapsed = now - startDate;
    
    return Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100).toFixed(1);
}

function updateInvestmentSummary(summary) {
    const elements = {
        totalInvestments: document.getElementById('totalInvestments'),
        totalInvested: document.getElementById('totalInvested'),
        currentValue: document.getElementById('currentValue'),
        totalProfit: document.getElementById('totalProfit')
    };
    
    if (elements.totalInvestments) {
        elements.totalInvestments.textContent = summary.totalInvestments || 0;
    }
    if (elements.totalInvested) {
        elements.totalInvested.textContent = utils.formatCurrency(summary.totalInvested || 0);
    }
    if (elements.currentValue) {
        elements.currentValue.textContent = utils.formatCurrency(summary.currentValue || 0);
    }
    if (elements.totalProfit) {
        elements.totalProfit.textContent = utils.formatCurrency(summary.totalProfit || 0);
    }
}

async function viewInvestmentDetails(investmentId) {
    try {
        const investment = await api.getInvestment(investmentId);
        displayInvestmentModal(investment);
    } catch (error) {
        utils.showNotification('Failed to load investment details', 'error');
    }
}

async function cancelInvestment(investmentId) {
    if (!confirm('Are you sure you want to cancel this investment? This action cannot be undone.')) {
        return;
    }
    
    try {
        await api.cancelInvestment(investmentId);
        utils.showNotification('Investment cancelled successfully', 'success');
        await loadUserInvestments();
    } catch (error) {
        utils.showNotification(error.message || 'Failed to cancel investment', 'error');
    }
}

function displayInvestmentConfirmation(investment) {
    const modal = document.createElement('div');
    modal.className = 'investment-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Investment Confirmation</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="confirmation-details">
                    <p><strong>Package:</strong> ${investment.packageName}</p>
                    <p><strong>Investment Amount:</strong> ${utils.formatCurrency(investment.amount)}</p>
                    <p><strong>Expected Return:</strong> ${utils.formatCurrency(investment.expectedReturn)}</p>
                    <p><strong>Maturity Date:</strong> ${utils.formatDate(investment.endDate)}</p>
                    <p><strong>Status:</strong> ${investment.status}</p>
                    <div class="success-message">
                        ✅ Your investment has been created successfully! You can track its progress in your dashboard.
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.investment-modal').remove()">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function displayInvestmentModal(investmentData) {
    const investment = investmentData.investment;
    const transactions = investmentData.transactions || [];
    
    const modal = document.createElement('div');
    modal.className = 'investment-modal';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3>Investment Details</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="investment-details-full">
                    <div class="detail-section">
                        <h4>Investment Information</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="label">Package:</span>
                                <span class="value">${investment.package_name}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Investment ID:</span>
                                <span class="value">${investment.id}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Amount Invested:</span>
                                <span class="value">${utils.formatCurrency(investment.amount)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Current Value:</span>
                                <span class="value">${utils.formatCurrency(investment.current_value)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Expected Return:</span>
                                <span class="value">${utils.formatCurrency(investment.expected_return)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Return Rate:</span>
                                <span class="value">${investment.return_rate}%</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Duration:</span>
                                <span class="value">${investment.duration_days} days</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Start Date:</span>
                                <span class="value">${utils.formatDate(investment.start_date)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">End Date:</span>
                                <span class="value">${utils.formatDate(investment.end_date)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Days Remaining:</span>
                                <span class="value">${investment.daysRemaining || 0} days</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Progress:</span>
                                <span class="value">${investment.progress || 0}%</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">Status:</span>
                                <span class="value status-${investment.status}">${investment.status}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${transactions.length > 0 ? `
                        <div class="detail-section">
                            <h4>Related Transactions</h4>
                            <div class="transactions-list">
                                ${transactions.map(tx => `
                                    <div class="transaction-item">
                                        <span class="tx-type">${tx.type.toUpperCase()}</span>
                                        <span class="tx-amount">${utils.formatCurrency(tx.amount)}</span>
                                        <span class="tx-status status-${tx.status}">${tx.status}</span>
                                        <span class="tx-date">${utils.formatDateTime(tx.created_at)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.investment-modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Add investment-specific styles
const investmentCSS = `
    .investment-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }
    
    .modal-content.large {
        max-width: 800px;
        width: 95%;
    }
    
    .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .detail-section {
        margin-bottom: 30px;
    }
    
    .detail-section h4 {
        color: #002147;
        border-bottom: 2px solid #DAA520;
        padding-bottom: 10px;
        margin-bottom: 15px;
    }
    
    .package-card {
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .package-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .package-risk.risk-low { background: #28a745; color: white; }
    .package-risk.risk-medium { background: #ffc107; color: black; }
    .package-risk.risk-high { background: #dc3545; color: white; }
    
    .investment-progress {
        margin: 15px 0;
    }
    
    .progress-bar {
        width: 100%;
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #DAA520, #B8860B);
        transition: width 0.3s ease;
    }
    
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    
    .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 15px;
        border-radius: 4px;
        margin-top: 15px;
    }
`;

const style = document.createElement('style');
style.textContent = investmentCSS;
document.head.appendChild(style);
