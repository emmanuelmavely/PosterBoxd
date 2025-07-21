// Image processing functions for poster generation
import sharp from 'sharp';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { fileExists } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate poster image with all settings applied
 */
export async function generatePosterImage(movieData, settings) {
  const { movie, credits, images, details } = movieData;
  
  // Get selected images
  const selectedPoster = settings.selectedPosterIndex >= 0 ? images.posters[settings.selectedPosterIndex] : null;
  const selectedBackground = settings.selectedBackgroundIndex >= 0 ? images.backdrops[settings.selectedBackgroundIndex] : null;
  
  console.log('\n🎨 === POSTER GENERATION ===');
  console.log('🖼️ Selected Images:', {
    poster: selectedPoster ? `${selectedPoster.width}x${selectedPoster.height}` : 'None',
    background: selectedBackground ? `${selectedBackground.width}x${selectedBackground.height}` : 'None',
    posterStyle: settings.posterStyle || 'classic'
  });
  
  // Generate SVG overlay with metadata
  const svgOverlay = await generateSvgOverlay(movieData, settings);
  
  // Create the final poster
  const poster = await createPosterComposition(selectedBackground, selectedPoster, svgOverlay, settings);
  
  return poster;
}

/**
 * Generate SVG overlay with all metadata and styling
 */
export async function generateSvgOverlay(movieData, settings) {
  const { movie, credits, images, details } = movieData;
  const isExperimental = settings.posterStyle === 'experimental';
  
  // TV series enhancements
  const isTV = movieData.movie && (movieData.movie.first_air_date || movieData.movie.number_of_seasons);
  
  console.log('📺 Media Type Detection:', {
    isTV: isTV,
    hasSeasons: !!details?.number_of_seasons,
    mediaType: movie?.media_type || 'movie'
  });
  
  // Get season-specific data if available
  const seasonData = settings.selectedSeason ? movieData.seasonData : null;
  
  // Use season data if available, otherwise use series data
  const displayData = seasonData ? {
    ...movieData,
    details: seasonData.seasonDetails,
    credits: seasonData.seasonCredits
  } : movieData;
  
  const title = displayData.movie?.title || displayData.movie?.name || movie?.title || movie?.name;
  const year = getDisplayYear(displayData, isTV, settings.selectedSeason);
  
  // Build metadata sections based on content order and visibility
  let yPosition = isExperimental ? 100 : (settings.posterTop + settings.titleBelowPoster + 80);
  const sections = [];
  
  // Process each content item in order
  settings.contentOrder.forEach(key => {
    if (key === 'title' && settings.showTitle && title) {
      sections.push(createTitleSection(title, yPosition, settings));
      yPosition += settings.lineHeight + settings.betweenSections;
    }
    
    if (key === 'year' && settings.showYear && year) {
      sections.push(createTextSection(year, yPosition, 'year'));
      yPosition += settings.lineHeight + settings.betweenSections;
    }
    
    if (key === 'director' && settings.showDirector) {
      const directorText = getDirectorText(displayData, isTV, seasonData);
      if (directorText) {
        sections.push(createTextSection(directorText, yPosition, 'director'));
        yPosition += settings.lineHeight + settings.betweenSections;
      }
    }
    
    // Add other sections...
    // [Additional metadata sections would be added here]
  });
  
  // Generate SVG
  const svgContent = `
    <svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .title { font-family: 'Arial Black', Arial, sans-serif; font-weight: 900; font-size: 68px; fill: white; text-anchor: middle; }
          .text { font-family: Arial, sans-serif; font-weight: bold; font-size: 28px; fill: white; text-anchor: middle; }
          .label { font-family: Arial, sans-serif; font-weight: normal; font-size: 28px; fill: #cccccc; text-anchor: middle; }
        </style>
      </defs>
      ${sections.join('\n')}
    </svg>
  `;
  
  return Buffer.from(svgContent);
}

/**
 * Create the final poster composition
 */
