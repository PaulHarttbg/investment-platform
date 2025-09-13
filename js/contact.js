document.addEventListener('DOMContentLoaded', function() {
    // FAQ functionality
    const faqCategories = document.querySelectorAll('.faq-category');
    const faqContents = document.querySelectorAll('.faq-category-content');
    
    faqCategories.forEach(category => {
        category.addEventListener('click', () => {
            const categoryId = category.getAttribute('data-category');
            
            // Remove active class from all categories
            faqCategories.forEach(cat => cat.classList.remove('active'));
            // Add active class to clicked category
            category.classList.add('active');
            
            // Hide all content
            faqContents.forEach(content => content.classList.remove('active'));
            // Show selected content
            document.getElementById(categoryId).classList.add('active');
        });
    });
    
    // FAQ accordion
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            faqItem.classList.toggle('active');
        });
    });
    
    // Form submission
    document.getElementById('contactForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value,
        };
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                const errorMsg = result.details ? result.details.join(', ') : (result.error || 'Failed to send message.');
                throw new Error(errorMsg);
            }

            alert(result.message); // Or use a nicer notification
            this.reset();

        } catch (error) {
            alert(error.message); // Or use a nicer notification
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
});