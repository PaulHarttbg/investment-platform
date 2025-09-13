document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', handleLogin);
    }
});

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const form = document.getElementById('loginForm');
    const loginId = form.login.value;
    const password = form.password.value;

    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('#loginBtnText');
    const spinner = submitBtn.querySelector('#loginSpinner');

    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    submitBtn.disabled = true;

    try {
        const result = await window.api.login({ loginId, password });

        // Save session and token
        sessionStorage.setItem('user', JSON.stringify(result.user));

        utils.showNotification('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = result.redirect || '/dashboard.html';
        }, 1000);
        
    } catch (error) {
        utils.showNotification(error.message || 'Login failed. Please check your credentials.', 'error');
        
        btnText.style.display = 'inline-block';
        spinner.style.display = 'none';
        submitBtn.disabled = false;
    }
    
    return false;
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = event.currentTarget.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}