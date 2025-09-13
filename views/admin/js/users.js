// User Management Functions
document.addEventListener('DOMContentLoaded', function() {
    UsersManager.init();
});

const UsersManager = {
    page: 1,
    limit: 15,
    totalPages: 1,

    init() {
        this.loadUsers();
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('userSearch')?.addEventListener('input', this.debounce(() => this.loadUsers(1), 500));
        document.getElementById('refreshUsers')?.addEventListener('click', () => this.loadUsers());
        document.getElementById('usersPrevPage')?.addEventListener('click', () => this.changePage(-1));
        document.getElementById('usersNextPage')?.addEventListener('click', () => this.changePage(1));
    },

    async loadUsers(page = this.page) {
        this.page = page;
        const tbody = document.getElementById('usersTable');
        const search = document.getElementById('userSearch')?.value || '';

        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading users...</td></tr>';

        try {
            const params = new URLSearchParams({
                page: this.page,
                limit: this.limit,
                search: search
            });

            const response = await fetch(`/api/admin/users?${params}`, {
                // No headers needed, HttpOnly cookie is sent automatically
            });

            if (!response.ok) throw new Error('Failed to load users');

            const data = await response.json();
            this.totalPages = data.totalPages;
            this.renderUsers(data.users);
            this.updatePagination(data.total);

        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state text-danger">Error loading users.</td></tr>';
        }
    },

    renderUsers(users) {
        const tbody = document.getElementById('usersTable');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.login_id}</td>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.email}</td>
                <td>${formatCurrency(user.account_balance)}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td><span class="status status-${user.account_status.toLowerCase()}">${user.account_status}</span></td>
                <td>
                    <button class="btn btn-small btn-secondary" data-action="viewUser" data-user-id="${user.id}"><i class="fas fa-eye"></i> View</button>
                    <button class="btn btn-small btn-warning" data-action="suspendUser" data-user-id="${user.id}" data-status="${user.account_status}">
                        <i class="fas fa-${user.account_status === 'active' ? 'ban' : 'check'}"></i> ${user.account_status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                    <button class="btn btn-small btn-danger" data-action="deleteUser" data-user-id="${user.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    },

    updatePagination(total) {
        const pageInfo = document.getElementById('usersPageInfo');
        const prevBtn = document.getElementById('usersPrevPage');
        const nextBtn = document.getElementById('usersNextPage');

        if (pageInfo) pageInfo.textContent = `Page ${this.page} of ${this.totalPages}`;
        if (prevBtn) prevBtn.disabled = this.page <= 1;
        if (nextBtn) nextBtn.disabled = this.page >= this.totalPages;
    },

    changePage(direction) {
        const newPage = this.page + direction;
        if (newPage > 0 && newPage <= this.totalPages) {
            this.loadUsers(newPage);
        }
    },

    async suspendUser(userId, currentStatus) {
        const action = currentStatus === 'active' ? 'suspend' : 'reactivate';
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accountStatus: newStatus })
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `Failed to ${action} user.`);
            }

            utils.showNotification(`User ${action}d successfully!`, 'success');
            this.loadUsers(); // Refresh the user list

        } catch (error) {
            utils.showNotification(error.message, 'error');
        }
    },

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This will set their status to "deleted" and is not easily reversible.')) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `Failed to delete user.`);
            }

            utils.showNotification(`User deleted successfully!`, 'success');
            this.loadUsers(); // Refresh the user list

        } catch (error) {
            utils.showNotification(error.message, 'error');
        }
    },

    viewUser(userId) {
        // This can be expanded to show a modal with full user details
        utils.showNotification(`Viewing details for user ${userId.substring(0, 8)}...`, 'info');
    },

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
};
