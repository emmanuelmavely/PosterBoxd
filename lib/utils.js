// Utility functions for PosterBoxd
import fs from 'fs/promises';
import path from 'path';

/**
 * Convert runtime to hours and minutes format
 */
export function formatRuntime(runtime) {
  if (!runtime) return '';
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return `${hours}h ${minutes}min`;
}

/**
 * Sort backdrops by quality (resolution, aspect ratio, vote average)
 */
export function sortBackdropsByQuality(backdrops) {
  if (!backdrops || !backdrops.length) return [];
  
  const scoredBackdrops = backdrops.map(backdrop => {
    let qualityScore = 0;
    
    // Resolution score
    qualityScore += (backdrop.width * backdrop.height) / 100000;
    
    // Aspect ratio preference (16:9 = 1.78)
    const aspectRatio = backdrop.width / backdrop.height;
    const aspectDiff = Math.abs(aspectRatio - 1.78);
    qualityScore -= aspectDiff * 10;
    
    // Vote scores
    if (backdrop.vote_average) qualityScore += backdrop.vote_average * 5;
    if (backdrop.vote_count) qualityScore += Math.min(backdrop.vote_count / 10, 5);
    
    return { ...backdrop, qualityScore };
  });
  
  return scoredBackdrops
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .map(({ qualityScore, ...backdrop }) => backdrop);
}

/**
 * Sort posters by quality
 */
export function sortPostersByQuality(posters) {
  if (!posters || !posters.length) return [];
  
  const scoredPosters = posters.map(poster => {
    let qualityScore = 0;
    
    // Resolution score
    qualityScore += (poster.width * poster.height) / 100000;
    
    // Vote scores
    if (poster.vote_average) qualityScore += poster.vote_average * 5;
    if (poster.vote_count) qualityScore += Math.min(poster.vote_count / 10, 5);
    
    return { ...poster, qualityScore };
  });
  
  return scoredPosters
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .map(({ qualityScore, ...poster }) => poster);
}

/**
 * Generate a unique session ID
 */
export function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Check if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely get nested object property
 */
export function safeGet(obj, path, defaultValue = null) {
  return path.split('.').reduce((current, key) => 
    current && current[key] !== undefined ? current[key] : defaultValue, obj);
}

/**
 * Validate TMDb API key
 */
export function validateTmdbApiKey() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || apiKey === 'dummy_key_for_testing') {
    throw new Error('TMDb API key is required. Please set TMDB_API_KEY in your .env file.');
  }
  return apiKey;
}

/**
 * Format TV series status and year range
 */
export function formatTvSeriesInfo(details) {
  const isTV = details.first_air_date || details.number_of_seasons;
  if (!isTV) return null;
  
  const startYear = details.first_air_date ? new Date(details.first_air_date).getFullYear() : null;
  const endYear = details.last_air_date ? new Date(details.last_air_date).getFullYear() : null;
  const status = details.status;
  
  let yearRange = '';
  if (startYear) {
    if (endYear && endYear !== startYear && status !== 'Returning Series') {
      yearRange = `${startYear}–${endYear}`;
    } else {
      yearRange = `${startYear}–`;
    }
  }
  
  const statusText = status === 'Ended' ? '(Ended)' : status === 'Canceled' ? '(Canceled)' : '';
  
  return {
    yearRange,
    statusText,
    isEnded: status === 'Ended' || status === 'Canceled'
  };
}

/**
 * Format season and episode information
 */
export function formatSeasonInfo(details) {
  const numSeasons = details.number_of_seasons;
  const numEpisodes = details.number_of_episodes;
  const avgRuntime = details.episode_run_time?.[0];
  
  let info = [];
  
  if (avgRuntime) {
    info.push(`${avgRuntime}min`);
  }
  
  if (numSeasons) {
    info.push(`${numSeasons} Season${numSeasons > 1 ? 's' : ''}`);
  }
  
  if (numEpisodes) {
    info.push(`${numEpisodes} Episode${numEpisodes > 1 ? 's' : ''}`);
  }
  
  return info.join(' | ');
}

/**
 * Create safe filename from string
 */
export function createSafeFilename(str, maxLength = 50) {
  return str
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, maxLength);
}