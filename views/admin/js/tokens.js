// Token Management Functions
document.addEventListener('DOMContentLoaded', function() {
    // Load existing tokens
    loadTokens();
    
    // Token generation modal
    const generateTokenBtn = document.getElementById('generateTokenBtn');
    const tokenModal = document.getElementById('tokenModal');
    const cancelTokenModalBtn = document.getElementById('cancelTokenModalBtn');
    const createTokenBtn = document.getElementById('createTokenBtn');
    const tokenForm = document.getElementById('tokenForm');

    // Open token generation modal
    if (generateTokenBtn) {
        generateTokenBtn.addEventListener('click', function() {
            if (tokenModal) {
                tokenModal.style.display = 'flex';
            }
        });
    }

    // Close token generation modal
    if (cancelTokenModalBtn) {
        cancelTokenModalBtn.addEventListener('click', closeTokenModal);
    }

    // Handle form submission for new token
    if (tokenForm) {
        tokenForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const usageLimit = document.getElementById('tokenLimit')?.value || '1';
            const expiresInDays = document.getElementById('tokenExpiry')?.value || '';
            const notes = document.getElementById('tokenNotes')?.value || '';
            
            try {
                const response = await fetch('/api/tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usageLimit: parseInt(usageLimit),
                        expiresInDays: expiresInDays ? parseInt(expiresInDays) : null,
                        notes: notes
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Add the new token to the UI
                    addTokenToUI(result.data);
                    closeTokenModal();
                    utils.showNotification('Token generated successfully!', 'success');
                } else {
                    throw new Error(result.message || 'Failed to generate token');
                }
            } catch (error) {
                utils.showNotification(error.message || 'Failed to generate token', 'error');
            }
        });
    }
});

// Load tokens from the server
async function loadTokens() {
    try {
        const response = await fetch('/api/tokens', {
            // The HttpOnly cookie is sent automatically
            headers: {}
        });
        const result = await response.json();
        
        if (response.ok) {
            const tokensGrid = document.getElementById('tokensGrid');
            if (tokensGrid) {
                // Clear existing tokens
                tokensGrid.innerHTML = '';
                
                // Add each token to the UI
                result.data.forEach(token => {
                    addTokenToUI(token);
                });
                
                if (result.data.length === 0) {
                    tokensGrid.innerHTML = '<div class="no-tokens">No tokens found. Generate your first token above.</div>';
                }
            }
        } else {
            throw new Error(result.message || 'Failed to load tokens');
        }
    } catch (error) {
        utils.showNotification('Failed to load tokens', 'error');
    }
}

// Close token modal and reset form
window.closeTokenModal = function() {
    const tokenModal = document.getElementById('tokenModal');
    const tokenForm = document.getElementById('tokenForm');
    
    if (tokenModal) tokenModal.style.display = 'none';
    if (tokenForm) tokenForm.reset();
};

// Copy token to clipboard
window.copyToken = function(token) {
    navigator.clipboard.writeText(token)
        .then(() => {
            utils.showNotification('Token copied to clipboard!', 'success');
        })
        .catch(err => {
            utils.showNotification('Failed to copy token to clipboard', 'error');
        });
};

// Delete token
window.deleteToken = async function(token) {
    if (!confirm(`Are you sure you want to delete token: ${token}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tokens/${encodeURIComponent(token)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Remove token from UI
            const tokenElement = document.querySelector(`[data-token="${token}"]`);
            if (tokenElement) {
                tokenElement.remove(); 
                utils.showNotification('Token deleted successfully', 'success');
                
                // If no tokens left, show message
                const tokensGrid = document.getElementById('tokensGrid');
                if (tokensGrid && tokensGrid.children.length === 0) {
                    tokensGrid.innerHTML = '<div class="no-tokens">No tokens found. Generate your first token above.</div>';
                }
            }
        } else {
            throw new Error(result.message || 'Failed to delete token');
        }
    } catch (error) {
        utils.showNotification(error.message || 'Failed to delete token', 'error');
    }
};

// Helper function to add token to UI
function addTokenToUI(tokenData) {
    const tokensGrid = document.getElementById('tokensGrid');
    if (!tokensGrid) return;
    
    // Remove the "no tokens" message if it exists
    const noTokensMsg = tokensGrid.querySelector('.no-tokens');
    if (noTokensMsg) {
        tokensGrid.removeChild(noTokensMsg);
    }

    const tokenCard = document.createElement('div');
    tokenCard.className = 'token-card' + (tokenData.is_active ? '' : ' inactive');
    tokenCard.dataset.token = tokenData.token;
    
    // Format created date
    const createdDate = new Date(tokenData.created_at);
    const formattedDate = createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Format expiration date if it exists
    let expiryText = 'Never';
    if (tokenData.expires_at) {
        const expiryDate = new Date(tokenData.expires_at);
        expiryText = expiryDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    tokenCard.innerHTML = `
        <div class="token-header">
            <div class="token-code">${tokenData.token}</div>
            <div class="token-status">
                ${tokenData.is_active ? 
                    '<span class="status-badge active">Active</span>' : 
                    '<span class="status-badge inactive">Inactive</span>'}
            </div>
        </div>
        <div class="token-info">
            <div class="token-usage">
                <i class="fas fa-hashtag"></i>
                <span>Used: ${tokenData.usage_count}/${tokenData.usage_limit}</span>
            </div>
            <div class="token-expiry">
                <i class="far fa-clock"></i>
                <span>Expires: ${expiryText}</span>
            </div>
            <div class="token-created">
                <i class="far fa-calendar"></i>
                <span>Created: ${formattedDate}</span>
            </div>
            ${tokenData.notes ? `
            <div class="token-notes">
                <i class="far fa-sticky-note"></i>
                <span>${tokenData.notes}</span>
            </div>` : ''}
        </div>
        <div class="token-actions">
            <button class="btn btn-small btn-secondary" onclick="copyToken('${tokenData.token}')" 
                title="Copy to clipboard">
                <i class="fas fa-copy"></i>
            </button>
            ${tokenData.is_active ? `
            <button class="btn btn-small btn-danger" onclick="deleteToken('${tokenData.token}')"
                title="Delete token">
                <i class="fas fa-trash"></i>
            </button>` : ''}
        </div>
    `;

    tokensGrid.prepend(tokenCard);
}
