// Client-side utility functions for PosterBoxd
// This module helps reduce the size of main.js and improves organization

/**
 * Rating slider utilities
 */
export const RatingUtils = {
  updateStarsDisplay(value) {
    const rating = parseFloat(value);
    const full = Math.floor(rating / 2);
    const half = (rating % 2) >= 1;
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  },

  initializeRatingSlider() {
    const ratingSlider = document.getElementById('custom-rating');
    const starsDisplay = document.querySelector('.stars-display');

    if (ratingSlider && starsDisplay) {
      ratingSlider.addEventListener('input', () => {
        starsDisplay.textContent = this.updateStarsDisplay(ratingSlider.value);
      });
    }
  }
};

/**
 * Settings utilities
 */
export const SettingsUtils = {
  initializeSliderUpdates() {
    const sliderIds = [
      'poster-top', 'title-below-poster', 'line-height',
      'between-sections', 'backdrop-brightness', 'poster-scale', 
      'footer-scale', 'logo-scale', 'credits-font-size'
    ];

    sliderIds.forEach(id => {
      const input = document.getElementById(id);
      const display = document.getElementById(`${id}-value`);
      
      if (input && display) {
        input.addEventListener('input', () => {
          display.textContent = parseFloat(input.value);
        });
      }
    });
  },

  getSettingsFromForm() {
    return {
      showTitle: document.getElementById('show-title')?.checked || false,
      showYear: document.getElementById('show-year')?.checked || false,
      showDirector: document.getElementById('show-director')?.checked || false,
      showActors: document.getElementById('show-actors')?.checked || false,
      showGenre: document.getElementById('show-genre')?.checked || false,
      showRuntime: document.getElementById('show-runtime')?.checked || false,
      showMusic: document.getElementById('show-music')?.checked || false,
      showRating: document.getElementById('show-rating')?.checked || false,
      showHeart: document.getElementById('show-heart')?.checked || false,
      showTags: document.getElementById('show-tags')?.checked || false,
      showWatchedDate: document.getElementById('show-watched-date')?.checked || false,
      
      blurBackdrop: document.getElementById('blur-backdrop')?.checked || false,
      gradientOverlay: document.getElementById('gradient-overlay')?.checked || false,
      backdropBrightness: parseFloat(document.getElementById('backdrop-brightness')?.value) || 60,
      
      posterScale: parseFloat(document.getElementById('poster-scale')?.value) || 1.0,
      posterTop: parseFloat(document.getElementById('poster-top')?.value) || 240,
      titleBelowPoster: parseFloat(document.getElementById('title-below-poster')?.value) || 60,
      lineHeight: parseFloat(document.getElementById('line-height')?.value) || 72,
      betweenSections: parseFloat(document.getElementById('between-sections')?.value) || 60,
      footerScale: parseFloat(document.getElementById('footer-scale')?.value) || 1.0
    };
  }
};

/**
 * General DOM utilities
 */
export const DOMUtils = {
  showElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
  },

  hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  },

  toggleElement(id, show) {
    const element = document.getElementById(id);
    if (element) element.style.display = show ? 'block' : 'none';
  }
};