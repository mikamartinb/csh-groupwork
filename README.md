# World Tour Atlas

A small interactive map that plots world tour data for music artists, built for a
*Computational Spatial Humanities* course project.

The map lets you explore how "global" different artists' world tours really are:
how many countries and continents they actually played, how concentrated the shows
are, and which cities keep showing up across different artists' tours.

## What it does

- Choropleth world map, colored by tour coverage (or, with a single tour selected,
  by number of distinct cities played in each country).
- Search across artists, tours, cities, and countries.
- Filters for genre, decade range, continent, "self-labeled World Tour" status,
  and city.
- Two result views:
  - **Tour Ranking** — every tour matching the current filters, sortable by
    artist name, countries played, continents played, show count, or decade.
  - **City Canon** — which cities appear most often across all matching tours
    (the "mandatory stops" of touring).
- Summary stats (tours / countries / acts) for the current filter.

## Running it locally

The data is loaded from `data/data.json` via `fetch()`, which browsers block for
pages opened directly from disk (`file://...`) due to CORS restrictions. You need
to serve the folder over HTTP instead. From this folder, run one of:

```bash
# Python (any recent version)
python3 -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000` in a browser.

It also works out of the box on **GitHub Pages**: enable Pages for this repo
(Settings → Pages → deploy from branch) and point it at this folder.

## Project structure

```
index.html      page structure
style.css       all styling (IBM Plex Mono throughout)
script.js       filtering, sorting, and map rendering logic
data/data.json  the tour + geocoding dataset (see below)
```

## Data

Each row in `data.json` represents one stop on one tour: an artist, a tour name,
a city, a country, coordinates, and a year. The dataset was built from tour
setlists (primarily sourced via setlist.fm and Wikipedia tour pages) and
geocoded to city/country coordinates.

Two things worth knowing about the methodology:

- **Country coverage** (`countries_count` and the "Countries" stat) is counted
  against a fixed reference list of the ~195 UN member and observer states.
  Dependent territories, Antarctica, and similar non-UN entities are excluded
  so that coverage numbers are comparable across tours.
- **City-to-country matching** uses a small manual override list for cities
  whose name is ambiguous (e.g. a city sharing its name with one in a
  different country), to avoid accidentally geocoding a show to the wrong
  country.

Because the underlying tour data comes mostly from English-language,
Western-centric sources, coverage is likely over-represented in North America
and Europe relative to the rest of the world — this is a limitation of the
source data, not of the mapping method.

## Tech

No build step, no framework — plain HTML/CSS/JavaScript plus
[Leaflet](https://leafletjs.com/) for the map (loaded from a CDN) and
[IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (loaded from
Google Fonts).
