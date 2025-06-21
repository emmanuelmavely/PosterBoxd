// Cleaned and organized server.js for PosterBoxd
import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Increase the payload size limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Store movie data in memory (in production, use Redis or database)
const movieDataStore = new Map();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Search endpoint
app.post('/search-media', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Search both movies and TV shows
    const [movieResults, tvResults] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json())
    ]);
    
    // Combine and sort by popularity
    const allResults = [
      ...(movieResults.results || []).map(item => ({ ...item, media_type: 'movie' })),
      ...(tvResults.results || []).map(item => ({ ...item, media_type: 'tv' }))
    ].sort((a, b) => b.popularity - a.popularity).slice(0, 10);
    
    res.json({ results: allResults });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'\"]+/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + word).length > maxChars) {
      lines.push(current.trim());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

async function fetchTmdbData(title, year = '', expectedDirector = '') {
  console.log('🔍 Searching TMDb for:', title, year, expectedDirector);
  const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
  const searchData = await fetch(searchUrl).then(res => res.json());
  const results = searchData.results || [];

  for (const movie of results) {
    const credits = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json());
    const director = credits.crew.find(c => c.job === 'Director')?.name || '';
    if (expectedDirector && director.toLowerCase().includes(expectedDirector.toLowerCase())) {
      const details = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`).then(res => res.json());
      const images = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${TMDB_API_KEY}`).then(res => res.json());
      return { movie, details, credits, images };
    }
  }

  if (!results.length) throw new Error('No TMDb match found');
  const fallback = results[0];
  const details = await fetch(`https://api.themoviedb.org/3/movie/${fallback.id}?api_key=${TMDB_API_KEY}`).then(res => res.json());
  const credits = await fetch(`https://api.themoviedb.org/3/movie/${fallback.id}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json());
  const images = await fetch(`https://api.themoviedb.org/3/movie/${fallback.id}/images?api_key=${TMDB_API_KEY}`).then(res => res.json());
  return { movie: fallback, details, credits, images };
}

// Convert runtime to hours and minutes
function formatRuntime(runtime) {
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return `${hours}h ${minutes}min`;
}

/**
 * Sort backdrops by quality (resolution, aspect ratio, vote average)
 */
function sortBackdropsByQuality(backdrops) {
  if (!backdrops || !backdrops.length) return [];
  const scoredBackdrops = backdrops.map(backdrop => {
    let qualityScore = 0;
    qualityScore += (backdrop.width * backdrop.height) / 100000;
    const aspectRatio = backdrop.width / backdrop.height;
    const aspectDiff = Math.abs(aspectRatio - 1.78);
    qualityScore -= aspectDiff * 10;
    if (backdrop.vote_average) qualityScore += backdrop.vote_average * 5;
    if (backdrop.vote_count) qualityScore += Math.min(backdrop.vote_count / 10, 5);
    return { ...backdrop, qualityScore };
  });
  return scoredBackdrops.sort((a, b) => b.qualityScore - a.qualityScore);
}

// Group crew by role, combine names, and handle Director/Writer merge
function groupCrewByRole(credits) {
  if (!credits || !credits.crew) return [];
  const roleOrder = [
    'Director',
    'Writer',
    'Sound',
    'Cast', // Added Cast to role order
    'Director of Photography',
    'Producer'
  ];
  const roleMap = {};
  for (const member of credits.crew) {
    let job = member.job;
    if (job === 'Director of Photography (DOP)' || job === 'Cinematography') job = 'Director of Photography';
    if (job === 'Sound Designer' || job === 'Original Music Composer') job = 'Sound';
    if (!roleOrder.includes(job)) continue;
    if (!roleMap[job]) roleMap[job] = [];
    if (!roleMap[job].includes(member.name)) roleMap[job].push(member.name);
  }
  
  // Add cast members if available (top 3)
  if (credits.cast && credits.cast.length > 0) {
    roleMap['Cast'] = credits.cast.slice(0, 3).map(actor => actor.name);
  }
  
  // Combine Director & Writer if same person
  let combined = [];
  if (
    roleMap['Director'] &&
    roleMap['Writer'] &&
    roleMap['Director'].length === 1 &&
    roleMap['Writer'].length === 1 &&
    roleMap['Director'][0] === roleMap['Writer'][0]
  ) {
    combined.push({
      role: 'Director / Writer',
      names: [roleMap['Director'][0]]
    });
    delete roleMap['Director'];
    delete roleMap['Writer'];
  }
  // Add remaining roles in order
  roleOrder.forEach(role => {
    if (roleMap[role]) {
      combined.push({
        role,
        names: roleMap[role]
      });
    }
  });
  return combined;
}

