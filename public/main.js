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

    document.getElementById('image-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      overlay.classList.add('show'); // fade-in loading screen
      result.style.display = 'none';

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

      try {
        const res = await fetch('/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            letterboxdUrl: document.getElementById('letterboxd-url').value,
            settings
          })
        });

        if (!res.ok) throw new Error('Failed to generate image');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        generatedImage.src = url;
        result.style.display = 'block';
        overlay.classList.remove('show');

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