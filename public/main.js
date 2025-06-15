document.addEventListener('DOMContentLoaded', () => {
    // Mode switching
    const modePills = document.querySelectorAll('.mode-pill');
    const letterboxdMode = document.getElementById('letterboxd-mode');
    const customMode = document.getElementById('custom-mode');
    
    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        modePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        
        if (pill.dataset.mode === 'letterboxd') {
          letterboxdMode.style.display = 'block';
          customMode.style.display = 'none';
        } else {
          letterboxdMode.style.display = 'none';
          customMode.style.display = 'block';
        }
      });
    });

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
      });
    });

    // Interactive star rating system
    const interactiveStars = document.getElementById('interactive-stars');
    const ratingDisplay = document.getElementById('rating-display');
    const hiddenRatingInput = document.getElementById('custom-rating');
    const stars = interactiveStars.querySelectorAll('.star');
    
    let currentRating = 0;
    let isHovering = false;

    function updateStarDisplay(rating, isHover = false) {
      stars.forEach((star, index) => {
        const starValue = index + 1;
        star.classList.remove('filled', 'half');
        
        if (rating >= starValue) {
          star.classList.add('filled');
        } else if (rating >= starValue - 0.5) {
          star.classList.add('half');
        }
      });
      
      if (isHover) {
        ratingDisplay.textContent = `${rating}/5`;
      } else {
        ratingDisplay.textContent = currentRating > 0 ? `${currentRating}/5` : '0/5';
      }
    }

    // Handle star clicks
    stars.forEach((star, index) => {
      star.addEventListener('click', (e) => {
        const rect = star.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const starWidth = rect.width;
        
        // Determine if click is on left half (half star) or right half (full star)
        const isHalfClick = clickX < starWidth / 2;
        const newRating = index + (isHalfClick ? 0.5 : 1);
        
        // Toggle behavior: if clicking the same rating, set to 0
        if (currentRating === newRating) {
          currentRating = 0;
        } else {
          currentRating = newRating;
        }
        
        hiddenRatingInput.value = currentRating * 2; // Convert to 10-point scale for backend
        updateStarDisplay(currentRating);
      });

      // Handle hover effects
      star.addEventListener('mouseenter', (e) => {
        isHovering = true;
        const rect = star.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const starWidth = rect.width;
        
        const isHalfHover = mouseX < starWidth / 2;
        const hoverRating = index + (isHalfHover ? 0.5 : 1);
        
        updateStarDisplay(hoverRating, true);
      });

      star.addEventListener('mousemove', (e) => {
        if (!isHovering) return;
        
        const rect = star.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const starWidth = rect.width;
        
        const isHalfHover = mouseX < starWidth / 2;
        const hoverRating = index + (isHalfHover ? 0.5 : 1);
        
        updateStarDisplay(hoverRating, true);
      });
    });

    // Handle mouse leave
    interactiveStars.addEventListener('mouseleave', () => {
      isHovering = false;
      updateStarDisplay(currentRating);
    });

    // Initialize display
    updateStarDisplay(0);

    // Search functionality
    const searchButton = document.getElementById('search-button');
    const customTitle = document.getElementById('custom-title');
    const searchResults = document.getElementById('search-results');
    const customFields = document.getElementById('custom-fields');
    
    searchButton.addEventListener('click', async () => {
      const query = customTitle.value.trim();
      if (!query) return;
      
      searchResults.innerHTML = '<div style="padding: 1rem; text-align: center;">Searching...</div>';
      searchResults.style.display = 'block';
      
      try {
        const response = await fetch('/search-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        displaySearchResults(data.results);
      } catch (error) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: #ff3b30;">Search failed. Please try again.</div>';
      }
    });
    
    function displaySearchResults(results) {
      if (!results || results.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: #8e8e93;">No results found</div>';
        return;
      }
      
      searchResults.innerHTML = results.map(item => `
        <div class="search-result-item" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
          ${item.poster_path 
            ? `<img class="search-result-poster" src="https://image.tmdb.org/t/p/w92${item.poster_path}" alt="${item.title || item.name}">`
            : '<div class="search-result-poster">No Image</div>'
          }
          <div class="search-result-info">
            <div class="search-result-title">
              ${item.title || item.name}
              <span class="search-result-year">${item.release_date || item.first_air_date ? `(${(item.release_date || item.first_air_date).substring(0, 4)})` : ''}</span>
              <span class="search-result-type ${item.media_type === 'tv' ? 'tv' : ''}">${item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
            </div>
            <div class="search-result-cast">${item.overview ? item.overview.substring(0, 100) + '...' : ''}</div>
          </div>
        </div>
      `).join('');
      
      // Add click handlers to search results
      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          const type = item.dataset.type;
          selectSearchResult(id, type);
        });
      });
    }

    // Add the missing selectSearchResult function
    function selectSearchResult(id, type) {
      // Hide search results
      searchResults.style.display = 'none';
      
      // Show custom fields
      customFields.style.display = 'block';
      
      // Store the selected media info
      const selectedMedia = {
        id: id,
        type: type
      };
      
      // Store in a data attribute or global variable for form submission
      customFields.dataset.selectedId = id;
      customFields.dataset.selectedType = type;
      
      console.log('Selected:', selectedMedia);
    }

    // Live update slider labels
    const sliderIds = [
      'poster-top', 'title-below-poster', 'line-height',
      'between-sections', 'backdrop-brightness', 'poster-scale', 'footer-scale'
    ];

    sliderIds.forEach(id => {
      const input = document.getElementById(id);
      const display = document.getElementById(`${id}-value`);
      input.addEventListener('input', () => {
        display.textContent = parseFloat(input.value);
      });
    });

    // Sortable list - exclude non-reorderable items
    Sortable.create(document.getElementById('reorder-list'), {
      animation: 150,
      handle: '.drag-handle:not(.disabled)',
      ghostClass: 'sortable-ghost',
      touchStartThreshold: 10,
      filter: '.non-reorderable',
      onMove: function(evt) {
        return !evt.related.classList.contains('non-reorderable');
      }
    });

    const overlay = document.getElementById('loading-overlay');
    const result = document.getElementById('result');
    const generatedImage = document.getElementById('generated-image');
    const copyButton = document.getElementById('copy-image');
    const downloadButton = document.getElementById('download-image');
    const posterOptions = document.getElementById('poster-options');
    const backgroundOptions = document.getElementById('background-options');

    let currentSessionId = null;
    let currentSettings = null;

    // Function to create option items
    function createOptionItem(src, type, index, isActive = false) {
      const item = document.createElement('div');
      item.className = `option-item ${isActive ? 'active' : ''}`;
      item.dataset.type = type;
      item.dataset.index = index;
      
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${type} option ${index + 1}`;
        img.onerror = () => {
          item.innerHTML = 'No Image';
          item.classList.add('no-image');
        };
        item.appendChild(img);
      } else {
        item.innerHTML = 'No Image';
        item.classList.add('no-image');
      }
      
      item.addEventListener('click', () => regenerateWithOption(type, index));
      return item;
    }

    // Function to populate menu options
    function populateMenuOptions(movieData) {
      // Clear existing options
      posterOptions.innerHTML = '';
      backgroundOptions.innerHTML = '';
      
      // Add poster options (main poster + alternatives)
      const posters = [movieData.mainPoster, ...(movieData.alternativePosters || [])];
      posters.forEach((poster, index) => {
        const item = createOptionItem(poster, 'poster', index, index === 0);
        posterOptions.appendChild(item);
      });
      
      // Add background options (main backdrop + alternatives)
      const backgrounds = [movieData.mainBackdrop, ...(movieData.alternativeBackdrops || [])];
      backgrounds.forEach((background, index) => {
        const item = createOptionItem(background, 'background', index, index === 0);
        backgroundOptions.appendChild(item);
      });
    }

    // Function to regenerate image with selected option
    async function regenerateWithOption(type, index) {
      if (!currentSessionId || !currentSettings) return;
      
      overlay.classList.add('show');
      
      try {
        const requestData = {
          sessionId: currentSessionId,
          selectedPosterIndex: type === 'poster' ? index : 0,
          selectedBackgroundIndex: type === 'background' ? index : 0,
          settings: currentSettings
        };
        
        const res = await fetch('/regenerate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to regenerate image');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        generatedImage.src = url;
        
        // Update active states
        document.querySelectorAll('.option-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll(`[data-type="${type}"][data-index="${index}"]`).forEach(item => {
          item.classList.add('active');
        });
        
        overlay.classList.remove('show');
        
        // Update button handlers
        copyButton.onclick = async () => {
          await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': blob })]);
          alert('Image copied to clipboard!');
        };

        downloadButton.onclick = () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = 'letterboxd-poster.jpg';
          a.click();
        };
        
      } catch (err) {
        alert('Error: ' + err.message);
        overlay.classList.remove('show');
      }
    }

    document.getElementById('image-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      overlay.classList.add('show');
      result.style.display = 'none';
      
      try {
        const currentMode = document.querySelector('.mode-pill.active').dataset.mode;
        let formData;
        
        if (currentMode === 'letterboxd') {
          const letterboxdUrl = document.getElementById('letterboxd-url').value;
          if (!letterboxdUrl.trim()) {
            alert('Please enter Letterboxd share text');
            return;
          }
          
          formData = new FormData();
          formData.append('letterboxdUrl', letterboxdUrl);
        } else {
          // Custom mode
          const selectedId = customFields.dataset.selectedId;
          const selectedType = customFields.dataset.selectedType;
          
          if (!selectedId) {
            alert('Please search and select a movie or TV series first');
            return;
          }
          
          formData = new FormData();
          formData.append('customMode', 'true');
          formData.append('mediaId', selectedId);
          formData.append('mediaType', selectedType);
          
          // Add custom fields
          const customRating = document.getElementById('custom-rating').value;
          const customUsername = document.getElementById('custom-username').value;
          const customWatchedDate = document.getElementById('custom-watched-date').value;
          const customIsLiked = document.getElementById('custom-liked').checked;
          const customTags = document.getElementById('custom-tags').value;
          
          if (customRating) formData.append('rating', customRating);
          if (customUsername) formData.append('username', customUsername);
          if (customWatchedDate) formData.append('watchedDate', customWatchedDate);
          if (customIsLiked) formData.append('isLiked', 'true');
          if (customTags) formData.append('tags', customTags);
        }
        
        // Add settings
        const settingsData = {};
        document.querySelectorAll('#settings-panel input').forEach(input => {
          if (input.type === 'checkbox') {
            settingsData[input.id] = input.checked;
          } else {
            settingsData[input.id] = input.value;
          }
        });
        
        formData.append('settings', JSON.stringify(settingsData));
        
        const response = await fetch('/generate-image', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          generatedImage.src = data.imageUrl;
          result.style.display = 'block';
          currentSessionId = data.sessionId;
          currentSettings = settingsData;
          
          if (data.movieData) {
            populateMenuOptions(data.movieData);
          }
        } else {
          alert('Error: ' + data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while generating the image.');
      } finally {
        overlay.classList.remove('show');
      }
    });
  });