// Helper for star string
function getStarString(rating) {
  if (!rating) return '';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// Experimental poster generator
async function generateExperimentalPoster(movieData, settings, selectedPosterIndex = 0, selectedBackgroundIndex = 0, selectedLogoIndex = 0) {
  const { movie, details, credits, images, username, rating, tags, watchedDate } = movieData;
  const width = 1080, height = 1920;

  // Backdrop: sort by quality, use best as default
  const sortedBackdrops = sortBackdropsByQuality(images.backdrops || []);
  // Add all posters as additional backgrounds (avoid duplicates)
  const posters = [movie.poster_path, ...(images.posters?.slice(0, 5).map(p => p.file_path) || [])].filter(Boolean);
  let backgrounds = sortedBackdrops.map(b => `https://image.tmdb.org/t/p/w1280${b.file_path}`);
  posters.forEach(p => {
    const posterUrl = `https://image.tmdb.org/t/p/w500${p}`;
    if (!backgrounds.includes(posterUrl)) backgrounds.push(posterUrl);
  });  // Handle poster selection in experimental mode - if a poster is selected, use it as background
  let selectedBackground;
  if (selectedPosterIndex !== undefined && selectedPosterIndex >= 0 && selectedPosterIndex !== -1) {
    // Get the poster list for selection (includes main + alternatives)
    const allPosters = [movie.poster_path, ...(images.posters?.slice(0, 5).map(p => p.file_path) || [])].filter(Boolean);
    if (selectedPosterIndex < allPosters.length) {
      selectedBackground = `https://image.tmdb.org/t/p/w1280${allPosters[selectedPosterIndex]}`;
      console.log(`🎨 [Experimental] Using selected poster as background (index ${selectedPosterIndex})`);
    } else {
      selectedBackground = backgrounds[selectedBackgroundIndex] || backgrounds[0];
      console.log(`🎨 [Experimental] Poster index out of range, using background (index ${selectedBackgroundIndex})`);
    }
  } else {
    selectedBackground = backgrounds[selectedBackgroundIndex] || backgrounds[0];
    console.log(`🎨 [Experimental] Using selected background (index ${selectedBackgroundIndex})`);
  }

  // Prepare base image
  let baseImage = selectedBackground
    ? sharp(await (await fetch(selectedBackground)).arrayBuffer())
        .resize(width, height, { fit: 'cover' })
        .modulate({ brightness: settings.backdropBrightness ?? 0.6 })
    : sharp({ create: { width, height, channels: 3, background: '#000' } });
  if (settings.blurBackdrop ?? true) baseImage = baseImage.blur(10);

  // Prepare logo for footer
  const posterboxdLogoPath = path.join(__dirname, 'public/assets/footer-posterboxd.png');
  const posterboxdLogoBuffer = await fs.readFile(posterboxdLogoPath);
  const posterboxdLogoDataUrl = `data:image/png;base64,${posterboxdLogoBuffer.toString('base64')}`;

  // SVG layout constants
  const leftX = 80;
  let y = 1150;
  const lineGap = 40;
  const titleCrewGap = 50;
  const crewStarsGap = 40;
  const logoScale = settings.experimentalSettings?.logoScale || 1.0;
  const logoW = 600 * logoScale, logoH = 120 * logoScale;
  const MAX_CREDIT_LINE_CHARS = 60;

  // SVG content
  let svgContent = '';
  // --- Title logo from TMDB if available ---
  let logoPlaced = false;
  if (images && images.logos && images.logos.length > 0) {
    console.log(`🎨 [Logo Processing] Found ${images.logos.length} available logo(s):`);
    images.logos.forEach((logo, index) => {
      console.log(`   ${index}: ${logo.iso_639_1 || 'null'} | ${logo.width}x${logo.height} | ${logo.file_path}`);
    });
    
    const logoSizes = ['w500', 'original', 'w300'];
    
    // Default to English logo first, then use selected index, then fallback to first available
    let logoObj;
    if (selectedLogoIndex === 0) {
      // If no specific selection, prefer English
      logoObj = images.logos.find(l => l.iso_639_1 === 'en') || images.logos[0];
      const englishIndex = images.logos.findIndex(l => l.iso_639_1 === 'en');
      if (englishIndex !== -1) {
        console.log(`✅ [Logo] Using English logo (index ${englishIndex})`);
      } else {
        console.log(`⚠️  [Logo] No English logo found, using first available (index 0)`);
      }
    } else {
      logoObj = images.logos[selectedLogoIndex] || images.logos[0];
      console.log(`🎯 [Logo] Using selected logo (index ${selectedLogoIndex}): ${logoObj.iso_639_1 || 'null'}`);
    }
    
    if (logoObj && logoObj.file_path) {
      console.log(`🔄 [Logo] Attempting to fetch logo: ${logoObj.iso_639_1 || 'null'} (${logoObj.width}x${logoObj.height})`);
      
      for (const size of logoSizes) {
        try {
          const logoUrl = `https://image.tmdb.org/t/p/${size}${logoObj.file_path}`;
          const logoResp = await fetch(logoUrl);
          
          if (!logoResp.ok) {
            console.log(`   ❌ Size ${size}: HTTP ${logoResp.status}`);
            continue;
          }
          
          const contentType = logoResp.headers.get('content-type');
          const arrBuf = await logoResp.arrayBuffer();
          const logoBuffer = Buffer.from(arrBuf);
          
          if (logoBuffer.length > 1024) {
            const logoDataUrl = `data:${contentType || 'image/png'};base64,${logoBuffer.toString('base64')}`;
            const logoX = settings.experimentalSettings?.logoAlignment === 'center' ? (width - logoW) / 2 : leftX;
            
            svgContent += `<image x="${logoX}" y="${y}" width="${logoW}" height="${logoH}" xlink:href="${logoDataUrl}" preserveAspectRatio="xMinYMid meet" />`;
            y += logoH + titleCrewGap;
            logoPlaced = true;
            
            console.log(`   ✅ Size ${size}: Success (${Math.round(logoBuffer.length/1024)}KB, ${contentType})`);
            console.log(`🎨 [Logo] Placed successfully at (${logoX}, ${y-logoH-titleCrewGap}) with ${settings.experimentalSettings?.logoAlignment || 'left'} alignment`);
            break;
          } else {
            console.log(`   ⚠️  Size ${size}: Too small (${logoBuffer.length} bytes)`);
          }
        } catch (e) {
          console.log(`   ❌ Size ${size}: ${e.message}`);
        }
      }
    }
  }
  
  if (!logoPlaced) {
    console.log(`📝 [Logo] Using text fallback: "${movieData.title}"`);
    const year = movieData.year ? ` <tspan class="title-year">(${escapeXml(movieData.year)})</tspan>` : '';
    svgContent += `<text x="${leftX}" y="${y}" class="logo-title" text-anchor="start">${escapeXml(movieData.title)}${year}</text>`;
    y += 80 + titleCrewGap;
  }

  // Crew credits (grouped by role, names bold, left-aligned, char limit)
  const groupedByRole = groupCrewByRole(credits);
  groupedByRole.forEach(item => {
    let displayNames = [...item.names];
    let creditText = `${item.role}: ${displayNames.join(', ')}`;
    // Character limit logic
    while (creditText.length > MAX_CREDIT_LINE_CHARS && displayNames.length > 1) {
      displayNames.pop();
      creditText = `${item.role}: ${displayNames.join(', ')} & others`;
    }
    if (creditText.length > MAX_CREDIT_LINE_CHARS && displayNames.length === 1) {
      const maxNameLength = MAX_CREDIT_LINE_CHARS - `${item.role}: `.length - 3;
      displayNames[0] = displayNames[0].substring(0, maxNameLength) + "...";
      creditText = `${item.role}: ${displayNames[0]}`;
    }
    const colonIndex = creditText.indexOf(':');
    const rolePart = creditText.substring(0, colonIndex + 1); // This includes the colon
    const namesPart = creditText.substring(colonIndex + 1); // This includes the space after the colon
    
    // Add a space after the colon in the SVG
    svgContent += `<text x="${leftX}" y="${y}" class="credit-line">${escapeXml(rolePart)} <tspan class="credit-name">${escapeXml(namesPart.trim())}</tspan></text>`;
    y += lineGap;
  });

  // Add a smaller gap before the stars
  y += crewStarsGap;

  // Rating stars (left-aligned, just below crew info)
  if (rating) {
    svgContent += `<text x="${leftX}" y="${y}" class="rating-stars" text-anchor="start">${escapeXml(getStarString(rating))}</text>`;
    y += lineGap;
  }

  // Add tags if enabled and available
  if (settings.showTags && tags && tags.length > 0) {
    const tagText = tags.map(t => `#${t}`).join(' ');
    svgContent += `<text x="${leftX}" y="${y}" class="tags" text-anchor="start">${escapeXml(tagText)}</text>`;
    y += lineGap;
  }

  // Add watched date if enabled and available
  if (settings.showWatchedDate && watchedDate) {
    svgContent += `<text x="${leftX}" y="${y}" class="watched-date" text-anchor="start">Watched on ${escapeXml(watchedDate)}</text>`;
    y += lineGap;
  }

  // Centered footer (username, --on--, logo)
  const footerY = 1720;
  const footerLogoW = 320;
  const footerLogoH = 44;
  svgContent += `
    <text x="540" y="${footerY}" text-anchor="middle" class="footer-username">${escapeXml(username)}</text>
    <text x="540" y="${footerY + 24}" text-anchor="middle" class="footer-on">— on —</text>
    <image x="${(1080 - footerLogoW) / 2}" y="${footerY + 38}" width="${footerLogoW}" height="${footerLogoH}" xlink:href="${posterboxdLogoDataUrl}" class="logo-footer" />
  `;

  // SVG style (add .title-year for thin Poppins + add tags and watched-date styles)
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <style><![CDATA[
      .logo-title { font-family: 'Poppins', sans-serif; font-size: 80px; font-weight: 700; fill: #fff; }
      .title-year { font-family: 'Poppins', sans-serif; font-size: 60px; font-weight: 300; fill: #fff; }
      .credit-line { font-family: 'Poppins', sans-serif; font-size: 28px; font-weight: 400; fill: #fff; text-anchor: start; }
      .credit-name { font-family: 'Poppins', sans-serif; font-size: 28px; font-weight: 700; fill: #fff; }
      .rating-stars { font-family: 'Poppins', sans-serif; font-size: 54px; fill: #00d474; letter-spacing: 8px; }
      .tags { font-family: 'Poppins', sans-serif; font-size: 24px; fill: #ccc; text-anchor: start; }
      .watched-date { font-family: 'Poppins', sans-serif; font-size: 24px; fill: #aaa; text-anchor: start; }
      .footer-username { fill: #fff; font-size: 30px; font-weight: bold; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .footer-on { fill: #aaa; font-size: 20px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .logo-footer { opacity: 0.9; }
    ]]></style>
    ${svgContent}
  </svg>`;

  // Compose layers
  const layers = [];
  if (settings.gradientOverlay) {
    const gradientSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#fade)"/></svg>`;
    layers.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });
  }
  layers.push({ input: Buffer.from(svg), top: 0, left: 0 });

  return await baseImage.composite(layers).jpeg({ quality: 90 }).toBuffer();
}

async function generatePosterImage(movieData, settings, selectedPosterIndex = 0, selectedBackgroundIndex = 0, selectedLogoIndex = 0) {
  if (settings.posterStyle === 'experimental') {
    return await generateExperimentalPoster(movieData, settings, selectedPosterIndex, selectedBackgroundIndex, selectedLogoIndex);
  }
  const { movie, details, credits, images, tags, username, rating, isLiked, watchedDate, isCustomMode } = movieData;
  
  // Get selected poster and backdrop
  const posters = [movie.poster_path, ...(images.posters?.slice(0, 5).map(p => p.file_path) || [])].filter(Boolean);
  const backdrops = [movie.backdrop_path, ...(images.backdrops?.slice(0, 5).map(b => b.file_path) || [])].filter(Boolean);
  
  const selectedPoster = posters[selectedPosterIndex] ? `https://image.tmdb.org/t/p/w500${posters[selectedPosterIndex]}` : null;
  const selectedBackdrop = backdrops[selectedBackgroundIndex] ? `https://image.tmdb.org/t/p/w1280${backdrops[selectedBackgroundIndex]}` : null;

  const width = 1080, height = 1920;
  const spacing = settings.spacing || {};
  const posterY = spacing.posterTop || 240;
  const titleOffset = spacing.titleBelowPoster || 60;
  const lineHeight = spacing.lineHeight || 72;
  const betweenSections = spacing.betweenSections || 72;
  const backdropBrightness = settings.backdropBrightness ?? 0.6;
  const blurBackground = settings.blurBackdrop ?? true;
  const gradientOverlay = settings.gradientOverlay ?? false;
  const posterScale = settings.posterScale ?? 1.0;
  const footerScale = settings.footerScale ?? 1.0;

  const posterWidth = Math.round(480 * posterScale);
  const posterHeight = Math.round(720 * posterScale);

  let baseImage = selectedBackdrop
    ? sharp(await (await fetch(selectedBackdrop)).arrayBuffer())
        .resize(width, height, { fit: 'cover' })
        .modulate({ brightness: backdropBrightness })
    : sharp({ create: { width, height, channels: 3, background: '#000' } });

  if (blurBackground) baseImage = baseImage.blur(10);

  const posterBuffer = selectedPoster
    ? await sharp(await (await fetch(selectedPoster)).arrayBuffer()).resize(posterWidth, posterHeight).toBuffer()
    : null;

  // Choose the appropriate logo based on mode
  const logoPath = isCustomMode 
    ? path.join(__dirname, 'public/assets/footer-posterboxd.png')
    : path.join(__dirname, 'public/assets/letterboxd-logo.png');
    
  let logoBuffer;
  try {
    logoBuffer = await fs.readFile(logoPath);
  } catch (error) {
    // Fallback to letterboxd logo if custom logo doesn't exist
    logoBuffer = await fs.readFile(path.join(__dirname, 'public/assets/letterboxd-logo.png'));
  }
  
  const logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  // Adjust footer scale for custom mode
  const defaultFooterScale = isCustomMode ? 1.9 : settings.footerScale ?? 1.0;

  const svgParts = [];
  let currentY = posterY + posterHeight + titleOffset;

  const addWrappedLine = (text, className, maxChars = 40, topPad = 0) => {
    currentY += topPad;
    wrapText(text, maxChars).forEach(line => {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="${className}">${escapeXml(line)}</text>`);
      currentY += lineHeight;
    });
    currentY += betweenSections - lineHeight;
  };

  const contentOrder = settings.contentOrder || ['title', 'year', 'genre', 'director', 'actors', 'rating', 'tags', 'music'];
  const title = movieData.title;
  const year = movieData.year;
  const genre = details.genres?.map(g => g.name) || [];
  const director = credits.crew.find(c => c.job === 'Director')?.name || '';
  const musicDirector = credits.crew.find(c => c.job === 'Original Music Composer')?.name || '';
  const actors = credits.cast?.slice(0, 3).map(c => c.name) || [];
  const runtime = details.runtime ? formatRuntime(details.runtime) : null;

  // TV series enhancements
  const isTV = movieData.movie && (movieData.movie.first_air_date || movieData.movie.number_of_seasons);
  const createdBy = details.created_by?.map(c => c.name).join(', ') || '';
  const firstYear = details.first_air_date ? details.first_air_date.substring(0, 4) : '';
  const lastYear = details.last_air_date ? details.last_air_date.substring(0, 4) : '';
  const status = details.status || '';
  // Compose year range with status for TV
  const yearRangeStatus = isTV && firstYear
    ? `${firstYear}${lastYear && lastYear !== firstYear ? `–${lastYear}` : ''}${status ? ` (${status})` : ''}`
    : year || '';
  const numSeasons = details.number_of_seasons;
  const numEpisodes = details.number_of_episodes;
  // Use episode_run_time array for TV runtime (average if array)
  let tvRuntime = '';
  if (isTV && Array.isArray(details.episode_run_time) && details.episode_run_time.length > 0) {
    const avgRuntime = Math.round(details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length);
    tvRuntime = `${avgRuntime}min`;
  }
  // Compose season/episode/runtime info for TV
  const seasonInfo = isTV && numSeasons && numEpisodes
    ? `${tvRuntime ? tvRuntime + ' | ' : ''}${numSeasons} Season${numSeasons > 1 ? 's' : ''} | ${numEpisodes} Episode${numEpisodes > 1 ? 's' : ''}`
    : '';

  for (const key of contentOrder) {
    if (key === 'title' && settings.showTitle) addWrappedLine(title, 'title', 36);
    else if (key === 'year' && settings.showYear && (yearRangeStatus || year)) addWrappedLine(yearRangeStatus, 'year');
    else if (key === 'genre' && settings.showGenre && genre.length && !isTV) addWrappedLine(genre.join(' | '), 'genre');
    else if (key === 'genre' && settings.showGenre && isTV && seasonInfo) addWrappedLine(seasonInfo, 'genre');
    else if (key === 'director' && settings.showDirector && !isTV && director) {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">directed by <tspan font-weight="bold">${escapeXml(director)}</tspan></text>`);
      currentY += lineHeight;
    } else if (key === 'director' && settings.showDirector && isTV && createdBy) {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">created by <tspan font-weight="bold">${escapeXml(createdBy)}</tspan></text>`);
      currentY += lineHeight;
    } else if (key === 'runtime' && settings.showRuntime && runtime && !isTV) addWrappedLine(runtime, 'label');
    else if (key === 'runtime' && settings.showRuntime && isTV && seasonInfo) addWrappedLine(seasonInfo, 'label');
    else if (key === 'music' && settings.showMusic && musicDirector) {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">music by <tspan font-weight="bold">${escapeXml(musicDirector)}</tspan></text>`);
      currentY += lineHeight;
    } else if (key === 'actors' && settings.showActors && actors.length) addWrappedLine(actors.join(', '), 'actors', 60);
    else if (key === 'rating' && settings.showRating && (rating || (isLiked && settings.showHeart))) {
      currentY += Math.round(lineHeight / 2);

      // Show rating stars if available
      if (rating) {
        const full = Math.floor(rating), half = rating % 1 >= 0.5, empty = 5 - full - (half ? 1 : 0);
        const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="stars">${stars}</text>`);
        currentY += lineHeight;
      }

      // Show heart if liked AND showHeart is checked
      if (isLiked && settings.showHeart) {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="heart">♥</text>`);
        currentY += lineHeight;
      }

      currentY += betweenSections - lineHeight;
    } else if (key === 'tags' && settings.showTags && tags.length) {
      wrapText(tags.map(t => `#${t}`).join(' '), 60).forEach(line => {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="tags">${escapeXml(line)}</text>`);
        currentY += lineHeight;
      });
      currentY += betweenSections - lineHeight;
    }
  }

  // Footer with watched date
  const footerY = height - (watchedDate ? 160 : 130); // Adjust footer position if watched date exists
  const logoW = Math.round(160 * defaultFooterScale);
  const logoH = Math.round(22 * defaultFooterScale);
  
  svgParts.push(
    `<text x="${width / 2}" y="${footerY}" text-anchor="middle" class="footer-username">${escapeXml(username)}</text>`,
    `<text x="${width / 2}" y="${footerY + 26}" text-anchor="middle" class="footer-on">— on —</text>`,
    `<image x="${(width - logoW) / 2}" y="${footerY + 40}" width="${logoW}" height="${logoH}" xlink:href="${logoDataUrl}" class="logo-footer" />`
  );

  // Add watched date above footer if available and enabled
  if (watchedDate && settings.showWatchedDate) {
    svgParts.push(
      `<text x="${width / 2}" y="${footerY - 60}" text-anchor="middle" class="watched-date">Watched on ${escapeXml(watchedDate)}</text>`
    );
  }

  const textSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <style>
      .title { fill: #fff; font-size: 54px; font-weight: 700; font-family: 'SF Pro Display', 'Segoe UI', sans-serif; }
      .year, .user { fill: #aaa; font-size: 34px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .genre { fill: #ccc; font-size: 28px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .label { fill: #aaa; font-size: 32px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .bold { fill: #fff; font-weight: bold; font-size: 32px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .actors { fill: #ddd; font-size: 30px; font-style: italic; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .tags { fill: #ccc; font-size: 28px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .stars { fill: #00c030; font-size: 60px; font-family: 'SF Pro Rounded', 'Segoe UI', sans-serif; letter-spacing: 5px; }
      .heart { fill: #ff9010; font-size: 60px; font-family: 'SF Pro Rounded', 'Segoe UI', sans-serif; }
      .footer-username { fill: #fff; font-size: 30px; font-weight: bold; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .footer-on { fill: #aaa; font-size: 20px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
      .watched-date { fill: #666; font-size: 24px; font-style: SF Pro Text; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; opacity: 0.8; }
      .logo-footer { opacity: 0.9; }
    </style>
    ${svgParts.join('\n')}
  </svg>
  `;

  const layers = [];

  if (gradientOverlay) {
    const gradientSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#fade)"/></svg>`;
    layers.push({ input: Buffer.from(gradientSvg), top: 0, left: 0 });
  }

  if (posterBuffer) {
    layers.push({ input: posterBuffer, top: posterY, left: Math.round((width - posterWidth) / 2) });
  }

  layers.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

  return await baseImage.composite(layers).jpeg({ quality: 90 }).toBuffer();
}

app.post('/generate-image', async (req, res) => {
  try {
    console.log('Received request with body:', JSON.stringify(req.body, null, 2));
    
    const { mode, settings = {}, selectedPosterIndex = 0, selectedBackgroundIndex = 0, selectedLogoIndex = 0 } = req.body;
    let movieData;

    if (mode === 'letterboxd') {
      // Letterboxd mode
      const { letterboxdUrl } = req.body;
      const response = await fetch(letterboxdUrl);
      const html = await response.text();
      const $ = cheerio.load(html);      // Try new structure first (2025 format)
      let title = $('.inline-production-masthead .name a').first().text().trim();
      let year = $('.inline-production-masthead .releasedate a').first().text().trim();
      
      // Fallback to old structure if new structure not found
      if (!title) {
        title = $('.film-title-wrapper a').first().text().trim();
        year = $('.film-title-wrapper .metadata a').first().text().trim();
      }
      
      const directorText = $('a[href*="/director/"]').first().text().trim();
      const username = $('.person-summary .name span').first().text().trim();
      const tags = $('ul.tags li a').map((_, el) => $(el).text().trim()).get();
      const rating = ($('.rating-large').attr('class')?.match(/rated-large-(\d+)/)?.[1] || 0) / 2;
      
      // Check if the review is liked (heart present)
      const isLiked = $('.icon-liked').length > 0;

      // Extract watched date
      let watchedDate = null;
      const viewDateElement = $('.view-date.date-links');
      if (viewDateElement.length) {
        const dateLinks = viewDateElement.find('a');
        if (dateLinks.length >= 3) {
          const day = $(dateLinks[0]).text().trim();
          const month = $(dateLinks[1]).text().trim();
          const year = $(dateLinks[2]).text().trim();
          watchedDate = `${day} ${month} ${year}`;
        }
      }

      console.log('🎬 Title:', title);
      console.log('📅 Year:', year);
      console.log('🎞️ Director:', directorText);
      console.log('👤 Username:', username);
      console.log('📅 Watched on:', watchedDate);
      console.log('❤️ Liked:', isLiked);

      const { movie, details, credits, images } = await fetchTmdbData(title, year, directorText);      movieData = {
        title,
        year,
        username,
        tags,
        rating,
        isLiked,
        watchedDate,
        movie,
        details,
        credits,
        images,
        isCustomMode: false,
        mainPoster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        mainBackdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        alternativePosters: images.posters?.slice(0, 5).map(p => `https://image.tmdb.org/t/p/w500${p.file_path}`) || [],
        alternativeBackdrops: images.backdrops?.slice(0, 5).map(b => `https://image.tmdb.org/t/p/w1280${b.file_path}`) || []
      };

      // Log poster information
      console.log(`🖼️ [Posters] Main poster: ${movie.poster_path ? 'Available' : 'None'}`);
      if (movie.poster_path) {
        console.log(`   Main: w500${movie.poster_path}`);
      }
      if (images.posters && images.posters.length > 0) {
        console.log(`🖼️ [Posters] Found ${images.posters.length} alternative poster(s):`);
        images.posters.slice(0, 5).forEach((poster, index) => {
          console.log(`   ${index + 1}: ${poster.iso_639_1 || 'null'} | ${poster.width}x${poster.height} | w500${poster.file_path}`);
        });
      } else {
        console.log(`🖼️ [Posters] No alternative posters available`);
      }

      // Log backdrop information
      console.log(`🌄 [Backdrops] Main backdrop: ${movie.backdrop_path ? 'Available' : 'None'}`);
      if (movie.backdrop_path) {
        console.log(`   Main: w1280${movie.backdrop_path}`);
      }
      if (images.backdrops && images.backdrops.length > 0) {
        console.log(`🌄 [Backdrops] Found ${images.backdrops.length} alternative backdrop(s):`);
        images.backdrops.slice(0, 5).forEach((backdrop, index) => {
          console.log(`   ${index + 1}: ${backdrop.iso_639_1 || 'null'} | ${backdrop.width}x${backdrop.height} | w1280${backdrop.file_path}`);
        });
      } else {
        console.log(`🌄 [Backdrops] No alternative backdrops available`);
      }
      
    } else {
      // Custom mode
      const { mediaId, mediaType, rating, tags, username, watchedDate } = req.body;
      
      let mediaData;
      if (mediaType === 'tv') {
        mediaData = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}?api_key=${TMDB_API_KEY}`).then(res => res.json());
        const credits = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json());
        const images = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}/images?api_key=${TMDB_API_KEY}`).then(res => res.json());
          movieData = {
          title: mediaData.name,
          year: mediaData.first_air_date ? mediaData.first_air_date.substring(0, 4) : '',
          username,
          tags,
          rating,
          isLiked: false,
          watchedDate: watchedDate || null,
          movie: mediaData,
          details: mediaData,
          credits,
          images,
          isCustomMode: true,
          mainPoster: mediaData.poster_path ? `https://image.tmdb.org/t/p/w500${mediaData.poster_path}` : null,
          mainBackdrop: mediaData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${mediaData.backdrop_path}` : null,
          alternativePosters: images.posters?.slice(0, 5).map(p => `https://image.tmdb.org/t/p/w500${p.file_path}`) || [],
          alternativeBackdrops: images.backdrops?.slice(0, 5).map(b => `https://image.tmdb.org/t/p/w1280${b.file_path}`) || []
        };

        // Log poster information for TV series
        console.log(`📺 [TV Posters] Main poster: ${mediaData.poster_path ? 'Available' : 'None'}`);
        if (mediaData.poster_path) {
          console.log(`   Main: w500${mediaData.poster_path}`);
        }
        if (images.posters && images.posters.length > 0) {
          console.log(`📺 [TV Posters] Found ${images.posters.length} alternative poster(s):`);
          images.posters.slice(0, 5).forEach((poster, index) => {
            console.log(`   ${index + 1}: ${poster.iso_639_1 || 'null'} | ${poster.width}x${poster.height} | w500${poster.file_path}`);
          });
        } else {
          console.log(`📺 [TV Posters] No alternative posters available`);
        }

        // Log backdrop information for TV series
        console.log(`🌄 [TV Backdrops] Main backdrop: ${mediaData.backdrop_path ? 'Available' : 'None'}`);
        if (mediaData.backdrop_path) {
          console.log(`   Main: w1280${mediaData.backdrop_path}`);
        }
        if (images.backdrops && images.backdrops.length > 0) {
          console.log(`🌄 [TV Backdrops] Found ${images.backdrops.length} alternative backdrop(s):`);
          images.backdrops.slice(0, 5).forEach((backdrop, index) => {
            console.log(`   ${index + 1}: ${backdrop.iso_639_1 || 'null'} | ${backdrop.width}x${backdrop.height} | w1280${backdrop.file_path}`);
          });
        } else {
          console.log(`🌄 [TV Backdrops] No alternative backdrops available`);
        }
      } else {
        const movie = await fetch(`https://api.themoviedb.org/3/movie/${mediaId}?api_key=${TMDB_API_KEY}`).then(res => res.json());
        const credits = await fetch(`https://api.themoviedb.org/3/movie/${mediaId}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json());
        const images = await fetch(`https://api.themoviedb.org/3/movie/${mediaId}/images?api_key=${TMDB_API_KEY}`).then(res => res.json());
          movieData = {
          title: movie.title,
          year: movie.release_date ? movie.release_date.substring(0, 4) : '',
          username,
          tags,
          rating,
          isLiked: false,
          watchedDate: watchedDate || null,
          movie,
          details: movie,
          credits,
          images,
          isCustomMode: true,
          mainPoster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          mainBackdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
          alternativePosters: images.posters?.slice(0, 5).map(p => `https://image.tmdb.org/t/p/w500${p.file_path}`) || [],
          alternativeBackdrops: images.backdrops?.slice(0, 5).map(b => `https://image.tmdb.org/t/p/w1280${b.file_path}`) || []
        };

        // Log poster information for movies
        console.log(`🎬 [Movie Posters] Main poster: ${movie.poster_path ? 'Available' : 'None'}`);
        if (movie.poster_path) {
          console.log(`   Main: w500${movie.poster_path}`);
        }
        if (images.posters && images.posters.length > 0) {
          console.log(`🎬 [Movie Posters] Found ${images.posters.length} alternative poster(s):`);
          images.posters.slice(0, 5).forEach((poster, index) => {
            console.log(`   ${index + 1}: ${poster.iso_639_1 || 'null'} | ${poster.width}x${poster.height} | w500${poster.file_path}`);
          });
        } else {
          console.log(`🎬 [Movie Posters] No alternative posters available`);
        }

        // Log backdrop information for movies
        console.log(`🌄 [Movie Backdrops] Main backdrop: ${movie.backdrop_path ? 'Available' : 'None'}`);
        if (movie.backdrop_path) {
          console.log(`   Main: w1280${movie.backdrop_path}`);
        }
        if (images.backdrops && images.backdrops.length > 0) {
          console.log(`🌄 [Movie Backdrops] Found ${images.backdrops.length} alternative backdrop(s):`);
          images.backdrops.slice(0, 5).forEach((backdrop, index) => {
            console.log(`   ${index + 1}: ${backdrop.iso_639_1 || 'null'} | ${backdrop.width}x${backdrop.height} | w1280${backdrop.file_path}`);
          });
        } else {
          console.log(`🌄 [Movie Backdrops] No alternative backdrops available`);
        }
      }
    }

    // Generate a unique session ID and store the movie data
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    movieDataStore.set(sessionId, movieData);

    // Clean up old sessions (keep only last 100)
    if (movieDataStore.size > 100) {
      const firstKey = movieDataStore.keys().next().value;
      movieDataStore.delete(firstKey);
    }

    const finalBuffer = await generatePosterImage(movieData, settings, selectedPosterIndex, selectedBackgroundIndex, selectedLogoIndex);
      // After movieData is set, add logos to the response for the frontend
    let alternativeLogos = [];
    if (settings.posterStyle === 'experimental' && movieData.images && movieData.images.logos) {
      console.log(`🖼️ [Logos] Processing ${movieData.images.logos.length} logo(s) for frontend:`);
      alternativeLogos = movieData.images.logos.map((logo, index) => {
        console.log(`   ${index}: ${logo.iso_639_1 || 'null'} | ${logo.width}x${logo.height} | w500${logo.file_path}`);
        return {
          url: `https://image.tmdb.org/t/p/w500${logo.file_path}`,
          language: logo.iso_639_1,
          width: logo.width,
          height: logo.height
        };
      });
    }

    // Fix: Create a properly scoped variable for alternativeBackdrops
    let alternativeBackdrops = movieData.alternativeBackdrops || [];
      // For experimental, send all backdrops + posters as backgrounds
    if (settings.posterStyle === 'experimental' && movieData.images) {
      const sorted = sortBackdropsByQuality(movieData.images.backdrops || []);
      let backgrounds = sorted.map(b => `https://image.tmdb.org/t/p/w1280${b.file_path}`);
      
      // Add posters as background options (use w1280 for consistency with backdrops)
      const posters = [movieData.movie.poster_path, ...(movieData.images.posters?.slice(0, 5).map(p => p.file_path) || [])].filter(Boolean);
      posters.forEach(p => {
        const posterUrl = `https://image.tmdb.org/t/p/w1280${p}`;
        if (!backgrounds.includes(posterUrl)) backgrounds.push(posterUrl);
      });
      
      alternativeBackdrops = backgrounds;
      movieData.alternativeBackdrops = backgrounds;
        console.log(`🎨 [Experimental Backgrounds] Combined ${sorted.length} backdrop(s) + ${posters.length} poster(s) = ${backgrounds.length} total background options`);
      console.log(`🖼️ [Experimental Posters] Available for background use: ${posters.length} poster(s)`);
    }

    console.log('Processing completed, sending response');
    res.json({
      imageBuffer: finalBuffer,
      sessionId: sessionId,
      movieData: {
        mainPoster: movieData.mainPoster,
        mainBackdrop: movieData.mainBackdrop,
        alternativePosters: movieData.alternativePosters,
        alternativeBackdrops: alternativeBackdrops,
        alternativeLogos: alternativeLogos,
        alternativeBackdropsMeta: movieData.alternativeBackdropsMeta
      }
    });

  } catch (err) {
    console.error('❌ Error generating poster:', err);
    // More detailed error response
    res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.post('/regenerate-image', async (req, res) => {
  try {
    const { sessionId, settings, selectedPosterIndex = 0, selectedBackgroundIndex = 0, selectedLogoIndex = 0 } = req.body;
    
    // Retrieve movie data from store
    const movieData = movieDataStore.get(sessionId);
    if (!movieData) {
      return res.status(400).json({ error: 'Session expired. Please generate a new image.' });
    }
    
    const finalBuffer = await generatePosterImage(movieData, settings, selectedPosterIndex, selectedBackgroundIndex, selectedLogoIndex);
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(finalBuffer);

  } catch (err) {
    console.error('❌ Error regenerating poster:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('🚀 Server running on port 3000'));

//Server-alive
app.get('/ping', (req, res) => {
  res.send('pong');
});
//Server-alive
app.get('/ping', (req, res) => {
  res.send('pong');
});

