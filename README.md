# Still Alive

A small digital zine about surviving yourself, assembled from halftone, static and stubborn hope.

## Live sites

- **Still Alive:** https://hayaaitfx-ops.github.io/still-alive/
- **Companion poster:** https://hayaaitfx-ops.github.io/still-alive/poster-site/

The repository keeps both projects together. Each site has its own HTML, styles, scripts and local image assets.

## Project structure

- `still-alive/` — the main digital zine.
- `poster-site/` — the companion poster experience and its source assets.
- `index.html` — redirects the GitHub Pages root to `still-alive/`.

## Run locally

Because these are static sites, no build step or package installation is required. From this directory, run:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/` for Still Alive or `http://localhost:8000/poster-site/` for the poster.

## Notes

- Google Fonts are loaded from Google Fonts; system fallbacks remain available if the network is unavailable.
- The newsletter form is a front-end demonstration only. It does not submit or store email addresses.
- The `.scratch/` browser profile and local `AGENTS.md` notes are intentionally not part of the public repository.
