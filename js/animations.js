// WINNING EDGE - Animation Controller
// Handles page load animations and interactive effects

class AnimationController {
    constructor() {
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupPageLoadAnimations();
        this.setupInteractiveAnimations();
        this.setupLoadingAnimations();
    }

    // Intersection Observer for scroll-triggered animations
    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    
                    // Add animation class based on data attribute or default
                    const animationType = element.dataset.animation || 'animate-fade-in';
                    element.classList.add(animationType);
                    
                    // Add stagger delay for multiple elements
                    const delay = element.dataset.delay || 0;
                    if (delay > 0) {
                        element.style.animationDelay = `${delay}ms`;
                    }
                    
                    observer.unobserve(element);
                }
            });
        }, observerOptions);

        // Observe elements with animation data attributes
        document.querySelectorAll('[data-animation]').forEach(el => {
            observer.observe(el);
        });

        // Auto-observe common elements
        const autoAnimateSelectors = [
            '.feature-card',
            '.package-card',
            '.stat-card',
            '.investment-card',
            '.transaction-item',
            '.section-header',
            '.hero-content',
            '.form-container'
        ];

        autoAnimateSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach((el, index) => {
                if (!el.dataset.animation) {
                    el.dataset.animation = 'animate-slide-in-up';
                    el.dataset.delay = index * 100; // Stagger effect
                }
                observer.observe(el);
            });
        });
    }

    // Page load animations
    setupPageLoadAnimations() {
        window.addEventListener('load', () => {
            // Animate hero section
            const heroContent = document.querySelector('.hero-content');
            if (heroContent) {
                heroContent.classList.add('animate-slide-in-left');
            }

            const heroImage = document.querySelector('.hero-image');
            if (heroImage) {
                setTimeout(() => {
                    heroImage.classList.add('animate-slide-in-right');
                }, 200);
            }

            // Animate navigation
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.style.transform = 'translateY(-100%)';
                setTimeout(() => {
                    navbar.style.transition = 'transform 0.6s ease-out';
                    navbar.style.transform = 'translateY(0)';
                }, 100);
            }

            // Animate page content
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.classList.add('animate-fade-in');
            }
        });
    }

    // Interactive animations
    setupInteractiveAnimations() {
        // Button click animations
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn, .cta-button, input[type="submit"]');
            if (button) {
                button.classList.add('animate-bounce');
                setTimeout(() => {
                    button.classList.remove('animate-bounce');
                }, 1000);
            }
        });

        // Form focus animations
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, select, textarea')) {
                const formGroup = e.target.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.add('animate-pulse');
                    setTimeout(() => {
                        formGroup.classList.remove('animate-pulse');
                    }, 600);
                }
            }
        });

        // Card hover effects
        document.querySelectorAll('.feature-card, .package-card, .stat-card, .investment-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px) scale(1.02)';
                card.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });

        // Navigation link animations
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('mouseenter', () => {
                link.style.transform = 'translateY(-2px)';
                link.style.color = 'var(--secondary-color)';
            });

            link.addEventListener('mouseleave', () => {
                link.style.transform = 'translateY(0)';
                link.style.color = '';
            });
        });
    }

    // Loading animations
    setupLoadingAnimations() {
        // Show loading spinner on form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
            
            if (submitButton) {
                const originalText = submitButton.textContent || submitButton.value;
                submitButton.disabled = true;
                submitButton.innerHTML = '<span class="loading-spinner"></span> Processing...';
                
                // Add loading spinner styles if not exists
                if (!document.querySelector('.loading-spinner-styles')) {
                    const style = document.createElement('style');
                    style.className = 'loading-spinner-styles';
                    style.textContent = `
                        .loading-spinner {
                            display: inline-block;
                            width: 16px;
                            height: 16px;
                            border: 2px solid rgba(255,255,255,0.3);
                            border-radius: 50%;
                            border-top-color: #fff;
                            animation: spin 1s ease-in-out infinite;
                        }
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
        });

        // Animate success/error messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.classList && (node.classList.contains('alert') || 
                            node.classList.contains('notification') ||
                            node.classList.contains('message'))) {
                            node.classList.add('animate-slide-in-up');
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Utility methods
    static addStaggeredAnimation(elements, animationClass = 'animate-fade-in', delay = 100) {
        elements.forEach((element, index) => {
            setTimeout(() => {
                element.classList.add(animationClass);
            }, index * delay);
        });
    }

    static animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current).toLocaleString();
        }, 16);
    }

    static createRippleEffect(element, event) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;

        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
}

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AnimationController();
});

// Add ripple effect styles
const rippleStyles = document.createElement('style');
rippleStyles.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyles);

// Export for use in other modules
window.AnimationController = AnimationController;
