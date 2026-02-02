# PosterBoxd

A web app to generate stylish, customizable posters from your Letterboxd reviews or any movie/TV series using TMDb data.

![PosterBoxd Demo](public/assets/demo.png)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Dual Input Modes](#dual-input-modes)
  - [Two Poster Styles](#two-poster-styles)
  - [TV Series Support](#tv-series-support)
  - [Multi-Asset Selection](#multi-asset-selection)
  - [Advanced Customization](#advanced-customization)
  - [4-Step User Workflow](#4-step-user-workflow)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Deployment](#deployment)
- [API Endpoints](#api-endpoints)
- [Technical Details](#technical-details)
- [License](#license)

---

## Overview

PosterBoxd is a powerful web application that transforms your Letterboxd film reviews into beautiful, shareable poster artwork. With support for both movies and TV series, it offers two distinct poster styles (Classic and Experimental), extensive customization options, and seamless integration with The Movie Database (TMDb) API.

**Key Highlights:**
- 🎬 Import reviews directly from Letterboxd URLs
- 🔍 Search and customize any movie or TV series from TMDb
- 🎨 Two poster styles: Classic (metadata-focused) and Experimental (logo/credits-focused)
- 📺 Full TV series support with season/episode selection
- ⚙️ Advanced customization: drag-to-reorder metadata, visual controls, multiple image variants
- 📱 Modern, responsive iOS-style dark mode UI
- 🖼️ High-quality PNG export (1080x1920)

---

## Features

### Dual Input Modes

**Letterboxd Mode:**
- Paste your Letterboxd review URL or share text
- Automatically extracts: title, year, director, rating, tags, username, watched date, and "liked" status
- Scrapes Letterboxd page using Cheerio for accurate data extraction
- Fetches high-quality posters and backdrops from TMDb

**Custom Search Mode:**
- Search for any movie or TV series by title
- Select from search results with poster previews
- Manually set rating (star picker), tags, username, and watched date
- Full control over all metadata fields

### Two Poster Styles

**Classic Style:**
- Traditional layout with poster image on the left
- Metadata sections: Title, Director/Creator, Cast, Genre/Season Info, Runtime, Rating, Tags
- Drag-and-drop to reorder any metadata field
- Toggle visibility of individual fields via checkboxes
- Footer with username and PosterBoxd branding

**Experimental Style:**
- Movie/show logo at the top (when available from TMDb)
- Credits-focused layout (cast and crew information)
- Rating stars display
- Hashtags and watched date support
- Poster/backdrop can be positioned as full background
- Modern, poster-art aesthetic

### TV Series Support

- **Year Range:** Displays start–end years with status (e.g., `2017–2022 (Ended)`)
- **Season/Episode Selection:** Choose specific season and episode
- **Runtime Info:** Shows average episode runtime (e.g., `45min`)
- **Season Count:** Displays number of seasons and total episodes (e.g., `4 Seasons | 12 Episodes`)
- **Creator Attribution:** Shows "Created by" instead of "Directed by" for TV series
- **Episode-Specific Metadata:** Select individual episodes to display their air date and details

### Multi-Asset Selection

**Poster Images:**
- 5+ poster variants from TMDb (sorted by quality, resolution, and votes)
- Switch between options with live preview
- Independent from backdrop selection

**Backdrops:**
- 5+ backdrop/background images
- Quality-sorted for best visual results
- Apply blur, gradient overlay, and brightness adjustments

**Title Logos (Experimental Style):**
- Multiple logo variants (when available)
- PNG-format logos for clean overlay on backdrops

### Advanced Customization

**Metadata Tab:**
- **Drag-to-Reorder:** Reposition any metadata field (title, year, director, cast, genre, runtime, tags, rating, heart, watched date)
- **Toggle Visibility:** Show/hide fields using checkboxes
- **Heart Icon:** Only appears if review is "liked" AND "Heart (if liked)" setting is enabled

**Visual Tab:**
- **Backdrop Blur:** Toggle blur effect on background
- **Gradient Overlay:** Add black gradient for better text readability
- **Brightness Control:** Adjust backdrop brightness (0–100%)
- **Poster Scale:** Resize poster image independently
- **Footer Scale:** Adjust logo size in footer
- **Spacing Controls:** Fine-tune poster top margin, title offset, line height, and section spacing

### 4-Step User Workflow

1. **Step 1 - Search:** Input Letterboxd URL or search for media by title
2. **Step 2 - Design:** Choose between Classic or Experimental poster style
3. **Step 3 - Details:** Customize metadata (rating, tags, username, watched date, season/episode)
4. **Step 4 - Poster:** Preview and customize visual elements (poster, backdrop, logo, settings)

**Interactive Features:**
- Breadcrumb navigation between steps
- Live preview updates
- iOS-style UI with smooth animations
- Mobile-responsive design

---

## Getting Started

### Prerequisites

- **Node.js** (v16 or higher recommended)
- **NPM** (comes with Node.js)
- **TMDb API Key** (free from [The Movie Database](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository:**

```sh
git clone https://github.com/emmanuelmavely/PosterBoxd.git
cd PosterBoxd
```

2. **Install dependencies:**

```sh
npm install
```

3. **Set up environment variables:**

Create a `.env` file in the project root:

```env
TMDB_API_KEY=your_tmdb_api_key_here
PORT=3000
```

To get a TMDb API key:
- Create a free account at [themoviedb.org](https://www.themoviedb.org/)
- Go to Settings → API → Request an API Key
- Copy your API Key (v3 auth)

### Running Locally

**Start the server:**

```sh
node server.js
```

**Open in your browser:**

Visit [http://localhost:3000](http://localhost:3000)

The app will be ready to use!

---

## Deployment

### Deploy to Render

PosterBoxd includes a `render.yaml` configuration file for easy deployment to [Render.com](https://render.com):

1. Push your code to a GitHub repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Add your `TMDB_API_KEY` as an environment variable in the Render dashboard
6. Deploy!

**Manual Configuration (if needed):**
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Environment:** Node
- **Environment Variables:** `TMDB_API_KEY`

### Other Platforms

PosterBoxd can be deployed to any Node.js hosting platform:
- **Heroku:** Add a `Procfile` with `web: node server.js`
- **Railway:** Connect your GitHub repo and set `TMDB_API_KEY`
- **Vercel/Netlify:** Configure as a Node.js serverless function
- **DigitalOcean App Platform:** Deploy directly from GitHub

---

## API Endpoints

PosterBoxd exposes the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search-media` | POST | Search for movies/TV shows via TMDb |
| `/letterboxd-preview` | POST | Extract review data from Letterboxd URL |
| `/tv-seasons` | GET | Fetch season list for a TV series |
| `/tv-episodes` | GET | Fetch episode list for a specific season |
| `/generate-image` | POST | Generate poster image (returns PNG) |
| `/regenerate-image` | POST | Regenerate poster with different assets |
| `/ping` | GET | Health check endpoint |

**Example Request:**

```javascript
// Search for media
fetch('/search-media', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'The Matrix' })
})
.then(r => r.json())
.then(data => console.log(data.results));
```

---

## Technical Details

### Architecture

- **Backend:** Node.js with Express framework
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Image Processing:** Sharp library for SVG-to-PNG conversion and image compositing
- **Web Scraping:** Cheerio for parsing Letterboxd HTML
- **HTTP Client:** node-fetch for TMDb API requests
- **UI Interactivity:** SortableJS for drag-and-drop metadata reordering

### Dependencies

```json
{
  "express": "^4.17.1",        // Web server framework
  "node-fetch": "^3.3.2",      // HTTP client for TMDb API
  "cheerio": "^1.0.0",         // HTML parser for Letterboxd scraping
  "sharp": "^0.34.2",          // Image processing and manipulation
  "dotenv": "^16.5.0"          // Environment variable management
}
```

### Image Generation Pipeline

1. **Data Collection:**
   - Letterboxd scraping extracts review metadata
   - TMDb API fetches movie/TV details, posters, backdrops, logos, cast, crew

2. **SVG Generation:**
   - Server-side SVG template rendering with dynamic metadata
   - Text wrapping and XML escaping for safety
   - Customizable layout based on user settings (field order, visibility, spacing)

3. **Image Compositing:**
   - Sharp library loads and processes images
   - Applies backdrop blur, brightness, gradient overlay
   - Converts SVG text overlay to PNG
   - Composites all layers into final 1080x1920 poster

4. **Session Management:**
   - In-memory Map stores up to 100 movie datasets
   - Session IDs enable fast regeneration with different poster/backdrop options
   - Production should use Redis or database for scalability

### Quality Sorting Algorithm

Assets (posters, backdrops, logos) are sorted by:
1. **Resolution:** Higher pixel count preferred
2. **Aspect Ratio:** Closest to target aspect ratio (poster: 0.667, backdrop: 1.778)
3. **Vote Average:** TMDb community votes for quality assessment

### TV Series Logic

- Uses TMDb's `created_by`, `status`, `first_air_date`, `last_air_date` fields
- Displays year range with status (e.g., `2017–2022 (Ended)`)
- Shows `number_of_seasons`, `number_of_episodes`, `episode_run_time`
- Season/episode selection fetches episode-specific metadata via `/tv-seasons` and `/tv-episodes` endpoints

### Security Features

- XML escaping for user-generated content (prevents injection)
- Input validation on all API endpoints
- CORS disabled for same-origin policy
- No authentication required (stateless design)

---

## Notes

- **Poster/Backdrop Independence:** Choose any poster with any backdrop—completely flexible
- **Heart Icon Logic:** Only displays if review is "liked" AND "Heart (if liked)" setting is enabled
- **TV vs Movie Display:** TV series show "Created by" and season info; movies show "Directed by" and genre
- **Image Caching:** Session-based caching speeds up regeneration but doesn't persist across server restarts
- **Browser Compatibility:** Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile Responsive:** Optimized for mobile devices with touch-friendly controls

---

## License

MIT
