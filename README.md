# 🎬 PosterBoxd

Create stylish, shareable 9:16 posters for your Letterboxd film reviews — perfect for social media.

<p align="center">
  <img src="public/assets/posterBoxd.png" alt="PosterBoxd Logo" width="300"/>
</p>

---

## ✨ Features

- Extracts metadata from Letterboxd and TMDb:
  - Title, Year, Director, Music, Genre, Rating, Actors, Tags
- Beautifully styled for vertical mobile-friendly export
- Customizable:
  - Metadata order (via drag-and-drop)
  - Visual style: backdrop blur, brightness, poster scale
  - Optional gradient overlay and footer scaling
- Mobile + desktop responsive UI
- Supports JPEG download or clipboard copy

---

## 🚀 Live Demo

[Live Demo](https://posterboxd.onrender.com)

###Demo Output
<p align="center">
  <img src="public/assets/demo.png" alt="PosterBoxd Logo" width="300"/>
</p>
---

## 🚀 Deploy to Render

You can deploy this project to [Render](https://render.com) with one click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## 🖥️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/emmanuelmavely/posterboxd.git
cd posterboxd
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add TMDb API Key

Create a `.env` file in the root directory:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

Get one from https://www.themoviedb.org/settings/api

---

### 4. Run the server

```bash
node server.js
```

Then visit [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deployment (Render)

To deploy full-stack:

1. Push this repo to GitHub
2. Go to [render.com](https://render.com)
3. New → Web Service → Connect GitHub Repo
4. Configure:
   - **Start command**: `node server.js`
   - **Root directory**: `/`
   - **Environment**: Node
   - **Add env var**: `TMDB_API_KEY=your_key`
5. Deploy and you're live 🎉

---

## 📝 License

MIT — feel free to use and modify.

---

## 🙌 Credits

- Letterboxd metadata: [letterboxd.com](https://letterboxd.com)
- Movie info: [TMDb API](https://developers.themoviedb.org/)
- UI/UX: Custom drag & slider controls

---

> Built with ❤️ by Emmanuel Mavely
