document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in as admin and redirect
    // This check is now handled by the status endpoint on the dashboard page.
    // If a user navigates here, we let them try to log in.
    const adminUser = sessionStorage.getItem('adminUser');
    if (adminUser) {
        window.location.href = 'index.html';
        return;
    }

    // Handle form submission
    const form = document.getElementById('adminLoginForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';

            const email = form.email.value;
            const password = form.password.value;

            // API call to the backend for authentication
            fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.token) {
                    // Store non-sensitive admin info for UI purposes
                    sessionStorage.setItem('adminUser', JSON.stringify({
                        username: data.user.username,
                        email: data.user.email,
                        role: data.user.role
                    }));
                    utils.showNotification('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = data.redirect || 'index.html';
                    }, 1000);
                } else {
                    throw new Error(data.error || 'Invalid admin credentials');
                }
            })
            .catch(error => {
                utils.showNotification(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
        });
    }
});

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = document.querySelector(`button[onclick="togglePassword('${inputId}')"] i`);
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}
