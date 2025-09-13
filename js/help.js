function showCategory(categoryId) {
    // Hide all categories
    const categories = document.querySelectorAll('.article-category');
    categories.forEach(cat => cat.style.display = 'none');
    
    // Show selected category
    document.getElementById(categoryId).style.display = 'block';
    
    // Update active state
    const cards = document.querySelectorAll('.category-card');
    cards.forEach(card => card.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// Search functionality
document.getElementById('helpSearch').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const articles = document.querySelectorAll('.article-item');
    
    articles.forEach(article => {
        const title = article.querySelector('h3').textContent.toLowerCase();
        const content = article.querySelector('p').textContent.toLowerCase();
        
        if (title.includes(searchTerm) || content.includes(searchTerm)) {
            article.style.display = 'block';
        } else {
            article.style.display = searchTerm ? 'none' : 'block';
        }
    });
});
