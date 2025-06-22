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

    // Allow clicking on stars to set the slider value
    starsDisplay.addEventListener('mousemove', (e) => {
      const rect = starsDisplay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      let hoverRating = Math.round(percent * 10) / 2;
      hoverRating = Math.max(0.5, Math.min(5, hoverRating));
      const sliderValue = hoverRating * 2;
      updateStarsDisplay(sliderValue);
    });

    starsDisplay.addEventListener('mouseleave', () => {
      updateStarsDisplay(ratingSlider.value);
    });

    starsDisplay.addEventListener('click', (e) => {
      const rect = starsDisplay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      let clickedRating = Math.round(percent * 10) / 2;
      clickedRating = Math.max(0.5, Math.min(5, clickedRating));
      ratingSlider.value = clickedRating * 2;
      updateStarsDisplay(ratingSlider.value);
    });

    // Initialize
    updateStarsDisplay(ratingSlider.value);    // Search functionality
    const searchButton = document.getElementById('search-button');
    const customTitle = document.getElementById('custom-title');
    const searchResults = document.getElementById('search-results');
    const customFields = document.getElementById('custom-fields');
    
    // Function to perform search
    const performSearch = async () => {
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
    };
    
    // Add click event to search button
    searchButton.addEventListener('click', performSearch);
    
    // Add Enter key support to search input
    customTitle.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });    function displaySearchResults(results) {
      if (!results || results.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center;">No results found</div>';
        return;
      }
      
      searchResults.innerHTML = results.map(item => {        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date) ? `(${(item.release_date || item.first_air_date).substring(0, 4)})` : '';
        const mediaType = item.media_type === 'tv' ? 'TV Series' : 'Movie';
        const mediaTypeClass = item.media_type === 'tv' ? 'tv-series' : '';
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const voteCount = item.vote_count || 0;
        const overview = item.overview ? item.overview.substring(0, 120) + '...' : 'No description available';          // Director/Creator and Cast info
        const directorLabel = item.media_type === 'tv' ? 'Created by' : 'Directed by';
        const directorInfo = item.director ? `<div class="search-result-meta"><strong>${directorLabel}:</strong> ${item.director}</div>` : '';
        const castInfo = item.cast && item.cast.length > 0 ? `<div class="search-result-meta"><strong>Cast:</strong> ${item.cast.join(', ')}</div>` : '';
        
        // Create info tags for both TV series and movies
        let infoTags = '';
        if (item.media_type === 'tv') {
          // TV series tags
          const tags = [];
          if (item.number_of_seasons) tags.push(`${item.number_of_seasons} SEASON${item.number_of_seasons > 1 ? 'S' : ''}`);
          if (item.number_of_episodes) tags.push(`${item.number_of_episodes} EPISODES`);
          if (item.episode_run_time && item.episode_run_time.length > 0) {
            const avgRuntime = Math.round(item.episode_run_time.reduce((a, b) => a + b, 0) / item.episode_run_time.length);
            tags.push(`${avgRuntime}MIN`);
          }
          
          if (tags.length > 0) {
            infoTags = `<div class="search-result-tags">${tags.map(tag => `<span class="info-tag tv-tag">${tag}</span>`).join('')}</div>`;
          }
        } else {
          // Movie tags
          const tags = [];
          if (item.runtime) {
            const hours = Math.floor(item.runtime / 60);
            const minutes = item.runtime % 60;
            if (hours > 0) {
              tags.push(`${hours}H ${minutes}M`);
            } else {
              tags.push(`${minutes}MIN`);
            }
          }
          
          if (tags.length > 0) {
            infoTags = `<div class="search-result-tags">${tags.map(tag => `<span class="info-tag movie-tag">${tag}</span>`).join('')}</div>`;
          }
        }
        
        return `
          <div class="search-result-item" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
            ${item.poster_path 
              ? `<img class="search-result-poster" src="https://image.tmdb.org/t/p/w92${item.poster_path}" alt="${title}">`
              : '<div class="search-result-poster">No Image</div>'
            }
            <div class="search-result-info">              <div class="search-result-header">
                <div class="search-result-title">
                  ${title}<span class="search-result-year">${year}</span>
                </div>
                <span class="search-result-type ${mediaTypeClass}">${mediaType}</span>
              </div>
              <div class="search-result-rating">
                <span class="search-result-score">${rating}/10</span>
                <span class="search-result-votes">(${voteCount.toLocaleString()} votes)</span>
              </div>
              ${infoTags}
              ${directorInfo}
              ${castInfo}
              <div class="search-result-overview">${overview}</div>
            </div>
          </div>
        `;
      }).join('');
        // Add click handlers to search results
      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const selectedId = item.dataset.id;
          const selectedType = item.dataset.type;
          
          // Find the selected item data
          const selectedItem = results.find(r => r.id == selectedId && r.media_type == selectedType);
          
          // Store selected media data
          window.selectedMedia = {
            id: selectedId,
            type: selectedType,
            data: selectedItem
          };
          
          // Show selected media display
          displaySelectedMedia(selectedItem);
          
          // Hide search results and show custom fields
          searchResults.style.display = 'none';
          customFields.style.display = 'block';
        });
      });
    }

    // Function to display selected media
    function displaySelectedMedia(item) {
      const selectedMediaDiv = document.getElementById('selected-media');
      const selectedPoster = document.getElementById('selected-poster');
      const selectedTitle = document.getElementById('selected-title');
      const selectedMeta = document.getElementById('selected-meta');
      
      // Set poster
      if (item.poster_path) {
        selectedPoster.src = `https://image.tmdb.org/t/p/w92${item.poster_path}`;
        selectedPoster.style.display = 'block';
      } else {
        selectedPoster.style.display = 'none';
      }
      
      // Set title and year
      const title = item.title || item.name;
      const year = (item.release_date || item.first_air_date) ? `(${(item.release_date || item.first_air_date).substring(0, 4)})` : '';
      const mediaType = item.media_type === 'tv' ? 'TV Series' : 'Movie';
      
      selectedTitle.textContent = `${title} ${year}`;
      selectedMeta.textContent = mediaType;
      
      // Show the selected media display
      selectedMediaDiv.style.display = 'block';
    }

    // Handle change selection button
    document.getElementById('change-selection').addEventListener('click', () => {
      document.getElementById('selected-media').style.display = 'none';
      document.getElementById('search-results').style.display = 'block';
      document.getElementById('custom-fields').style.display = 'none';
    });

    // Live update slider labels
    const sliderIds = [
      'poster-top', 'title-below-poster', 'line-height',
      'between-sections', 'backdrop-brightness', 'poster-scale', 
      'footer-scale', 'logo-scale', 'credits-font-size'
    ];

    sliderIds.forEach(id => {
      const input = document.getElementById(id);
      const display = document.getElementById(`${id}-value`);
      input.addEventListener('input', () => {
        display.textContent = parseFloat(input.value);
        // Trigger regeneration with current selections preserved
        if (currentSessionId && currentSettings) {
          regenerateWithCurrentSettings();
        }
      });
    });

    // Add event listeners for checkboxes and other settings that should trigger regeneration
    const settingInputs = [
      'blur-backdrop', 'gradient-overlay', 'logo-alignment',
      'show-title', 'show-year', 'show-genre', 'show-director', 'show-music', 
      'show-actors', 'show-rating', 'show-heart', 'show-tags', 'show-runtime', 'show-watched-date',
      'exp-show-credits', 'exp-show-rating', 'exp-show-tags', 'exp-show-watched-date'
    ];

    settingInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => {
          if (currentSessionId && currentSettings) {
            regenerateWithCurrentSettings();
          }
        });
      }
    });

    // Function to regenerate with current settings while preserving selections
    async function regenerateWithCurrentSettings() {
      if (!currentSessionId) return;

      // Update current settings with new values
      const isExperimental = posterStyleSelect.value === 'experimental';
      let contentOrder, metadataSettings;
      
      if (isExperimental) {
        contentOrder = ['logo', 'credits', 'rating', 'tags', 'watched-date'];
        metadataSettings = {
          showLogo: true,
          showCredits: document.getElementById('exp-show-credits').checked,
          showRating: document.getElementById('exp-show-rating').checked,
          showTags: document.getElementById('exp-show-tags').checked,
          showWatchedDate: document.getElementById('exp-show-watched-date').checked
        };
      } else {
        contentOrder = Array.from(document.querySelectorAll('#reorder-list li:not(.non-reorderable)')).map(li => li.dataset.id);
        metadataSettings = {
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
          showWatchedDate: document.getElementById('show-watched-date').checked
        };
      }

      currentSettings = {
        contentOrder: contentOrder,
        ...metadataSettings,
        blurBackdrop: document.getElementById('blur-backdrop').checked,
        gradientOverlay: document.getElementById('gradient-overlay').checked,
        backdropBrightness: parseFloat(document.getElementById('backdrop-brightness').value) / 100,
        posterScale: parseFloat(document.getElementById('poster-scale').value),
        footerScale: parseFloat(document.getElementById('footer-scale').value),
        spacing: {
          posterTop: parseInt(document.getElementById('poster-top').value),
          titleBelowPoster: parseInt(document.getElementById('title-below-poster').value),
          lineHeight: parseInt(document.getElementById('line-height').value),
          betweenSections: parseInt(document.getElementById('between-sections').value),
        },
        posterStyle: posterStyleSelect.value,
        experimentalSettings: {
          creditsFontSize: document.getElementById('credits-font-size')?.value || 28,
          logoAlignment: document.getElementById('logo-alignment')?.value || 'left',
          logoScale: parseFloat(document.getElementById('logo-scale')?.value || 1.0)
        }
      };

      // Call regenerateWithOption which preserves current selections
      await regenerateWithOption();
    }

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
    const logoOptions = document.getElementById('logo-options');
    const logoSelectionSection = document.getElementById('logo-selection-section');    let currentSessionId = null;
    let currentSettings = null;
    let selectedPosterIndex = 0;
    let selectedBackgroundIndex = 0;
    let selectedLogoIndex = 0; // Add selected logo index variable

    // Function to reset selection indices for experimental mode
    function resetSelectionForExperimental() {
      if (posterStyleSelect.value === 'experimental') {
        selectedPosterIndex = -1; // No poster selected by default
        selectedBackgroundIndex = 0; // First background selected by default
      }
    }

    // Poster Style dropdown
    const posterStyleSelect = document.getElementById('poster-style-select');
    const blurBackdropCheckbox = document.getElementById('blur-backdrop');
    const posterOptionsSection = document.querySelector('.menu-section h3'); // "Main Poster:"
    const posterOptionsDiv = document.getElementById('poster-options');
    const backgroundOptionsDiv = document.getElementById('background-options');
    const backgroundSection = document.querySelector('.menu-section:last-child');

    // Elements that need to be toggled based on poster style
    const posterRelatedSettings = document.querySelectorAll('.poster-only-setting');
    const experimentalRelatedSettings = document.querySelectorAll('.experimental-only-setting');
    
    // When poster style changes, update settings panel and defaults
    posterStyleSelect.addEventListener('change', () => {
      const isExperimental = posterStyleSelect.value === 'experimental';
      
      // Update blur default for experimental
      if (isExperimental) {
        blurBackdropCheckbox.checked = false;
        
        // Show experimental-only settings, hide poster-only settings
        posterRelatedSettings.forEach(el => el.style.display = 'none');
        experimentalRelatedSettings.forEach(el => el.style.display = '');
        
        // Show experimental metadata options, hide classic ones
        document.getElementById('classic-metadata-options').style.display = 'none';
        document.getElementById('experimental-metadata-options').style.display = 'block';
      } else {
        // Classic mode - restore default settings visibility
        posterRelatedSettings.forEach(el => el.style.display = '');
        experimentalRelatedSettings.forEach(el => el.style.display = 'none');
        
        // Show classic metadata options, hide experimental ones
        document.getElementById('classic-metadata-options').style.display = 'block';
        document.getElementById('experimental-metadata-options').style.display = 'none';
      }

      // Only regenerate if we have an active session and the style actually changed
      if (currentSessionId && currentSettings) {
        // Reset selections for experimental mode
        if (isExperimental) {
          selectedPosterIndex = -1;
          selectedBackgroundIndex = 0;
        } else {
          selectedPosterIndex = 0;
          selectedBackgroundIndex = 0;
        }
        regenerateWithCurrentSettings();
      }
    });    // Function to create option items
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
      
      item.addEventListener('click', () => {
        // In experimental mode, handle poster/background selection logic
        if (posterStyleSelect.value === 'experimental' && type === 'poster') {
          // Reset background selection when poster is selected
          selectedBackgroundIndex = -1;
          selectedPosterIndex = index;
        } else if (posterStyleSelect.value === 'experimental' && type === 'background') {
          // Reset poster selection when background is selected
          selectedPosterIndex = -1;
          selectedBackgroundIndex = index;
        } else {
          // Classic mode - normal selection
          if (type === 'poster') {
            selectedPosterIndex = index;
          } else if (type === 'background') {
            selectedBackgroundIndex = index;
          } else if (type === 'logo') {
            selectedLogoIndex = index;
          }
        }
        regenerateWithOption();
      });
      return item;
    }

    // When poster style changes, default blur off for Experimental
    posterStyleSelect.addEventListener('change', () => {
      if (posterStyleSelect.value === 'experimental') {
        blurBackdropCheckbox.checked = false;
      }
    });

    // Function to populate menu options
    function populateMenuOptions(movieData) {
      // Clear existing options
      posterOptionsDiv.innerHTML = '';
      backgroundOptionsDiv.innerHTML = '';
      logoOptions.innerHTML = '';
      
      // Hide logo section by default
      logoSelectionSection.style.display = 'none';      // Experimental mode: handle logos and other options
      if (posterStyleSelect.value === 'experimental') {
        // Show poster section for experimental mode (posters will be used as backgrounds)
        posterOptionsSection.parentElement.style.display = '';        // Add poster options (main poster + alternatives) - these will be used as backgrounds
        const posterList = [movieData.mainPoster, ...(movieData.alternativePosters || [])];
        posterList.forEach((poster, index) => {
          const item = createOptionItem(poster, 'poster', index, false); // Never active by default in experimental
          posterOptionsDiv.appendChild(item);
        });

        // Show logos if available (for experimental mode)
        if (movieData.alternativeLogos && movieData.alternativeLogos.length > 0) {
          logoSelectionSection.style.display = ''; // Show the section
          
          // Find English logo index for default selection (prioritize English)
          let defaultLogoIndex = 0;
          const englishLogoIndex = movieData.alternativeLogos.findIndex(logo => logo.language === 'en');
          if (englishLogoIndex !== -1) {
            defaultLogoIndex = englishLogoIndex;
            selectedLogoIndex = englishLogoIndex;
            console.log(`🎯 Using English logo as default (index ${englishLogoIndex})`);
          } else {
            console.log(`⚠️ No English logo found, using first available (index 0)`);
          }
          
          // Add logo options
          movieData.alternativeLogos.forEach((logo, index) => {
            const item = createOptionItem(logo.url, 'logo', index, index === defaultLogoIndex);
            logoOptions.appendChild(item);
          });
        }        // Combine all backdrops and posters for background selection
        let backgrounds = [];
        // Use sorted backdrops from backend (already sorted by quality)
        if (movieData.alternativeBackdrops && movieData.alternativeBackdrops.length > 0) {
          backgrounds = backgrounds.concat(movieData.alternativeBackdrops);
        }        // Add all posters as additional backgrounds (use w1280 for consistency, avoid duplicates)
        const posterBackgrounds = [movieData.mainPoster, ...(movieData.alternativePosters || [])].filter(Boolean);
        posterBackgrounds.forEach(poster => {
          // Convert poster URLs to w1280 for consistency with backdrops
          const posterUrl = poster.replace('/w500/', '/w1280/');
          if (!backgrounds.includes(posterUrl)) backgrounds.push(posterUrl);
        });

        console.log(`🎨 [Experimental Menu] Preparing ${backgrounds.length} background options (backdrops + posters)`);

        backgrounds.forEach((background, index) => {
          const item = createOptionItem(background, 'background', index, index === selectedBackgroundIndex);
          backgroundOptionsDiv.appendChild(item);
        });

        // Always show background section
        backgroundSection.style.display = '';
      } else {
        // Classic mode: show poster selection and backgrounds as usual
        posterOptionsSection.parentElement.style.display = '';
        // Add poster options (main poster + alternatives)
        const posters = [movieData.mainPoster, ...(movieData.alternativePosters || [])];
        posters.forEach((poster, index) => {
          const item = createOptionItem(poster, 'poster', index, index === selectedPosterIndex);
          posterOptionsDiv.appendChild(item);
        });

        // Add background options (main backdrop + alternatives)
        let backgrounds = [movieData.mainBackdrop, ...(movieData.alternativeBackdrops || [])];
        backgrounds.forEach((background, index) => {
          const item = createOptionItem(background, 'background', index, index === selectedBackgroundIndex);
          backgroundOptionsDiv.appendChild(item);
        });
        backgroundSection.style.display = '';
      }
    }    // Function to regenerate image with selected options
    async function regenerateWithOption() {
      if (!currentSessionId || !currentSettings) return;

      overlay.classList.add('show');

      try {
        const requestData = {
          sessionId: currentSessionId,
          selectedPosterIndex,
          selectedBackgroundIndex,
          selectedLogoIndex, // Add logo index
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

        // Update active states for all option types - but handle experimental mode specially
        document.querySelectorAll('.option-item').forEach(item => item.classList.remove('active'));
          // In experimental mode, only show active state for the option that's actually being used
        if (posterStyleSelect.value === 'experimental') {
          // In experimental, poster selection takes priority for background
          if (selectedPosterIndex >= 0) {
            document.querySelectorAll(`[data-type="poster"][data-index="${selectedPosterIndex}"]`).forEach(item => item.classList.add('active'));
          } else if (selectedBackgroundIndex >= 0) {
            document.querySelectorAll(`[data-type="background"][data-index="${selectedBackgroundIndex}"]`).forEach(item => item.classList.add('active'));
          }
        } else {
          // Classic mode - show both poster and background selections
          document.querySelectorAll(`[data-type="poster"][data-index="${selectedPosterIndex}"]`).forEach(item => item.classList.add('active'));
          document.querySelectorAll(`[data-type="background"][data-index="${selectedBackgroundIndex}"]`).forEach(item => item.classList.add('active'));
        }
        
        document.querySelectorAll(`[data-type="logo"][data-index="${selectedLogoIndex}"]`).forEach(item => item.classList.add('active'));

        overlay.classList.remove('show');

        // Update button handlers - Store current blob for copy functionality
        window.currentImageBlob = blob;
        updateButtonHandlers();

      } catch (err) {
        alert('Error: ' + err.message);
        overlay.classList.remove('show');
      }
    }

    // Function to check clipboard API support
    function isClipboardSupported() {
      return navigator.clipboard && navigator.clipboard.write && window.isSecureContext;
    }

    // Improved copy to clipboard function
    async function copyImageToClipboard(blob) {
      if (!isClipboardSupported()) {
        throw new Error('Clipboard API not supported. Please use the download button instead.');
      }

      try {
        // Convert to PNG if not already
        let pngBlob = blob;
        if (blob.type !== 'image/png') {
          // Create canvas to convert to PNG
          const img = new Image();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          pngBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
          });
          
          URL.revokeObjectURL(img.src);
        }

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        
        return true;
      } catch (error) {
        console.error('Clipboard write failed:', error);
        throw error;
      }
    }

    // Separate function to update button handlers
    function updateButtonHandlers() {
      if (window.currentImageBlob) {
        copyButton.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Update button state
          const originalText = copyButton.textContent;
          copyButton.textContent = 'Copying...';
          copyButton.disabled = true;
          
          try {
            await copyImageToClipboard(window.currentImageBlob);
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
              copyButton.textContent = originalText;
              copyButton.disabled = false;
            }, 2000);
          } catch (error) {
            console.error('Copy failed:', error);
            copyButton.textContent = originalText;
            copyButton.disabled = false;
            
            // Show user-friendly error message based on error type
            let errorMessage = 'Failed to copy image to clipboard.';
            if (error.message.includes('not supported')) {
              errorMessage = 'Clipboard not supported. Use HTTPS or try the download button.';
            } else if (error.message.includes('NotAllowedError')) {
              errorMessage = 'Clipboard access denied. Please try the download button.';
            }
            
            alert(errorMessage);
          }
        };

        downloadButton.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const url = URL.createObjectURL(window.currentImageBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'letterboxd-poster.png';
          a.click();
          URL.revokeObjectURL(url);
        };
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

      // Gather settings based on poster style
      const isExperimental = posterStyleSelect.value === 'experimental';
      let contentOrder, metadataSettings;
      
      if (isExperimental) {
        // Fixed order for experimental
        contentOrder = ['logo', 'credits', 'rating', 'tags', 'watched-date'];
        metadataSettings = {
          showLogo: true, // Always show logo/title in experimental
          showCredits: document.getElementById('exp-show-credits').checked,
          showRating: document.getElementById('exp-show-rating').checked,
          showTags: document.getElementById('exp-show-tags').checked,
          showWatchedDate: document.getElementById('exp-show-watched-date').checked
        };
      } else {
        // Order from sortable for classic
        contentOrder = Array.from(document.querySelectorAll('#reorder-list li:not(.non-reorderable)')).map(li => li.dataset.id);
        metadataSettings = {
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
          showWatchedDate: document.getElementById('show-watched-date').checked
        };
      }

      const settings = {
        contentOrder: contentOrder,
        ...metadataSettings,
        blurBackdrop: document.getElementById('blur-backdrop').checked,
        gradientOverlay: document.getElementById('gradient-overlay').checked,
        backdropBrightness: parseFloat(document.getElementById('backdrop-brightness').value) / 100,
        posterScale: parseFloat(document.getElementById('poster-scale').value),
        footerScale: parseFloat(document.getElementById('footer-scale').value),
        spacing: {
          posterTop: parseInt(document.getElementById('poster-top').value),
          titleBelowPoster: parseInt(document.getElementById('title-below-poster').value),
          lineHeight: parseInt(document.getElementById('line-height').value),
          betweenSections: parseInt(document.getElementById('between-sections').value),
        },
        posterStyle: posterStyleSelect.value,
        experimentalSettings: {
          creditsFontSize: document.getElementById('credits-font-size')?.value || 28,
          logoAlignment: document.getElementById('logo-alignment')?.value || 'left',
          logoScale: parseFloat(document.getElementById('logo-scale')?.value || 1.0)
        }
      };      currentSettings = settings;      try {
        const res = await fetch('/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...requestData,
            settings,
            // Pass initial selection indices for experimental mode
            selectedPosterIndex: settings.posterStyle === 'experimental' ? -1 : 0,
            selectedBackgroundIndex: 0,
            selectedLogoIndex: 0
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to generate image: ${errorText}`);
        }

        const responseData = await res.json();
        
        const blob = new Blob([new Uint8Array(responseData.imageBuffer.data)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        
        generatedImage.src = url;
        result.style.display = 'block';
        overlay.classList.remove('show');
          // Store session ID and populate menu
        currentSessionId = responseData.sessionId;
        
        // Reset selection for experimental mode
        resetSelectionForExperimental();
        
        populateMenuOptions(responseData.movieData);

        // Store current blob and set up button handlers
        window.currentImageBlob = blob;
        updateButtonHandlers();

      } catch (err) {
        console.error('Error generating poster:', err);
        alert('Error: ' + err.message);
        overlay.classList.remove('show');
      }
    });
  });