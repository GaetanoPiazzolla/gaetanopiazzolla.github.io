// Simple search functionality for Jekyll site
document.addEventListener('DOMContentLoaded', function() {
  var searchData;
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchWrapper = document.getElementById('search-wrapper');

  // Fetch search data (posts)
  fetch('/search.json')
    .then(response => response.json())
    .then(data => {
      searchData = data;
    })
    .catch(error => console.error('Error loading search data:', error));

  // Search function
  function performSearch() {
    if (!searchData) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (query.length < 2) {
      searchResults.innerHTML = '';
      searchWrapper.style.display = 'none';
      return;
    }

    const results = searchData.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(query);
      const contentMatch = item.content.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });

    displayResults(results, query);
  }

  // Display search results
  function displayResults(results, query) {
    searchResults.innerHTML = '';
    searchWrapper.style.display = 'block';
    
    if (results.length === 0) {
      searchResults.innerHTML = '<p>No results found for: ' + query + '</p>';
      return;
    }

    const resultList = document.createElement('ul');
    resultList.className = 'search-results-list';

    results.forEach(result => {
      const listItem = document.createElement('li');
      
      const link = document.createElement('a');
      link.href = result.url;
      link.textContent = result.title;
      
      // Add target="_blank" for external articles
      if (result.external) {
        link.target = "_blank";
      }
      
      const date = document.createElement('span');
      date.className = 'post-meta';
      date.textContent = result.date;
      
      // Add source info for external articles
      if (result.external && result.source) {
        date.textContent += ' • ' + result.source;
      }
      
      listItem.appendChild(date);
      listItem.appendChild(link);
      
      resultList.appendChild(listItem);
    });

    searchResults.appendChild(resultList);
  }

  // Events
  if (searchInput) {
    searchInput.addEventListener('input', performSearch);
    
    // Close search results when clicking outside
    document.addEventListener('click', function(event) {
      if (!searchWrapper.contains(event.target) && event.target !== searchInput) {
        searchWrapper.style.display = 'none';
      }
    });
  }
}); 