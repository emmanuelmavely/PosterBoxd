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

async function generatePosterImage(movieData, settings, selectedPosterIndex = 0, selectedBackgroundIndex = 0) {
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

  for (const key of contentOrder) {
    if (key === 'title' && settings.showTitle) addWrappedLine(title, 'title', 36);
    else if (key === 'year' && settings.showYear && year) addWrappedLine(year, 'year');
    else if (key === 'genre' && settings.showGenre && genre.length) addWrappedLine(genre.join(' | '), 'genre');
    else if (key === 'director' && settings.showDirector && director) {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">directed by <tspan font-weight="bold">${escapeXml(director)}</tspan></text>`);
      currentY += lineHeight;
    } else if (key === 'runtime' && settings.showRuntime && runtime) addWrappedLine(runtime, 'label');
    else if (key === 'music' && settings.showMusic && musicDirector) {
      svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">music by <tspan font-weight="bold">${escapeXml(musicDirector)}</tspan></text>`);
      currentY += lineHeight;
    } else if (key === 'actors' && settings.showActors && actors.length) addWrappedLine(actors.join(', '), 'actors', 60);
    else if (key === 'rating' && settings.showRating && (rating || isLiked)) {
      currentY += Math.round(lineHeight / 2);
      
      // Show rating stars if available
      if (rating) {
        const full = Math.floor(rating), half = rating % 1 >= 0.5, empty = 5 - full - (half ? 1 : 0);
        const stars = '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="stars">${stars}</text>`);
        currentY += lineHeight;
      }
      
      // Show heart if liked
      if (isLiked) {
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
    const { mode, settings = {} } = req.body;
    let movieData;

    if (mode === 'letterboxd') {
      // Letterboxd mode
      const { letterboxdUrl } = req.body;
      const response = await fetch(letterboxdUrl);
      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('.film-title-wrapper a').first().text().trim();
      const year = $('.film-title-wrapper .metadata a').first().text().trim();
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

      const { movie, details, credits, images } = await fetchTmdbData(title, year, directorText);

      movieData = {
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

    const finalBuffer = await generatePosterImage(movieData, settings);
    
    res.json({
      imageBuffer: finalBuffer,
      sessionId: sessionId,
      movieData: {
        mainPoster: movieData.mainPoster,
        mainBackdrop: movieData.mainBackdrop,
        alternativePosters: movieData.alternativePosters,
        alternativeBackdrops: movieData.alternativeBackdrops
      }
    });

  } catch (err) {
    console.error('❌ Error generating poster:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/regenerate-image', async (req, res) => {
  try {
    const { sessionId, settings, selectedPosterIndex = 0, selectedBackgroundIndex = 0 } = req.body;
    
    // Retrieve movie data from store
    const movieData = movieDataStore.get(sessionId);
    if (!movieData) {
      return res.status(400).json({ error: 'Session expired. Please generate a new image.' });
    }
    
    const finalBuffer = await generatePosterImage(movieData, settings, selectedPosterIndex, selectedBackgroundIndex);
    
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

