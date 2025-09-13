// Transaction Forms Integration
document.addEventListener('DOMContentLoaded', function() {
    if (!utils.requireAuth()) {
        return;
    }
    
    initializeTransactionForms();
    loadTransactionHistory();
});

function initializeTransactionForms() {
    // Deposit Form Handler
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
        depositForm.addEventListener('submit', async function(e) {
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
                const response = await api.createDeposit({
                    amount: parseFloat(formData.amount),
                    paymentMethod: formData.paymentMethod,
                    walletAddress: formData.walletAddress
                });
                
                utils.showNotification('Deposit request created successfully!', 'success');
                
                // Show payment details
                displayPaymentDetails(response.paymentDetails, formData.paymentMethod);
                
                // Reset form
                this.reset();
                
            } catch (error) {
                utils.showNotification(error.message || 'Deposit request failed', 'error');
            } finally {
                utils.showLoading(submitBtn, false);
                submitBtn.textContent = originalText;
            }
        });
    }

    // Withdrawal Form Handler
    const withdrawalForm = document.getElementById('withdrawalForm');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', async function(e) {
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
                const withdrawalData = {
                    amount: parseFloat(formData.amount),
                    paymentMethod: formData.paymentMethod
                };
                
                if (formData.paymentMethod !== 'bank_transfer') {
                    withdrawalData.walletAddress = formData.walletAddress;
                } else {
                    withdrawalData.bankDetails = {
                        accountName: formData.accountName,
                        accountNumber: formData.accountNumber,
                        routingNumber: formData.routingNumber,
                        bankName: formData.bankName
                    };
                }
                
                const response = await api.createWithdrawal(withdrawalData);
                
                utils.showNotification('Withdrawal request submitted successfully!', 'success');
                
                // Show confirmation details
                displayWithdrawalConfirmation(response.transaction);
                
                // Reset form
                this.reset();
                
            } catch (error) {
                utils.showNotification(error.message || 'Withdrawal request failed', 'error');
            } finally {
                utils.showLoading(submitBtn, false);
                submitBtn.textContent = originalText;
            }
        });
    }

    // Payment method change handlers
    document.querySelectorAll('select[name="paymentMethod"]').forEach(select => {
        select.addEventListener('change', function() {
            togglePaymentFields(this.value, this.closest('form'));
        });
    });
}

function togglePaymentFields(paymentMethod, form) {
    const walletFields = form.querySelector('.wallet-fields');
    const bankFields = form.querySelector('.bank-fields');
    
    if (walletFields) {
        walletFields.style.display = paymentMethod !== 'bank_transfer' ? 'block' : 'none';
    }
    
    if (bankFields) {
        bankFields.style.display = paymentMethod === 'bank_transfer' ? 'block' : 'none';
    }
}

function displayPaymentDetails(paymentDetails, paymentMethod) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Payment Instructions</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${generatePaymentInstructions(paymentDetails, paymentMethod)}
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.payment-modal').remove()">Got it</button>
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

function generatePaymentInstructions(details, method) {
    switch (method) {
        case 'bitcoin':
        case 'ethereum':
        case 'usdt':
            return `
                <div class="crypto-instructions">
                    <p><strong>Send ${method.toUpperCase()} to:</strong></p>
                    <div class="address-box">
                        <code>${details.address}</code>
                        <button onclick="navigator.clipboard.writeText('${details.address}')">Copy</button>
                    </div>
                    <p><strong>Network:</strong> ${details.network}</p>
                    <p><strong>Required Confirmations:</strong> ${details.confirmations}</p>
                    <div class="warning">
                        ⚠️ Only send ${method.toUpperCase()} to this address. Sending other cryptocurrencies will result in permanent loss.
                    </div>
                </div>
            `;
        case 'bank_transfer':
            return `
                <div class="bank-instructions">
                    <p><strong>Bank Transfer Details:</strong></p>
                    <table class="payment-table">
                        <tr><td>Account Name:</td><td>${details.accountName}</td></tr>
                        <tr><td>Account Number:</td><td>${details.accountNumber}</td></tr>
                        <tr><td>Routing Number:</td><td>${details.routingNumber}</td></tr>
                        <tr><td>Bank Name:</td><td>${details.bankName}</td></tr>
                        <tr><td>Reference:</td><td>${details.reference}</td></tr>
                    </table>
                    <div class="warning">
                        ⚠️ Please include the reference number in your transfer description.
                    </div>
                </div>
            `;
        default:
            return '<p>Payment method not supported</p>';
    }
}

function displayWithdrawalConfirmation(transaction) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Withdrawal Confirmation</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="confirmation-details">
                    <p><strong>Withdrawal Amount:</strong> ${utils.formatCurrency(transaction.amount)}</p>
                    <p><strong>Processing Fee:</strong> ${utils.formatCurrency(transaction.fee)}</p>
                    <p><strong>Net Amount:</strong> ${utils.formatCurrency(transaction.totalAmount)}</p>
                    <p><strong>Payment Method:</strong> ${transaction.paymentMethod}</p>
                    <p><strong>Status:</strong> Pending</p>
                    <div class="info">
                        ℹ️ Your withdrawal will be processed within 1-3 business days. You will receive an email confirmation once completed.
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="this.closest('.payment-modal').remove()">OK</button>
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

async function loadTransactionHistory() {
    try {
        const response = await api.getTransactions({ limit: 10 });
        displayTransactionHistory(response.transactions);
        updateTransactionSummary(response.summary);
    } catch (error) {
        console.error('Failed to load transaction history:', error);
    }
}

function displayTransactionHistory(transactions) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="no-data">No transactions found</p>';
        return;
    }
    
    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item" data-id="${transaction.id}">
            <div class="transaction-info">
                <div class="transaction-type ${transaction.type}">${transaction.type.toUpperCase()}</div>
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-date">${utils.formatDateTime(transaction.created_at)}</div>
            </div>
            <div class="transaction-amount">
                <span class="amount ${transaction.type === 'withdrawal' ? 'negative' : 'positive'}">
                    ${transaction.type === 'withdrawal' ? '-' : '+'}${utils.formatCurrency(transaction.amount)}
                </span>
                <span class="status status-${transaction.status}">${transaction.status}</span>
            </div>
        </div>
    `).join('');
}

function updateTransactionSummary(summary) {
    const elements = {
        totalDeposits: document.getElementById('totalDeposits'),
        totalWithdrawals: document.getElementById('totalWithdrawals'),
        pendingTransactions: document.getElementById('pendingTransactions')
    };
    
    if (elements.totalDeposits) {
        elements.totalDeposits.textContent = utils.formatCurrency(summary.totalDeposits || 0);
    }
    if (elements.totalWithdrawals) {
        elements.totalWithdrawals.textContent = utils.formatCurrency(summary.totalWithdrawals || 0);
    }
    if (elements.pendingTransactions) {
        elements.pendingTransactions.textContent = summary.pendingTransactions || 0;
    }
}

// Add modal styles
const modalCSS = `
    .payment-modal {
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
    
    .modal-content {
        background: white;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .modal-header {
        padding: 20px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .modal-footer {
        padding: 20px;
        border-top: 1px solid #dee2e6;
        text-align: right;
    }
    
    .address-box {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 10px 0;
    }
    
    .payment-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .payment-table td {
        padding: 8px;
        border-bottom: 1px solid #dee2e6;
    }
    
    .warning, .info {
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
    }
    
    .warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
    }
    
    .info {
        background: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
    }
`;

const style = document.createElement('style');
style.textContent = modalCSS;
document.head.appendChild(style);