export async function createPosterComposition(background, poster, svgOverlay, settings) {
  const canvas = sharp({
    create: {
      width: 1200,
      height: 1800,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  });
  
  const layers = [];
  
  // Add background if available
  if (background) {
    const backgroundBuffer = await downloadImage(`https://image.tmdb.org/t/p/original${background.file_path}`);
    
    let backgroundLayer = sharp(backgroundBuffer)
      .resize(1200, 1800, { fit: 'cover', position: 'center' });
    
    // Apply background effects
    if (settings.backdropBrightness !== 100) {
      backgroundLayer = backgroundLayer.modulate({ 
        brightness: settings.backdropBrightness / 100 
      });
    }
    
    if (settings.blurBackdrop) {
      backgroundLayer = backgroundLayer.blur(10);
    }
    
    layers.push({ input: await backgroundLayer.toBuffer(), top: 0, left: 0 });
    
    // Add gradient overlay if enabled
    if (settings.gradientOverlay) {
      const gradientSvg = `
        <svg width="1200" height="1800">
          <defs>
            <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" style="stop-color:black;stop-opacity:0.8" />
              <stop offset="40%" style="stop-color:black;stop-opacity:0.4" />
              <stop offset="100%" style="stop-color:black;stop-opacity:0" />
            </linearGradient>
          </defs>
          <rect width="1200" height="1800" fill="url(#grad)" />
        </svg>
      `;
      layers.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });
    }
  }
  
  // Add poster if available and not experimental mode
  if (poster && settings.posterStyle !== 'experimental') {
    const posterBuffer = await downloadImage(`https://image.tmdb.org/t/p/w500${poster.file_path}`);
    const posterWidth = Math.round(300 * settings.posterScale);
    const posterHeight = Math.round(450 * settings.posterScale);
    
    const resizedPoster = await sharp(posterBuffer)
      .resize(posterWidth, posterHeight, { fit: 'cover' })
      .toBuffer();
    
    layers.push({
      input: resizedPoster,
      top: settings.posterTop,
      left: Math.round((1200 - posterWidth) / 2)
    });
  }
  
  // Add SVG overlay
  layers.push({ input: svgOverlay, top: 0, left: 0 });
  
  // Add footer logo
  const logoPath = path.join(__dirname, '..', 'public', 'assets', 'letterboxd-logo.png');
  if (await fileExists(logoPath)) {
    const logoSize = Math.round(40 * settings.footerScale);
    const logo = await sharp(logoPath)
      .resize(logoSize, logoSize, { fit: 'contain' })
      .toBuffer();
    
    layers.push({
      input: logo,
      top: 1740,
      left: Math.round((1200 - logoSize) / 2)
    });
  }
  
  return canvas.composite(layers).png().toBuffer();
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Get display year based on media type and season
 */
function getDisplayYear(data, isTV, selectedSeason) {
  if (selectedSeason && data.seasonData) {
    // For specific season, show season air date
    const seasonDetails = data.seasonData.seasonDetails;
    return seasonDetails.air_date ? new Date(seasonDetails.air_date).getFullYear() : '';
  }
  
  if (isTV) {
    const startYear = data.details?.first_air_date ? new Date(data.details.first_air_date).getFullYear() : '';
    const endYear = data.details?.last_air_date ? new Date(data.details.last_air_date).getFullYear() : '';
    const status = data.details?.status;
    
    if (startYear && endYear && endYear !== startYear && status !== 'Returning Series') {
      return `${startYear}–${endYear}`;
    } else if (startYear) {
      return `${startYear}–`;
    }
  }
  
  // For movies or fallback
  const releaseDate = data.movie?.release_date || data.movie?.first_air_date;
  return releaseDate ? new Date(releaseDate).getFullYear() : '';
}

/**
 * Get director/creator text
 */
function getDirectorText(data, isTV, seasonData) {
  if (seasonData) {
    // For season-specific, could show season directors/writers
    const seasonCrew = seasonData.seasonCredits?.crew || [];
    const directors = seasonCrew.filter(c => c.job === 'Director').map(c => c.name);
    if (directors.length > 0) {
      return `Directed by ${directors.slice(0, 2).join(', ')}`;
    }
  }
  
  if (isTV) {
    const creator = data.details?.created_by?.[0]?.name || '';
    return creator ? `Created by ${creator}` : '';
  } else {
    const director = data.credits?.crew?.find(c => c.job === 'Director')?.name || '';
    return director ? `Directed by ${director}` : '';
  }
}

/**
 * Create title section
 */
function createTitleSection(title, yPosition, settings) {
  // Split long titles into multiple lines
  const words = title.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > 20 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.map((line, index) => 
    `<text x="600" y="${yPosition + (index * 72)}" class="title">${escapeHtml(line)}</text>`
  ).join('\n');
}

/**
 * Create text section
 */
function createTextSection(text, yPosition, className = 'text') {
  return `<text x="600" y="${yPosition}" class="${className}">${escapeHtml(text)}</text>`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}