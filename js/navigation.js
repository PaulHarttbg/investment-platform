// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const body = document.body;

    if (hamburger && navMenu) {
        // Toggle menu on hamburger click
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            const isActive = hamburger.classList.toggle('active');
            navMenu.classList.toggle('active', isActive);
            
            // Toggle body scroll
            body.style.overflow = isActive ? 'hidden' : '';
        });

        // Close menu when clicking on a nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                body.style.overflow = '';
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                body.style.overflow = '';
            }
        });

        // Prevent clicks inside the menu from closing it
        navMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Handle window resize
    function handleResize() {
        if (window.innerWidth > 992) {
            // Reset menu state on desktop
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
            body.style.overflow = '';
        }
    }

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Initial check
    handleResize();
});
