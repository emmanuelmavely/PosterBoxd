# PosterBoxd

A web app to generate stylish, customizable posters from your Letterboxd reviews or any movie/TV series using TMDb data.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Letterboxd Mode](#letterboxd-mode)
  - [Custom Mode](#custom-mode)
  - [TV Series Support](#tv-series-support)
  - [Poster & Background Selection](#poster--background-selection)
  - [Metadata & Layout Customization](#metadata--layout-customization)
  - [Visual Customization](#visual-customization)
  - [Responsive UI](#responsive-ui)
- [Getting Started](#getting-started)
- [Technical Details](#technical-details)
- [Notes](#notes)
- [License](#license)

---

## Overview

PosterBoxd lets you create high-quality, shareable posters for movies and TV series. It supports both Letterboxd review imports and custom TMDb searches, with advanced layout and visual customization.

---

## Features

### Letterboxd Mode

- **Input:** Paste your Letterboxd share text or review URL.
- **Data Extraction:** Automatically parses title, year, director, rating, tags, username, watched date, and liked status from the Letterboxd page.
- **Poster Generation:** Fetches movie metadata and images from TMDb for accurate visuals.

### Custom Mode

- **Search:** Search for any movie or TV series using TMDb.
- **Selection:** Choose from search results to autofill metadata.
- **Manual Input:** Set your own rating, tags, username, and watched date.

### TV Series Support

- **Year Range & Status:** Displays the full run (e.g., `2017–2022 (Ended)`).
- **Season/Episode/Runtime:** Shows average episode runtime, number of seasons, and episodes (e.g., `45min | 4 Seasons | 12 Episodes`).
- **Created By:** Shows "created by" instead of "directed by" for TV series.

### Poster & Background Selection

- **Multiple Choices:** Select from main and alternative posters and backgrounds fetched from TMDb.
- **Independent Selection:** Freely combine any poster with any background.

### Metadata & Layout Customization

- **Reorder Fields:** Drag-and-drop to reorder metadata fields (title, year, director/created by, genre/season info, runtime, actors, tags, rating, heart, watched date).
- **Toggle Visibility:** Show/hide any metadata field using checkboxes.
- **Heart Icon:** Only appears if both the review is liked and the "Heart (if liked)" setting is enabled.

### Visual Customization

- **Backdrop Blur:** Toggle background blur effect.
- **Gradient Overlay:** Add a black gradient overlay for readability.
- **Brightness:** Adjust backdrop brightness (0–100%).
- **Poster/Footer Scaling:** Scale poster and footer logo independently.
- **Spacing:** Fine-tune poster top margin, title offset, line height, and section spacing.

### Responsive UI

- **Modern Design:** iOS-style dark mode, mobile-friendly.
- **Live Preview:** See changes instantly before downloading.
- **Drag-and-Drop:** Reorder metadata fields interactively.

---

## Getting Started

### 1. Install Dependencies

```sh
npm install
```

### 2. Set Up TMDb API Key

Create a `.env` file in the project root:

```
TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Start the Server

```sh
npm start
```

### 4. Open in Browser

Go to [http://localhost:3000](http://localhost:3000)

---

## Technical Details

- **Backend:** Node.js (Express), uses `node-fetch` for HTTP requests, `cheerio` for HTML parsing, and `sharp` for image processing.
- **Frontend:** Vanilla JS, CSS, HTML. Uses [SortableJS](https://sortablejs.github.io/Sortable/) for drag-and-drop.
- **Image Generation:**  
  - Combines TMDb images and SVG overlays for text/metadata.
  - All layout and visual settings are applied server-side using `sharp`.
- **Session Handling:**  
  - Each poster generation creates a session ID for fast regeneration with different poster/background options.
- **TV Series Logic:**  
  - Uses TMDb's `created_by`, `status`, `first_air_date`, `last_air_date`, `number_of_seasons`, `number_of_episodes`, and `episode_run_time` fields.

---

## Notes

- Poster/background selection is independent—choose any combination.
- All settings are customizable before generating your poster.
- The heart icon only appears if both the review is liked and the "Heart (if liked)" setting is enabled.
- For TV series, "created by" and season/episode/runtime info are shown instead of director/genre.

---

## License

MIT
