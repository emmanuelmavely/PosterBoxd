// TMDb API functions extracted for better organization
import fetch from 'node-fetch';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Search for both movies and TV shows
 */
export async function searchMedia(query) {
  console.log('\n🔍 === SEARCH REQUEST ===');
  console.log('📝 User Input:', {
    query: query,
    timestamp: new Date().toISOString()
  });
  
  try {
    console.log('\n📡 TMDB API Requests:');
    console.log('  → Movie Search:', `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`);
    console.log('  → TV Search:', `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}`);
    
    // Search both movies and TV shows
    const [movieResults, tvResults] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json())
    ]);
    
    console.log('\n📊 TMDB Search Results:');
    console.log('  🎬 Movies found:', movieResults.results?.length || 0);
    console.log('  📺 TV shows found:', tvResults.results?.length || 0);
    
    // Combine results with media_type identifier
    const combinedResults = [
      ...(movieResults.results || []).map(item => ({ ...item, media_type: 'movie' })),
      ...(tvResults.results || []).map(item => ({ ...item, media_type: 'tv' }))
    ];
    
    console.log('  📋 Total combined results:', combinedResults.length);
    
    // Get detailed information for each result
    const detailedResults = await Promise.all(
      combinedResults.slice(0, 10).map(async (item) => {
        try {
          if (item.media_type === 'movie') {
            const [credits, details] = await Promise.all([
              fetch(`https://api.themoviedb.org/3/movie/${item.id}/credits?api_key=${TMDB_API_KEY}`).then(r => r.json()),
              fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}`).then(r => r.json())
            ]);
            
            const director = credits.crew.find(c => c.job === 'Director')?.name || '';
            const cast = credits.cast.slice(0, 5).map(c => c.name);
            
            return {
              ...item,
              director,
              cast,
              runtime: details.runtime,
              genres: details.genres?.map(g => g.name) || []
            };
          } else {
            // TV series
            const [credits, details] = await Promise.all([
              fetch(`https://api.themoviedb.org/3/tv/${item.id}/credits?api_key=${TMDB_API_KEY}`).then(r => r.json()),
              fetch(`https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}`).then(r => r.json())
            ]);
            
            const creator = details.created_by?.[0]?.name || '';
            const cast = credits.cast.slice(0, 5).map(c => c.name);
            
            return {
              ...item,
              creator,
              cast,
              number_of_seasons: details.number_of_seasons,
              number_of_episodes: details.number_of_episodes,
              episode_run_time: details.episode_run_time?.[0],
              seasons: details.number_of_seasons,
              status: details.status,
              genres: details.genres?.map(g => g.name) || []
            };
          }
        } catch (error) {
          console.error(`Error fetching details for ${item.media_type} ${item.id}:`, error);
          return item;
        }
      })
    );
    
    return detailedResults.filter(Boolean);
  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

/**
 * Get detailed information for a specific movie or TV show
 */
export async function getMediaDetails(id, mediaType) {
  try {
    const baseUrl = mediaType === 'movie' 
      ? `https://api.themoviedb.org/3/movie/${id}`
      : `https://api.themoviedb.org/3/tv/${id}`;
    
    const [details, credits, images] = await Promise.all([
      fetch(`${baseUrl}?api_key=${TMDB_API_KEY}`).then(r => r.json()),
      fetch(`${baseUrl}/credits?api_key=${TMDB_API_KEY}`).then(r => r.json()),
      fetch(`${baseUrl}/images?api_key=${TMDB_API_KEY}`).then(r => r.json())
    ]);
    
    return { details, credits, images };
  } catch (error) {
    console.error(`Error fetching details for ${mediaType} ${id}:`, error);
    throw error;
  }
}

/**
 * Get season details for a TV series
 */
