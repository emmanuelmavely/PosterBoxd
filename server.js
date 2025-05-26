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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TMDB_API_KEY = process.env.TMDB_API_KEY;

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
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
  const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const candidates = searchData.results;

  if (!candidates || !candidates.length) throw new Error('No TMDb results');

  for (const movie of candidates) {
    const creditsUrl = `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`;
    const credits = await fetch(creditsUrl).then(res => res.json());
    const director = credits.crew.find(c => c.job === 'Director')?.name || '';

    if (expectedDirector && director.toLowerCase().includes(expectedDirector.toLowerCase())) {
      const details = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`).then(res => res.json());
      return {
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
        release_date: movie.release_date || '',
        genre: details.genres?.map(g => g.name) || [],
        director,
        musicDirector: credits.crew.find(c => c.job === 'Original Music Composer')?.name || '',
        actors: credits.cast?.slice(0, 3).map(c => c.name) || []
      };
    }
  }

  // fallback to top result
  const fallback = candidates[0];
  const fallbackCredits = await fetch(`https://api.themoviedb.org/3/movie/${fallback.id}/credits?api_key=${TMDB_API_KEY}`).then(r => r.json());
  const fallbackDetails = await fetch(`https://api.themoviedb.org/3/movie/${fallback.id}?api_key=${TMDB_API_KEY}`).then(r => r.json());

  return {
    poster: fallback.poster_path ? `https://image.tmdb.org/t/p/w500${fallback.poster_path}` : null,
    backdrop: fallback.backdrop_path ? `https://image.tmdb.org/t/p/w1280${fallback.backdrop_path}` : null,
    release_date: fallback.release_date || '',
    genre: fallbackDetails.genres?.map(g => g.name) || [],
    director: fallbackCredits.crew.find(c => c.job === 'Director')?.name || '',
    musicDirector: fallbackCredits.crew.find(c => c.job === 'Original Music Composer')?.name || '',
    actors: fallbackCredits.cast?.slice(0, 3).map(c => c.name) || []
  };
}



app.post('/generate-image', async (req, res) => {
  try {
    const { letterboxdUrl, settings = {} } = req.body;
    const response = await fetch(letterboxdUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('.film-title-wrapper a').first().text().trim();
    const yearGuess = $('.film-title-wrapper .metadata a').first().text().trim();


    // ✅ Extract director from meta tag or film page (fallback to text under credit)
    const directorText = $('a[href*="/director/"]').first().text().trim();

    console.log('Letterboxd parsed title:', title);
    console.log('Year:', yearGuess);
    console.log('Username:', username);

    // ✅ Now pass these to fetchTmdbData
    const tmdb = await fetchTmdbData(title, yearGuess, directorText);

    const rating = ($('.rating-large').attr('class')?.match(/rated-large-(\d+)/)?.[1] || 0) / 2;
    const match = response.url.match(/letterboxd\.com\/([^\/]+)/);
    const username = $('.person-summary .name span').first().text().trim();


    const tags = [];
    $('ul.tags li a').each((_, el) => tags.push($(el).text().trim()));



    const width = 1080, height = 1920;
    const spacing = settings.spacing || {};
    const posterY = spacing.posterTop || 240;
    const titleOffset = spacing.titleBelowPoster || 60;
    const lineHeight = spacing.lineHeight || 72;
    const betweenSections = spacing.betweenSections || 72;
    const backdropBrightness = settings.backdropBrightness ?? 0.6;
    const blurBackground = settings.blurBackdrop ?? true;
    const posterScale = settings.posterScale ?? 1.0;
    const gradientOverlay = settings.gradientOverlay ?? false;
    const posterWidth = Math.round(480 * posterScale);
    const posterHeight = Math.round(720 * posterScale);

    let baseImage = tmdb.backdrop
      ? sharp(await (await fetch(tmdb.backdrop)).arrayBuffer())
          .resize(width, height, { fit: 'cover' })
          .modulate({ brightness: backdropBrightness })
      : sharp({ create: { width, height, channels: 3, background: '#000' } });

    if (blurBackground) {
      baseImage = baseImage.blur(10);
    }

    const posterBuffer = tmdb.poster
      ? await sharp(await (await fetch(tmdb.poster)).arrayBuffer())
          .resize(posterWidth, posterHeight)
          .toBuffer()
      : null;

    const logoPath = path.join(__dirname, 'public/assets/letterboxd-logo.png');
    const logoBuffer = await fs.readFile(logoPath);
    const logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    const svgParts = [];

    // Optional gradient overlay
    if (gradientOverlay) {
      svgParts.push(`
        <defs>
        <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#000" stop-opacity="0.75"/>
          <stop offset="70%" stop-color="#000" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </linearGradient>

        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bottomFade)" />
      `);
    }

    let currentY = posterY + posterHeight + titleOffset;

    const addWrappedLine = (text, className, maxChars = 40, topPad = 0) => {
      currentY += topPad; // add space above
      wrapText(text, maxChars).forEach(line => {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="${className}">${escapeXml(line)}</text>`);
        currentY += lineHeight;
      });
      currentY += betweenSections - lineHeight;
    };
    
    const titleLength = title.length;

    const titleFontSize = titleLength > 40 ? 52 : 64;

    svgParts.push(`
      <style>
        .title {
          fill: #fff;
          font-size: ${titleFontSize}px;
          font-weight: 700;
          font-family: 'SF Pro Display', 'Segoe UI', sans-serif;
        }
      </style>
    `);

        const contentOrder = settings.contentOrder || ['title', 'year', 'genre', 'director', 'music', 'actors', 'rating', 'tags'];

    for (const key of contentOrder) {
      if (key === 'title' && settings.showTitle) {
        addWrappedLine(title, 'title', 32);
      } else if (key === 'year' && settings.showYear && tmdb.release_date) {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="year">${tmdb.release_date.slice(0, 4)}</text>`);
        currentY += lineHeight + betweenSections - lineHeight;
      } else if (key === 'genre' && settings.showGenre && tmdb.genre.length) {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="genre">${tmdb.genre.join(' | ')}</text>`);
        currentY += lineHeight + betweenSections - lineHeight;
      } else if (key === 'director' && settings.showDirector && tmdb.director) {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">directed by <tspan class="bold">${escapeXml(tmdb.director)}</tspan></text>`);
        currentY += lineHeight + betweenSections - lineHeight;
      } else if (key === 'music' && settings.showMusic && tmdb.musicDirector) {
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="label">music by <tspan class="bold">${escapeXml(tmdb.musicDirector)}</tspan></text>`);
        currentY += lineHeight + betweenSections - lineHeight;
      } else if (key === 'actors' && settings.showActors && tmdb.actors.length) {
        const actorLine = tmdb.actors.join(', ');
        wrapText(actorLine, 60).forEach(line => {
          svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="actors">${escapeXml(line)}</text>`);
          currentY += lineHeight;
        });
        currentY += betweenSections - lineHeight;
      } else if (key === 'rating' && settings.showRating && rating) {
        const full = Math.floor(rating), half = rating % 1 >= 0.5, empty = 5 - full - (half ? 1 : 0);
        let stars = '★'.repeat(full);
        if (half) {
          stars += '<tspan font-size="48"> ½ </tspan>'; // smaller and aligned
        }
        stars += '☆'.repeat(empty);
        svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="stars">${stars}</text>`);
        currentY += Math.round(lineHeight / 2); // add spacing above rating
        currentY += lineHeight + betweenSections - lineHeight;
        
      } else if (key === 'tags' && settings.showTags && tags.length) {
        const tagLine = tags.map(t => `#${t}`).join(' ');
        wrapText(tagLine, 60).forEach(line => {
          svgParts.push(`<text x="${width / 2}" y="${currentY}" text-anchor="middle" class="tags">${escapeXml(line)}</text>`);
          currentY += lineHeight;
        });
        currentY += betweenSections - lineHeight;
      }
    }

    // Footer (stacked layout)
    const scale = settings.footerScale || 1.0;
    const footerY = height - 130;
    const footerTextSize = 30 * scale;
    const footerSubTextSize = 20 * scale;
    const logoWidth = 160 * scale;
    const logoHeight = 22 * scale;
    const logoY = footerY + 40 * scale;
    
    svgParts.push(
      `<text x="${width / 2}" y="${footerY}" text-anchor="middle" style="font-size:${footerTextSize}px" class="footer-username">${escapeXml(username)}</text>`,
      `<text x="${width / 2}" y="${footerY + 26 * scale}" text-anchor="middle" style="font-size:${footerSubTextSize}px" class="footer-on">— on —</text>`,
      `<image x="${(width - logoWidth) / 2}" y="${logoY}" width="${logoWidth}" height="${logoHeight}" xlink:href="${logoDataUrl}" class="logo-footer" />`
    );
    

    const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <style>
        .title { fill: #fff; font-size: 54px; font-weight: 700; font-family: 'SF Pro Display', 'Segoe UI', sans-serif; }
        .year, .user { fill: #aaa; font-size: 34px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .genre { fill: #ccc; font-size: 28px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .label { fill: #aaa; font-size: 32px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .bold { fill: #fff; font-weight: bold; font-size: 32px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .actors { fill: #ddd; font-size: 30px; font-style: italic; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .tags { fill: #ccc; font-size: 28px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .stars { fill: gold; font-size: 60px; font-family: 'SF Pro Rounded', 'Segoe UI', sans-serif; letter-spacing: 5px; }
        .footer-username { fill: #fff; font-size: 30px; font-weight: bold; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .footer-on { fill: #aaa; font-size: 20px; font-family: 'SF Pro Text', 'Segoe UI', sans-serif; }
        .logo-footer { opacity: 0.9; }
      </style>
      ${svgParts.join('\n')}
    </svg>`;

    const layers = [{ input: Buffer.from(svgText), top: 0, left: 0 }];
    if (posterBuffer) {
      layers.unshift({ input: posterBuffer, top: posterY, left: Math.round((width - posterWidth) / 2) });
    }

    const finalBuffer = await baseImage.composite(layers).jpeg({ quality: 90 }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(finalBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(process.env.PORT || 3000, () => console.log('Server running on port 3000'));
