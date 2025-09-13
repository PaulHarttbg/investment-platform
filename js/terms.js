document.addEventListener('DOMContentLoaded', function() {
    initializeSmoothScrolling();
});

function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('.terms-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}
