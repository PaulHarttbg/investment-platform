// Toggle password visibility
function togglePasswordVisibility(button) {
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// Password strength requirements
const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true,
    specialChars: '!@#$%^&*',
};

// Check password strength
function checkPasswordStrength(password) {
    const errors = [];
    
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    }
    
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('At least one uppercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('At least one lowercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
        errors.push('At least one number');
    }
    
    if (PASSWORD_REQUIREMENTS.requireSpecialChar && 
        !new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars}]`).test(password)) {
        errors.push(`At least one special character (${PASSWORD_REQUIREMENTS.specialChars})`);
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Update password strength UI
function updatePasswordStrength(password) {
    const strengthMeter = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const requirementsList = document.getElementById('passwordRequirements');
    
    if (!password) {
        strengthMeter.style.display = 'none';
        requirementsList.style.display = 'none';
        return false;
    }
    
    const { isValid, errors } = checkPasswordStrength(password);
    const strength = isValid ? 100 : Math.max(0, 100 - (errors.length * 20));
    
    // Update strength meter
    strengthMeter.style.display = 'block';
    strengthMeter.value = strength;
    
    // Update strength text and color
    let strengthLabel, strengthClass;
    if (strength >= 80) {
        strengthLabel = 'Strong';
        strengthClass = 'strength-strong';
    } else if (strength >= 50) {
        strengthLabel = 'Moderate';
        strengthClass = 'strength-moderate';
    } else {
        strengthLabel = 'Weak';
        strengthClass = 'strength-weak';
    }
    
    strengthText.textContent = `Strength: ${strengthLabel}`;
    strengthText.className = strengthClass;
    
    // Update requirements list
    if (requirementsList) {
        requirementsList.style.display = 'block';
        requirementsList.innerHTML = `
            <li class="${password.length >= PASSWORD_REQUIREMENTS.minLength ? 'valid' : 'invalid'}">
                At least ${PASSWORD_REQUIREMENTS.minLength} characters
            </li>
            <li class="${PASSWORD_REQUIREMENTS.requireUppercase && /[A-Z]/.test(password) ? 'valid' : 'invalid'}">
                At least one uppercase letter
            </li>
            <li class="${PASSWORD_REQUIREMENTS.requireLowercase && /[a-z]/.test(password) ? 'valid' : 'invalid'}">
                At least one lowercase letter
            </li>
            <li class="${PASSWORD_REQUIREMENTS.requireNumber && /[0-9]/.test(password) ? 'valid' : 'invalid'}">
                At least one number
            </li>
            <li class="${PASSWORD_REQUIREMENTS.requireSpecialChar && new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars}]`).test(password) ? 'valid' : 'invalid'}">
                At least one special character (${PASSWORD_REQUIREMENTS.specialChars})
            </li>
        `;
    }
    
    return isValid;
}

// Show error message
function showError(message) {
    // Use the global notification utility
    if (window.utils && typeof window.utils.showNotification === 'function') {
        window.utils.showNotification(message, 'error');
    } else {
        alert(message); // Fallback
    }
}

// Show success message
function showSuccess(message) {
    if (window.utils && typeof window.utils.showNotification === 'function') {
        window.utils.showNotification(message, 'success');
    } else {
        alert(message); // Fallback
    }
}

// Handle registration form submission
async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Trim all string inputs
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
            data[key] = data[key].trim();
        }
    });
    
    // Client-side validation
    if (data.password !== data.confirmPassword) {
        return showError('Passwords do not match');
    }
    
    const passwordCheck = checkPasswordStrength(data.password);
    if (!passwordCheck.isValid) {
        return showError(`Password is too weak. It must contain ${passwordCheck.errors[0]}.`);
    }
    
    if (!document.getElementById('agreeTerms').checked) {
        document.getElementById('termsError').style.display = 'block';
        return showError('You must agree to the terms and conditions');
    } else {
        document.getElementById('termsError').style.display = 'none';
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    
    try {
        const result = await window.api.register({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email.toLowerCase(),
            password: data.password,
            registrationToken: data.registrationToken
        });
        
        // Registration successful
        showSuccess('Registration successful! Redirecting to dashboard...');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
        
    } catch (error) {
        showError(error.message || 'An error occurred during registration. Please try again.');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Check if passwords match
function checkPasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('passwordMatchError');
    
    if (confirmPassword === '') {
        errorElement.style.display = 'none';
        return true;
    }
    
    if (password !== confirmPassword) {
        errorElement.style.display = 'block';
        return false;
    } else {
        errorElement.style.display = 'none';
        return true;
    }
}

// Initialize form
document.addEventListener('DOMContentLoaded', function() {
    // Initialize form validation
    const form = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const termsCheckbox = document.getElementById('agreeTerms');
    
    if (form) {
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                updatePasswordStrength(e.target.value);
            });
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        }
        
        form.addEventListener('submit', handleRegister);
        
        if (termsCheckbox) {
            termsCheckbox.addEventListener('change', function() {
                const termsError = document.getElementById('termsError');
                if (this.checked) {
                    termsError.style.display = 'none';
                } else if (document.activeElement === this) {
                    // Only show error if the user is interacting with the checkbox
                    termsError.style.display = 'block';
                }
            });
        }
    }

    // Password toggle
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', function() {
            togglePasswordVisibility(this);
        });
    });
});