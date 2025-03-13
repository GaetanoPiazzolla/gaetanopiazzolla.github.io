// Category handler script
document.addEventListener('DOMContentLoaded', function() {
  // Function to open the appropriate category details
  function openCategoryDetails() {
    // Get the meta tags with category information
    const categoryMetas = document.querySelectorAll('meta[property="article:tag"]');
    
    if (categoryMetas.length > 0) {
      // Iterate through each category meta tag
      categoryMetas.forEach(function(meta) {
        const category = meta.getAttribute('content');
        // Convert category to ID format (lowercase, spaces to dashes)
        const categoryId = 'cat-' + category.toLowerCase().replace(/\s+/g, '-');
        
        // Find and open the details element for this category
        const detailsElement = document.getElementById(categoryId);
        if (detailsElement) {
          detailsElement.setAttribute('open', '');
          console.log('Opened category:', category);
        }
      });
    } else {
      // If no meta tags, try to find categories in the post-meta
      const categoryElements = document.querySelectorAll('.post-category');
      
      if (categoryElements.length > 0) {
        categoryElements.forEach(function(element) {
          const category = element.textContent.trim();
          const categoryId = 'cat-' + category.toLowerCase().replace(/\s+/g, '-');
          
          const detailsElement = document.getElementById(categoryId);
          if (detailsElement) {
            detailsElement.setAttribute('open', '');
            console.log('Opened category from post-meta:', category);
          }
        });
      }
    }
  }
  
  // Run when the page is loaded
  openCategoryDetails();
}); 