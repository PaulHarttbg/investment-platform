// NOTE: The placeholder `viewDeposit` function was removed from this file.
// The correct, data-driven implementation now resides in `admin.js`.

// Approve deposit
async function approveDeposit(depositId, button) {
    if (!confirm('Are you sure you want to approve this deposit?')) return;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch(`/api/admin/transactions/${depositId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'completed' })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to approve deposit');
        }

        utils.showNotification('Deposit approved successfully!', 'success');
        // Reload admin data to refresh all relevant sections (dashboard and tables)
        if (typeof loadAdminData === 'function') {
            loadAdminData();
        }

    } catch (error) {
        utils.showNotification(error.message, 'error');
        button.disabled = false;
        button.innerHTML = 'Approve';
    }
}

// Reject deposit
async function rejectDeposit(depositId, button) {
    if (!confirm('Are you sure you want to reject this deposit?')) return;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch(`/api/admin/transactions/${depositId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'failed' })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to reject deposit');
        }

        utils.showNotification('Deposit rejected successfully!', 'success');
        // Reload admin data to refresh all relevant sections
        if (typeof loadAdminData === 'function') {
            loadAdminData();
        }

    } catch (error) {
        utils.showNotification(error.message, 'error');
        button.disabled = false;
        button.innerHTML = 'Reject';
    }
}
