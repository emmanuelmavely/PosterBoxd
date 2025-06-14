document.addEventListener('DOMContentLoaded', () => {
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

    // Sortable list
    Sortable.create(document.getElementById('reorder-list'), {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      touchStartThreshold: 10
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

      // Extract URL from the share text
      const shareText = document.getElementById('letterboxd-url').value.trim();
      const urlMatch = shareText.match(/(https:\/\/(?:boxd\.it|letterboxd\.com)\/[^\s]+)/);
      if (!urlMatch) {
        alert('Please provide a valid Letterboxd URL.');
        overlay.classList.remove('show');
        return;
      }
      const letterboxdUrl = urlMatch[1];

      // Gather settings fresh on submit
      const order = Array.from(document.querySelectorAll('#reorder-list li')).map(li => li.dataset.id);
      const settings = {
        contentOrder: order,
        showTitle: document.getElementById('show-title').checked,
        showYear: document.getElementById('show-year').checked,
        showGenre: document.getElementById('show-genre').checked,
        showDirector: document.getElementById('show-director').checked,
        showMusic: document.getElementById('show-music').checked,
        showActors: document.getElementById('show-actors').checked,
        showRating: document.getElementById('show-rating').checked,
        showTags: document.getElementById('show-tags').checked,
        showRuntime: document.getElementById('show-runtime').checked,
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
            letterboxdUrl: letterboxdUrl,
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