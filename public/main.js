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

    // Rating slider
    const ratingSlider = document.getElementById('custom-rating');
    const starsDisplay = document.querySelector('.stars-display');
    
    function updateStarsDisplay(value) {
      const rating = parseFloat(value);
      const full = Math.floor(rating / 2);
      const half = (rating % 2) >= 1;
      const empty = 5 - full - (half ? 1 : 0);
      
      starsDisplay.textContent = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
    }
    
    ratingSlider.addEventListener('input', (e) => {
      updateStarsDisplay(e.target.value);
    });

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
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center;">No results found</div>';
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
              <span class="search-result-type">${item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
            </div>
            <div class="search-result-cast">${item.overview ? item.overview.substring(0, 100) + '...' : ''}</div>
          </div>
        </div>
      `).join('');
      
      // Add click handlers to search results
      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const selectedId = item.dataset.id;
          const selectedType = item.dataset.type;
          
          // Store selected media data
          window.selectedMedia = {
            id: selectedId,
            type: selectedType
          };
          
          // Hide search results and show custom fields
          searchResults.style.display = 'none';
          customFields.style.display = 'block';
        });
      });
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

      // Check which mode is active
      const activeMode = document.querySelector('.mode-pill.active').dataset.mode;
      
      let requestData;
      
      if (activeMode === 'letterboxd') {
        // Extract URL from the share text
        const shareText = document.getElementById('letterboxd-url').value.trim();
        const urlMatch = shareText.match(/(https:\/\/(?:boxd\.it|letterboxd\.com)\/[^\s]+)/);
        if (!urlMatch) {
          alert('Please provide a valid Letterboxd URL.');
          overlay.classList.remove('show');
          return;
        }
        const letterboxdUrl = urlMatch[1];
        
        requestData = {
          mode: 'letterboxd',
          letterboxdUrl: letterboxdUrl
        };
      } else {
        // Custom mode
        if (!window.selectedMedia) {
          alert('Please search and select a movie or TV series first.');
          overlay.classList.remove('show');
          return;
        }
        
        const customRating = parseFloat(document.getElementById('custom-rating').value) / 2; // Convert to 5-star scale
        const customTags = document.getElementById('custom-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const customUsername = document.getElementById('custom-username').value.trim() || 'Anonymous';
        
        // Format watched date if provided
        let watchedDate = null;
        const dateInput = document.getElementById('custom-watched-date').value;
        if (dateInput) {
          const date = new Date(dateInput);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          watchedDate = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
        }
        
        requestData = {
          mode: 'custom',
          mediaId: window.selectedMedia.id,
          mediaType: window.selectedMedia.type,
          rating: customRating,
          tags: customTags,
          username: customUsername,
          watchedDate: watchedDate
        };
      }

      // Gather settings fresh on submit
      const order = Array.from(document.querySelectorAll('#reorder-list li:not(.non-reorderable)')).map(li => li.dataset.id);
      const settings = {
        contentOrder: order,
        showTitle: document.getElementById('show-title').checked,
        showYear: document.getElementById('show-year').checked,
        showGenre: document.getElementById('show-genre').checked,
        showDirector: document.getElementById('show-director').checked,
        showMusic: document.getElementById('show-music').checked,
        showActors: document.getElementById('show-actors').checked,
        showRating: document.getElementById('show-rating').checked,
        showHeart: document.getElementById('show-heart').checked,
        showTags: document.getElementById('show-tags').checked,
        showRuntime: document.getElementById('show-runtime').checked,
        showWatchedDate: document.getElementById('show-watched-date').checked,
        blurBackdrop: document.getElementById('blur-backdrop').checked,
        gradientOverlay: document.getElementById('gradient-toggle').checked,
        backdropBrightness: parseFloat(document.getElementById('backdrop-brightness').value) / 100,
        posterScale: parseFloat(document.getElementById('poster-scale').value),
        footerScale: parseFloat(document.getElementById('footer-scale').value),
        spacing: {
          posterTop: parseInt(document.getElementById('poster-top').value),
          titleBelowPoster: parseInt(document.getElementById('title-below-poster').value),
          lineHeight: parseInt(document.getElementById('line-height').value),
          betweenSections: parseInt(document.getElementById('between-sections').value),
        }
      };

      currentSettings = settings;

      try {
        const res = await fetch('/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestData,
            settings
          })
        });

        if (!res.ok) throw new Error('Failed to generate image');

        const responseData = await res.json();
        const blob = new Blob([new Uint8Array(responseData.imageBuffer.data)], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        
        generatedImage.src = url;
        result.style.display = 'block';
        overlay.classList.remove('show');
        
        // Store session ID and populate menu
        currentSessionId = responseData.sessionId;
        populateMenuOptions(responseData.movieData);

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
    });
  });