export async function getSeasonDetails(seriesId, seasonNumber) {
  try {
    const [seasonDetails, seasonCredits] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`).then(r => r.json()),
      fetch(`https://api.themoviedb.org/3/tv/${seriesId}/season/${seasonNumber}/credits?api_key=${TMDB_API_KEY}`).then(r => r.json())
    ]);
    
    return { seasonDetails, seasonCredits };
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} details for series ${seriesId}:`, error);
    throw error;
  }
}

/**
 * Search for movies by title and director (for Letterboxd matching)
 */
export async function searchMovieByTitleAndDirector(title, year, expectedDirector) {
  const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`;
  
  console.log(`\n🔍 TMDb Movie Search: "${title}" (${year || 'no year'})`);
  console.log(`📡 Search URL: ${searchUrl}`);
  
  const searchData = await fetch(searchUrl).then(res => res.json());
  const results = searchData.results || [];
  
  console.log(`📊 Search Results: Found ${results.length} movies`);
  
  if (results.length > 0) {
    console.log('🎬 Top Results:');
    results.slice(0, 3).forEach((movie, index) => {
      console.log(`  ${index + 1}. "${movie.title}" (${movie.release_date?.substring(0, 4) || 'Unknown year'})`);
    });
  }

  for (const movie of results) {
    console.log(`\n🔍 Checking movie: "${movie.title}" (${movie.release_date?.substring(0, 4)})`);
    console.log(`📡 Fetching credits for movie ID: ${movie.id}`);
    
    const credits = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json());
    const director = credits.crew.find(c => c.job === 'Director')?.name || '';
    
    console.log(`🎭 Director found: ${director || 'None'}`);
    
    if (expectedDirector && director.toLowerCase().includes(expectedDirector.toLowerCase())) {
      console.log(`✅ Director match found! "${director}" matches "${expectedDirector}"`);
      console.log(`📡 Fetching detailed data for "${movie.title}"`);
      
      const [details, images] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`).then(res => res.json()),
        fetch(`https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${TMDB_API_KEY}`).then(res => res.json())
      ]);
      
      console.log('📋 Complete Data Retrieved:');
      console.log('  🎬 Movie Details:', {
        title: movie.title,
        year: movie.release_date?.substring(0, 4),
        runtime: details.runtime ? `${details.runtime}min` : 'N/A',
        genres: details.genres?.map(g => g.name).join(', ') || 'N/A'
      });
      console.log('  🎭 Credits:', {
        director: director,
        cast_count: credits.cast?.length || 0,
        crew_count: credits.crew?.length || 0,
        top_cast: credits.cast?.slice(0, 3).map(c => c.name).join(', ') || 'N/A'
      });
      console.log('  🖼️ Images:', {
        posters: images.posters?.length || 0,
        backdrops: images.backdrops?.length || 0,
        logos: images.logos?.length || 0
      });
      
      return { movie, details, credits, images };
    } else if (expectedDirector) {
      console.log(`❌ Director mismatch: "${director}" ≠ "${expectedDirector}"`);
    }
  }

  if (!results.length) {
    console.error('❌ No TMDb results found');
    throw new Error('No TMDb match found');
  }
  
  console.log('⚠️ No director match found, using fallback (first result)');
  const fallback = results[0];
  console.log(`📡 Fetching fallback data for "${fallback.title}"`);
  
  const [details, credits, images] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/${fallback.id}?api_key=${TMDB_API_KEY}`).then(res => res.json()),
    fetch(`https://api.themoviedb.org/3/movie/${fallback.id}/credits?api_key=${TMDB_API_KEY}`).then(res => res.json()),
    fetch(`https://api.themoviedb.org/3/movie/${fallback.id}/images?api_key=${TMDB_API_KEY}`).then(res => res.json())
  ]);
  
  console.log('📋 Fallback Data Retrieved:');
  console.log('  🎬 Movie:', fallback.title);
  console.log('  🎭 Director:', credits.crew.find(c => c.job === 'Director')?.name || 'Unknown');
  console.log('  🖼️ Assets:', `${images.posters?.length || 0} posters, ${images.backdrops?.length || 0} backdrops`);
  
  return { movie: fallback, details, credits, images };
}