/* =========================================================================
   World Tour Atlas — app logic
   Vanilla JS, no framework or build step. Loads data/data.json, renders a
   Leaflet choropleth map plus a searchable/filterable sidebar.
   ========================================================================= */

(async function () {
  "use strict";

  // ---------- load data ----------
  // data.json is fetched separately (not embedded in the page) so it stays
  // readable as a plain JSON file. Needs a local server to avoid browser
  // CORS restrictions on fetch() from file:// -- see README.
  const res = await fetch("data/data.json");
  const DATA = await res.json();

  const geo = DATA.geo;
  const toursIndex = DATA.tours;
  const countryNames = DATA.country_names || {};
  const TOTAL_COUNTRIES = DATA.total_countries_reference || 195;
  const tourById = new Map(toursIndex.map((t) => [t.tour_id, t]));

  // footprint ships as compact rows (array-of-arrays, see data.json's
  // "footprint_columns") to keep the file small; expand each row into a
  // full object once, looking artist/genre/decade up from its tour.
  const footprint = DATA.footprint.map((row) => {
    const [tourIdx, country_iso2, continent, city, latitude, longitude, year, isReferenceCountry] = row;
    const t = toursIndex[tourIdx];
    return {
      tour_id: t.tour_id,
      tour_name: t.tour_name,
      artist_name: t.artist_name,
      primary_genre: t.primary_genre,
      decade: t.decade,
      self_labeled_world_tour: t.self_labeled_world_tour,
      country_iso2, continent, city, latitude, longitude, year,
      country_name: country_iso2 ? (countryNames[country_iso2] || country_iso2) : null,
      // whether country_iso2 counts toward the ~195-country coverage figure
      // (excludes dependent territories, Antarctica, non-UN entities)
      isReferenceCountry: !!isReferenceCountry,
    };
  });

  // ---------- derived option lists ----------
  const genreCounts = new Map();
  toursIndex.forEach((t) => {
    if (!t.primary_genre) return;
    genreCounts.set(t.primary_genre, (genreCounts.get(t.primary_genre) || 0) + 1);
  });
  const genreOptions = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);

  const CONTINENT_ORDER = ["Europe", "North America", "Asia", "South America", "Oceania", "Africa", "Antarctica"];
  const continentCounts = new Map();
  footprint.forEach((r) => {
    if (!r.continent) return;
    continentCounts.set(r.continent, (continentCounts.get(r.continent) || 0) + 1);
  });
  const continentOptions = CONTINENT_ORDER.filter((c) => continentCounts.has(c));

  const cityCounts = new Map();
  footprint.forEach((r) => {
    if (!r.city) return;
    cityCounts.set(r.city, (cityCounts.get(r.city) || 0) + 1);
  });
  const cityOptions = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  // Fixed list of the ~195 UN member states + observers (Holy See, Palestine),
  // used for the tour-detail modal's "not visited" column. This is the same
  // 195-country reference the coverage stats (TOTAL_COUNTRIES) are measured
  // against, listed here by name so the modal can show every country, not
  // just ones that appear somewhere in the footprint data.
  const REFERENCE_COUNTRIES = [
    { iso2: "AF", name: "Afghanistan" },
    { iso2: "AL", name: "Albania" },
    { iso2: "DZ", name: "Algeria" },
    { iso2: "AD", name: "Andorra" },
    { iso2: "AO", name: "Angola" },
    { iso2: "AG", name: "Antigua and Barbuda" },
    { iso2: "AR", name: "Argentina" },
    { iso2: "AM", name: "Armenia" },
    { iso2: "AU", name: "Australia" },
    { iso2: "AT", name: "Austria" },
    { iso2: "AZ", name: "Azerbaijan" },
    { iso2: "BS", name: "Bahamas" },
    { iso2: "BH", name: "Bahrain" },
    { iso2: "BD", name: "Bangladesh" },
    { iso2: "BB", name: "Barbados" },
    { iso2: "BY", name: "Belarus" },
    { iso2: "BE", name: "Belgium" },
    { iso2: "BZ", name: "Belize" },
    { iso2: "BJ", name: "Benin" },
    { iso2: "BT", name: "Bhutan" },
    { iso2: "BO", name: "Bolivia" },
    { iso2: "BA", name: "Bosnia and Herzegovina" },
    { iso2: "BW", name: "Botswana" },
    { iso2: "BR", name: "Brazil" },
    { iso2: "BN", name: "Brunei" },
    { iso2: "BG", name: "Bulgaria" },
    { iso2: "BF", name: "Burkina Faso" },
    { iso2: "BI", name: "Burundi" },
    { iso2: "CV", name: "Cabo Verde" },
    { iso2: "KH", name: "Cambodia" },
    { iso2: "CM", name: "Cameroon" },
    { iso2: "CA", name: "Canada" },
    { iso2: "CF", name: "Central African Republic" },
    { iso2: "TD", name: "Chad" },
    { iso2: "CL", name: "Chile" },
    { iso2: "CN", name: "China" },
    { iso2: "CO", name: "Colombia" },
    { iso2: "KM", name: "Comoros" },
    { iso2: "CD", name: "Congo (Democratic Republic of the)" },
    { iso2: "CG", name: "Congo (Republic of the)" },
    { iso2: "CR", name: "Costa Rica" },
    { iso2: "CI", name: "Cote d'Ivoire" },
    { iso2: "HR", name: "Croatia" },
    { iso2: "CU", name: "Cuba" },
    { iso2: "CY", name: "Cyprus" },
    { iso2: "CZ", name: "Czechia" },
    { iso2: "DK", name: "Denmark" },
    { iso2: "DJ", name: "Djibouti" },
    { iso2: "DM", name: "Dominica" },
    { iso2: "DO", name: "Dominican Republic" },
    { iso2: "EC", name: "Ecuador" },
    { iso2: "EG", name: "Egypt" },
    { iso2: "SV", name: "El Salvador" },
    { iso2: "GQ", name: "Equatorial Guinea" },
    { iso2: "ER", name: "Eritrea" },
    { iso2: "EE", name: "Estonia" },
    { iso2: "SZ", name: "Eswatini" },
    { iso2: "ET", name: "Ethiopia" },
    { iso2: "FJ", name: "Fiji" },
    { iso2: "FI", name: "Finland" },
    { iso2: "FR", name: "France" },
    { iso2: "GA", name: "Gabon" },
    { iso2: "GM", name: "Gambia" },
    { iso2: "GE", name: "Georgia" },
    { iso2: "DE", name: "Germany" },
    { iso2: "GH", name: "Ghana" },
    { iso2: "GR", name: "Greece" },
    { iso2: "GD", name: "Grenada" },
    { iso2: "GT", name: "Guatemala" },
    { iso2: "GN", name: "Guinea" },
    { iso2: "GW", name: "Guinea-Bissau" },
    { iso2: "GY", name: "Guyana" },
    { iso2: "HT", name: "Haiti" },
    { iso2: "VA", name: "Holy See" },
    { iso2: "HN", name: "Honduras" },
    { iso2: "HU", name: "Hungary" },
    { iso2: "IS", name: "Iceland" },
    { iso2: "IN", name: "India" },
    { iso2: "ID", name: "Indonesia" },
    { iso2: "IR", name: "Iran" },
    { iso2: "IQ", name: "Iraq" },
    { iso2: "IE", name: "Ireland" },
    { iso2: "IL", name: "Israel" },
    { iso2: "IT", name: "Italy" },
    { iso2: "JM", name: "Jamaica" },
    { iso2: "JP", name: "Japan" },
    { iso2: "JO", name: "Jordan" },
    { iso2: "KZ", name: "Kazakhstan" },
    { iso2: "KE", name: "Kenya" },
    { iso2: "KI", name: "Kiribati" },
    { iso2: "KW", name: "Kuwait" },
    { iso2: "KG", name: "Kyrgyzstan" },
    { iso2: "LA", name: "Laos" },
    { iso2: "LV", name: "Latvia" },
    { iso2: "LB", name: "Lebanon" },
    { iso2: "LS", name: "Lesotho" },
    { iso2: "LR", name: "Liberia" },
    { iso2: "LY", name: "Libya" },
    { iso2: "LI", name: "Liechtenstein" },
    { iso2: "LT", name: "Lithuania" },
    { iso2: "LU", name: "Luxembourg" },
    { iso2: "MG", name: "Madagascar" },
    { iso2: "MW", name: "Malawi" },
    { iso2: "MY", name: "Malaysia" },
    { iso2: "MV", name: "Maldives" },
    { iso2: "ML", name: "Mali" },
    { iso2: "MT", name: "Malta" },
    { iso2: "MH", name: "Marshall Islands" },
    { iso2: "MR", name: "Mauritania" },
    { iso2: "MU", name: "Mauritius" },
    { iso2: "MX", name: "Mexico" },
    { iso2: "FM", name: "Micronesia" },
    { iso2: "MD", name: "Moldova" },
    { iso2: "MC", name: "Monaco" },
    { iso2: "MN", name: "Mongolia" },
    { iso2: "ME", name: "Montenegro" },
    { iso2: "MA", name: "Morocco" },
    { iso2: "MZ", name: "Mozambique" },
    { iso2: "MM", name: "Myanmar" },
    { iso2: "NA", name: "Namibia" },
    { iso2: "NR", name: "Nauru" },
    { iso2: "NP", name: "Nepal" },
    { iso2: "NL", name: "Netherlands" },
    { iso2: "NZ", name: "New Zealand" },
    { iso2: "NI", name: "Nicaragua" },
    { iso2: "NE", name: "Niger" },
    { iso2: "NG", name: "Nigeria" },
    { iso2: "KP", name: "North Korea" },
    { iso2: "MK", name: "North Macedonia" },
    { iso2: "NO", name: "Norway" },
    { iso2: "OM", name: "Oman" },
    { iso2: "PK", name: "Pakistan" },
    { iso2: "PW", name: "Palau" },
    { iso2: "PS", name: "Palestine" },
    { iso2: "PA", name: "Panama" },
    { iso2: "PG", name: "Papua New Guinea" },
    { iso2: "PY", name: "Paraguay" },
    { iso2: "PE", name: "Peru" },
    { iso2: "PH", name: "Philippines" },
    { iso2: "PL", name: "Poland" },
    { iso2: "PT", name: "Portugal" },
    { iso2: "QA", name: "Qatar" },
    { iso2: "RO", name: "Romania" },
    { iso2: "RU", name: "Russia" },
    { iso2: "RW", name: "Rwanda" },
    { iso2: "KN", name: "Saint Kitts and Nevis" },
    { iso2: "LC", name: "Saint Lucia" },
    { iso2: "VC", name: "Saint Vincent and the Grenadines" },
    { iso2: "WS", name: "Samoa" },
    { iso2: "SM", name: "San Marino" },
    { iso2: "ST", name: "Sao Tome and Principe" },
    { iso2: "SA", name: "Saudi Arabia" },
    { iso2: "SN", name: "Senegal" },
    { iso2: "RS", name: "Serbia" },
    { iso2: "SC", name: "Seychelles" },
    { iso2: "SL", name: "Sierra Leone" },
    { iso2: "SG", name: "Singapore" },
    { iso2: "SK", name: "Slovakia" },
    { iso2: "SI", name: "Slovenia" },
    { iso2: "SB", name: "Solomon Islands" },
    { iso2: "SO", name: "Somalia" },
    { iso2: "ZA", name: "South Africa" },
    { iso2: "KR", name: "South Korea" },
    { iso2: "SS", name: "South Sudan" },
    { iso2: "ES", name: "Spain" },
    { iso2: "LK", name: "Sri Lanka" },
    { iso2: "SD", name: "Sudan" },
    { iso2: "SR", name: "Suriname" },
    { iso2: "SE", name: "Sweden" },
    { iso2: "CH", name: "Switzerland" },
    { iso2: "SY", name: "Syria" },
    { iso2: "TJ", name: "Tajikistan" },
    { iso2: "TZ", name: "Tanzania" },
    { iso2: "TH", name: "Thailand" },
    { iso2: "TL", name: "Timor-Leste" },
    { iso2: "TG", name: "Togo" },
    { iso2: "TO", name: "Tonga" },
    { iso2: "TT", name: "Trinidad and Tobago" },
    { iso2: "TN", name: "Tunisia" },
    { iso2: "TR", name: "Turkey" },
    { iso2: "TM", name: "Turkmenistan" },
    { iso2: "TV", name: "Tuvalu" },
    { iso2: "UG", name: "Uganda" },
    { iso2: "UA", name: "Ukraine" },
    { iso2: "AE", name: "United Arab Emirates" },
    { iso2: "GB", name: "United Kingdom" },
    { iso2: "US", name: "United States" },
    { iso2: "UY", name: "Uruguay" },
    { iso2: "UZ", name: "Uzbekistan" },
    { iso2: "VU", name: "Vanuatu" },
    { iso2: "VE", name: "Venezuela" },
    { iso2: "VN", name: "Vietnam" },
    { iso2: "YE", name: "Yemen" },
    { iso2: "ZM", name: "Zambia" },
    { iso2: "ZW", name: "Zimbabwe" }
  ];

  const decades = [...new Set(footprint.map((r) => r.decade).filter((d) => d != null))].sort((a, b) => a - b);
  const minDecade = decades[0];
  const maxDecade = decades[decades.length - 1];

  // artist -> list of their tours, for search suggestions
  const artistMap = new Map();
  toursIndex.forEach((t) => {
    if (!t.artist_name) return;
    if (!artistMap.has(t.artist_name)) artistMap.set(t.artist_name, { name: t.artist_name, tours: [] });
    artistMap.get(t.artist_name).tours.push(t);
  });
  const artistList = [...artistMap.values()];

  // ---------- state ----------
  const state = {
    search: "",
    selectedArtist: null,
    selectedTourId: null,
    genre: "all",
    decadeFrom: minDecade,
    decadeTo: maxDecade,
    continent: "all",
    city: "",
    cityIso2: null, // disambiguates same-named cities when picked from City Canon
    countryIso2: null, // set by clicking a country on the map
    countryName: null,
    worldTourLabel: "all", // "all" | "labeled" | "unlabeled"
    view: "tours", // "tours" | "cities"
    sortField: "artist", // "artist" | "countries" | "continents" | "shows" | "decade"
    sortDir: "asc",
  };
  const SORT_DEFAULT_DIR = { artist: "asc", countries: "desc", continents: "desc", shows: "desc", decade: "desc" };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const searchInput = $("searchInput");
  const searchClear = $("searchClear");
  const suggestBox = $("suggest");
  const genreSelect = $("genreSelect");
  const decadeFromSelect = $("decadeFromSelect");
  const decadeToSelect = $("decadeToSelect");
  const continentSelect = $("continentSelect");
  const cityInput = $("cityInput");
  const cityList = $("cityList");
  const cityClear = $("cityClear");
  const worldTourSelect = $("worldTourSelect");
  const viewToggle = $("viewToggle");
  const viewButtons = [...viewToggle.querySelectorAll(".view-btn")];
  const sortRow = $("sortRow");
  const sortFieldSelect = $("sortField");
  const sortDirBtn = $("sortDirBtn");
  const chipsEl = $("chips");
  const statsEl = $("stats");
  const resultsEl = $("results");
  const resultsCountEl = $("resultsCount");
  const headerCountEl = $("headerCount");
  const tourModalOverlay = $("tourModalOverlay");
  const tourModalClose = $("tourModalClose");
  const tourModalTitle = $("tourModalTitle");
  const tourModalSubtitle = $("tourModalSubtitle");
  const visitedCountEl = $("visitedCount");
  const notVisitedCountEl = $("notVisitedCount");
  const visitedListEl = $("visitedList");
  const notVisitedListEl = $("notVisitedList");

  // ---------- populate filter controls ----------
  genreSelect.innerHTML =
    '<option value="all">All genres</option>' +
    genreOptions.map(([g, n]) => `<option value="${esc(g)}">${esc(g)} (${n})</option>`).join("");

  function fillDecadeSelect(sel, selected) {
    sel.innerHTML = decades.map((d) => `<option value="${d}">${d}s</option>`).join("");
    sel.value = String(selected);
  }
  fillDecadeSelect(decadeFromSelect, minDecade);
  fillDecadeSelect(decadeToSelect, maxDecade);

  continentSelect.innerHTML =
    '<option value="all">All continents</option>' +
    continentOptions.map((c) => `<option value="${esc(c)}">${esc(c)} (${continentCounts.get(c)})</option>`).join("");

  worldTourSelect.innerHTML = `
    <option value="all">All tours</option>
    <option value="labeled">Self-labeled "World Tour" only</option>
    <option value="unlabeled">Without this label</option>
  `;

  cityList.innerHTML = cityOptions.slice(0, 2000).map((c) => `<option value="${esc(c)}"></option>`).join("");

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const UNKNOWN_ARTIST = "Various artists";
  function artistLabel(name) {
    return name || UNKNOWN_ARTIST;
  }

  // ---------- filtering ----------
  function matchesSearch(row, q) {
    if (!q) return true;
    return (
      (row.artist_name && row.artist_name.toLowerCase().includes(q)) ||
      (row.tour_name && row.tour_name.toLowerCase().includes(q)) ||
      (row.city && row.city.toLowerCase().includes(q)) ||
      (row.country_name && row.country_name.toLowerCase().includes(q))
    );
  }

  function computeFiltered() {
    const q = state.search.trim().toLowerCase();
    const cityQ = state.city.trim().toLowerCase();
    return footprint.filter((r) => {
      if (r.decade == null || r.decade < state.decadeFrom || r.decade > state.decadeTo) return false;
      if (state.genre !== "all" && r.primary_genre !== state.genre) return false;
      if (state.continent !== "all" && r.continent !== state.continent) return false;
      if (state.worldTourLabel === "labeled" && !r.self_labeled_world_tour) return false;
      if (state.worldTourLabel === "unlabeled" && r.self_labeled_world_tour) return false;
      if (cityQ && (!r.city || r.city.toLowerCase() !== cityQ)) return false;
      if (cityQ && state.cityIso2 && r.country_iso2 !== state.cityIso2) return false;
      if (state.countryIso2 && r.country_iso2 !== state.countryIso2) return false;
      if (state.selectedTourId && r.tour_id !== state.selectedTourId) return false;
      if (!state.selectedTourId && state.selectedArtist && r.artist_name !== state.selectedArtist) return false;
      if (!state.selectedArtist && !state.selectedTourId && q && !matchesSearch(r, q)) return false;
      return true;
    });
  }

  // ---------- map setup ----------
  const map = L.map("map", { zoomControl: false, worldCopyJump: true, minZoom: 2 }).setView([20, 10], 2);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const seqRamp = ["--map-1", "--map-2", "--map-3", "--map-4", "--map-5", "--map-6"].map((v) =>
    getComputedStyle(document.documentElement).getPropertyValue(v).trim()
  );
  const zeroFillColor = getComputedStyle(document.documentElement).getPropertyValue("--map-zero").trim();

  function colorFor(count, max) {
    if (!count) return "transparent";
    if (max <= 1) return seqRamp[4];
    const t = Math.sqrt(count / max); // sqrt scale so one giant country (USA) doesn't flatten everything else
    const idx = Math.min(seqRamp.length - 1, Math.floor(t * (seqRamp.length - 1) + 0.0001));
    return seqRamp[idx];
  }

  let countryAgg = new Map(); // iso2 -> {count, stops, tours:Set, rows:[]}
  // When exactly one tour is selected, "coverage" per country switches from
  // "how many tours touched it" (meaningless at 1 tour) to "how many stops
  // this tour made there" -- the dimension actually worth seeing per-tour.
  let singleTourMode = false;

  const geoLayer = L.geoJSON(geo, {
    style: baseStyle,
    onEachFeature: (feature, layer) => {
      layer.on("mouseover", () => {
        const iso2 = feature.properties.iso2;
        const agg = countryAgg.get(iso2);
        layer.setStyle({ weight: 2, color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() });
        const label = !agg
          ? "no shows in current filter"
          : singleTourMode
          ? `${agg.stops} stop${agg.stops === 1 ? "" : "s"} on this tour`
          : `${agg.tours.size} tour(s) in current filter`;
        layer.bindTooltip(`<b>${esc(feature.properties.name)}</b>${label}`, { sticky: true, className: "leaflet-tooltip" }).openTooltip();
      });
      layer.on("mouseout", () => {
        layer.setStyle(baseStyle(feature));
      });
      // Clicking a country filters the whole page to it; clicking the same
      // country again, or clicking the ocean (map.on("click") below), clears
      // the filter. Stop the click from bubbling to the map so the ocean
      // handler doesn't immediately undo the selection we just made.
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        const iso2 = feature.properties.iso2;
        if (state.countryIso2 === iso2) {
          state.countryIso2 = null;
          state.countryName = null;
        } else {
          state.countryIso2 = iso2;
          state.countryName = feature.properties.name;
        }
        renderChips();
        render();
      });
    },
  }).addTo(map);

  // Clicking anywhere that isn't a country (i.e. the ocean) clears the
  // country filter, if one is active.
  map.on("click", () => {
    if (!state.countryIso2) return;
    state.countryIso2 = null;
    state.countryName = null;
    renderChips();
    render();
  });

  function baseStyle(feature) {
    const iso2 = feature.properties.iso2;
    const agg = countryAgg.get(iso2);
    const border = getComputedStyle(document.documentElement).getPropertyValue("--map-border").trim();
    const isActiveFilter = state.countryIso2 === iso2;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return {
      fillColor: agg ? colorFor(agg.count, currentMax) : zeroFillColor,
      fillOpacity: agg ? 0.9 : 0.75,
      color: isActiveFilter ? accent : border,
      weight: isActiveFilter ? 2.5 : 1,
      fillRule: "evenodd",
    };
  }

  let currentMax = 1;
  let markerLayer = L.layerGroup().addTo(map);
  let routeLayer = L.layerGroup().addTo(map);

  function render() {
    const filtered = computeFiltered();
    const distinctTourIds = new Set(filtered.map((r) => r.tour_id));
    singleTourMode = distinctTourIds.size === 1;
    // Whether to let this render move the camera at all. Picking a country
    // on the map is a filter, not a "take me there" action, so it must never
    // pan or zoom the map -- only an explicit artist/tour/search selection does.
    const hasSelection = Boolean(state.selectedArtist || state.selectedTourId || state.search.trim() !== "");

    // aggregate by country: "stops" = distinct cities visited, "tours" =
    // distinct tours touching the country. Choropleth color depends on
    // which one is relevant, see singleTourMode above.
    countryAgg = new Map();
    filtered.forEach((r) => {
      if (!r.country_iso2) return;
      if (!countryAgg.has(r.country_iso2)) countryAgg.set(r.country_iso2, { count: 0, stops: 0, tours: new Set(), rows: [] });
      const a = countryAgg.get(r.country_iso2);
      a.tours.add(r.tour_id);
      a.stops += 1;
      a.rows.push(r);
    });
    countryAgg.forEach((a) => {
      a.count = singleTourMode ? a.stops : a.tours.size;
    });
    currentMax = Math.max(1, ...[...countryAgg.values()].map((a) => a.count));
    geoLayer.eachLayer((l) => l.setStyle(baseStyle(l.feature)));

    // markers + route line only when narrowed to a handful of tours
    markerLayer.clearLayers();
    routeLayer.clearLayers();
    if (distinctTourIds.size >= 1 && distinctTourIds.size <= 3 && filtered.length) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      distinctTourIds.forEach((tid) => {
        const rows = filtered.filter((r) => r.tour_id === tid).sort((a, b) => (a.year || 0) - (b.year || 0));
        const latlngs = [];
        rows.forEach((r) => {
          if (r.latitude == null || r.longitude == null) return;
          const ll = [r.latitude, r.longitude];
          latlngs.push(ll);
          L.circleMarker(ll, { radius: 5, color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.85 })
            .bindTooltip(`<b>${esc(r.city)}, ${esc(r.country_name)}</b>${esc(artistLabel(r.artist_name))} &mdash; ${esc(r.tour_name)}`)
            .addTo(markerLayer);
        });
        if (latlngs.length > 1) {
          L.polyline(latlngs, { color: accent, weight: 1.5, opacity: 0.55, dashArray: "3,5" }).addTo(routeLayer);
        }
      });
      if (hasSelection) {
        const bounds = L.latLngBounds(filtered.filter((r) => r.latitude != null).map((r) => [r.latitude, r.longitude]));
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.3), { maxZoom: 5 });
      }
    } else if (!hasSelection && !state.countryIso2) {
      map.setView([20, 10], 2);
    }

    renderStats(filtered);
    renderResults(filtered);
  }

  // ---------- stats ----------
  function renderStats(filtered) {
    const tourCount = new Set(filtered.map((r) => r.tour_id)).size;
    const countryCount = new Set(filtered.filter((r) => r.isReferenceCountry).map((r) => r.country_iso2)).size;
    const artistCount = new Set(filtered.map((r) => r.artist_name)).size;
    statsEl.innerHTML = `
      <div class="stat"><div class="n">${tourCount}</div><div class="l">Tours</div></div>
      <div class="stat"><div class="n">${countryCount}</div><div class="l">Countries</div></div>
      <div class="stat"><div class="n">${artistCount}</div><div class="l">Acts</div></div>
    `;
    headerCountEl.textContent = tourCount + " tours · " + countryCount + " countries";
  }

  // ---------- results: sorting helpers ----------
  // Sort values live on the tour (DATA.tours), not individual footprint
  // rows, so "coverage" always reflects a tour's full footprint, not just
  // the part matching the current decade/genre side-filters.
  function sortValue(t, field) {
    switch (field) {
      case "artist": return t.artist_name || null;
      case "countries": return t.countries_count;
      case "continents": return t.continents_count;
      case "shows": return t.shows_count;
      case "decade": return t.decade;
      default: return null;
    }
  }
  function sortTours(tours, field, dir) {
    const withVal = [], withoutVal = [];
    tours.forEach((t) => {
      const v = sortValue(t, field);
      (v === null || v === undefined ? withoutVal : withVal).push(t);
    });
    withVal.sort((a, b) => {
      const av = sortValue(a, field), bv = sortValue(b, field);
      const c = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return dir === "asc" ? c : -c;
    });
    withoutVal.sort((a, b) => (a.artist_name || "").localeCompare(b.artist_name || ""));
    return [...withVal, ...withoutVal];
  }
  // Coverage score shown next to every tour in the results list: how many
  // (reference) countries it played, and that as a share of all ~195.
  // Always shown, regardless of which field the list is currently sorted by.
  function coverageLabel(t) {
    const pct = Math.round((t.countries_count / TOTAL_COUNTRIES) * 1000) / 10;
    return `${t.countries_count} ${t.countries_count === 1 ? "country" : "countries"} · ${pct}%`;
  }

  // ---------- results list ----------
  function renderResults(filtered) {
    if (state.view === "cities") {
      renderCityCanon(filtered);
      return;
    }
    const byTourId = new Map();
    filtered.forEach((r) => {
      if (!byTourId.has(r.tour_id)) byTourId.set(r.tour_id, true);
    });
    let rows = [...byTourId.keys()].map((tid) => tourById.get(tid)).filter(Boolean);
    resultsCountEl.textContent = rows.length;
    rows = sortTours(rows, state.sortField, state.sortDir);
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-note">No results for this combination of search and filters.</div>`;
      return;
    }
    resultsEl.innerHTML = rows
      .map((r, i) => {
        const metric = coverageLabel(r);
        return `
      <div class="result-row ${r.tour_id === state.selectedTourId ? "selected" : ""}" data-tour="${esc(r.tour_id)}" data-artist="${esc(r.artist_name)}">
        <span class="result-rank">${i + 1}</span>
        <div class="result-main">
          <div class="result-artist">${esc(artistLabel(r.artist_name))}${
          r.self_labeled_world_tour ? ' <span class="wt-badge" title="Self-labeled &quot;World Tour&quot;">WT</span>' : ""
        }</div>
          <div class="result-meta">${esc(r.tour_name)} &middot; ${r.decade != null ? r.decade + "s" : "?"}</div>
        </div>
        ${metric ? `<span class="result-metric">${esc(metric)}</span>` : ""}
      </div>`;
      })
      .join("");
    resultsEl.querySelectorAll(".result-row").forEach((el) => {
      el.addEventListener("click", () => {
        state.selectedTourId = el.dataset.tour;
        state.selectedArtist = el.dataset.artist;
        state.search = el.dataset.artist;
        searchInput.value = el.dataset.artist;
        searchClear.style.display = "inline-block";
        closeSuggest();
        renderChips();
        render();
        openTourDetail(el.dataset.tour);
      });
    });
  }

  // City Canon: ranks cities by how many distinct acts have played them,
  // over the same filtered footprint as the tour list.
  function renderCityCanon(filtered) {
    const byCity = new Map();
    filtered.forEach((r) => {
      if (!r.city) return;
      const key = r.city + "|" + (r.country_iso2 || "");
      if (!byCity.has(key)) {
        byCity.set(key, { city: r.city, country_iso2: r.country_iso2, country_name: r.country_name, continent: r.continent, tours: new Set(), artists: new Set() });
      }
      const c = byCity.get(key);
      c.tours.add(r.tour_id);
      if (r.artist_name) c.artists.add(r.artist_name);
    });
    let rows = [...byCity.values()].map((c) => ({ ...c, n_tours: c.tours.size, n_acts: c.artists.size }));
    resultsCountEl.textContent = rows.length;
    rows.sort((a, b) => b.n_acts - a.n_acts || b.n_tours - a.n_tours || a.city.localeCompare(b.city));
    if (!rows.length) {
      resultsEl.innerHTML = `<div class="empty-note">No cities for this combination of search and filters.</div>`;
      return;
    }
    resultsEl.innerHTML = rows
      .map(
        (r, i) => `
      <div class="result-row city-row" data-city="${esc(r.city)}" data-iso2="${esc(r.country_iso2 || "")}">
        <span class="result-rank">${i + 1}</span>
        <div class="result-main">
          <div class="result-artist">${esc(r.city)}<span class="city-country"> &middot; ${esc(r.country_name || r.country_iso2 || "")}</span></div>
          <div class="result-meta">${r.n_tours} tour${r.n_tours === 1 ? "" : "s"} &middot; ${esc(r.continent || "")}</div>
        </div>
        <span class="result-metric">${r.n_acts} act${r.n_acts === 1 ? "" : "s"}</span>
      </div>
    `
      )
      .join("");
    resultsEl.querySelectorAll(".city-row").forEach((el) => {
      el.addEventListener("click", () => {
        const city = el.dataset.city;
        state.city = city;
        state.cityIso2 = el.dataset.iso2 || null;
        cityInput.value = city;
        cityClear.style.display = "inline-block";
        setView("tours");
        renderChips();
      });
    });
  }

  // ---------- view + sort controls ----------
  function setView(view) {
    state.view = view;
    viewButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    sortRow.style.display = view === "tours" ? "flex" : "none";
    render();
  }
  viewButtons.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

  function updateSortDirBtn() {
    sortDirBtn.textContent = state.sortDir === "asc" ? "↑" : "↓";
  }
  sortFieldSelect.addEventListener("change", () => {
    state.sortField = sortFieldSelect.value;
    state.sortDir = SORT_DEFAULT_DIR[state.sortField] || "desc";
    updateSortDirBtn();
    render();
  });
  sortDirBtn.addEventListener("click", () => {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    updateSortDirBtn();
    render();
  });
  updateSortDirBtn();

  // ---------- search + suggestions ----------
  let activeSuggestIndex = -1;
  let currentSuggestions = [];

  function buildSuggestions(q) {
    if (!q) return [];
    const ql = q.toLowerCase();
    const artistHits = artistList
      .filter((a) => a.name.toLowerCase().includes(ql))
      .sort((a, b) => b.tours.length - a.tours.length)
      .slice(0, 6)
      .map((a) => ({ type: "artist", label: a.name, meta: `${a.tours.length} tour${a.tours.length > 1 ? "s" : ""}`, artist: a.name }));
    const tourHits = toursIndex
      .filter((t) => t.tour_name && t.tour_name.toLowerCase().includes(ql))
      .filter((t) => !artistHits.some((a) => a.artist === t.artist_name))
      .slice(0, 4)
      .map((t) => ({ type: "tour", label: t.tour_name, meta: t.artist_name, artist: t.artist_name, tourId: t.tour_id }));
    return [...artistHits, ...tourHits].slice(0, 8);
  }

  function highlight(label, q) {
    const idx = label.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return esc(label);
    return esc(label.slice(0, idx)) + "<b>" + esc(label.slice(idx, idx + q.length)) + "</b>" + esc(label.slice(idx + q.length));
  }

  function renderSuggest(q) {
    currentSuggestions = buildSuggestions(q);
    activeSuggestIndex = -1;
    if (!currentSuggestions.length) {
      closeSuggest();
      return;
    }
    suggestBox.innerHTML = currentSuggestions
      .map(
        (s, i) => `
      <div class="suggest-item" data-i="${i}">
        <span>${highlight(s.label, q)}</span>
        <span class="suggest-meta">${esc(s.meta)}</span>
      </div>
    `
      )
      .join("");
    suggestBox.classList.add("open");
    suggestBox.querySelectorAll(".suggest-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pickSuggestion(currentSuggestions[+el.dataset.i]);
      });
    });
  }
  function closeSuggest() {
    suggestBox.classList.remove("open");
    suggestBox.innerHTML = "";
  }

  function pickSuggestion(s) {
    state.selectedArtist = s.artist;
    state.selectedTourId = s.tourId || null;
    state.search = s.artist;
    searchInput.value = s.artist;
    searchClear.style.display = "inline-block";
    closeSuggest();
    renderChips();
    render();
  }

  searchInput.addEventListener("input", () => {
    const v = searchInput.value;
    state.search = v;
    state.selectedArtist = null;
    state.selectedTourId = null;
    searchClear.style.display = v ? "inline-block" : "none";
    renderSuggest(v.trim());
    renderChips();
    render();
  });
  searchInput.addEventListener("keydown", (e) => {
    if (!suggestBox.classList.contains("open")) return;
    const items = suggestBox.querySelectorAll(".suggest-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestIndex = Math.min(items.length - 1, activeSuggestIndex + 1);
      updateActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestIndex = Math.max(0, activeSuggestIndex - 1);
      updateActive(items);
    } else if (e.key === "Enter") {
      if (activeSuggestIndex >= 0) {
        e.preventDefault();
        pickSuggestion(currentSuggestions[activeSuggestIndex]);
      }
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  });
  function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestIndex));
    if (activeSuggestIndex >= 0) items[activeSuggestIndex].scrollIntoView({ block: "nearest" });
  }
  searchInput.addEventListener("blur", () => setTimeout(closeSuggest, 120));
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    state.search = "";
    state.selectedArtist = null;
    state.selectedTourId = null;
    searchClear.style.display = "none";
    closeSuggest();
    renderChips();
    render();
    searchInput.focus();
  });

  // ---------- filter controls ----------
  genreSelect.addEventListener("change", () => {
    state.genre = genreSelect.value;
    renderChips();
    render();
  });
  decadeFromSelect.addEventListener("change", () => {
    state.decadeFrom = +decadeFromSelect.value;
    if (state.decadeFrom > state.decadeTo) {
      state.decadeTo = state.decadeFrom;
      decadeToSelect.value = String(state.decadeTo);
    }
    renderChips();
    render();
  });
  decadeToSelect.addEventListener("change", () => {
    state.decadeTo = +decadeToSelect.value;
    if (state.decadeTo < state.decadeFrom) {
      state.decadeFrom = state.decadeTo;
      decadeFromSelect.value = String(state.decadeFrom);
    }
    renderChips();
    render();
  });
  continentSelect.addEventListener("change", () => {
    state.continent = continentSelect.value;
    renderChips();
    render();
  });
  worldTourSelect.addEventListener("change", () => {
    state.worldTourLabel = worldTourSelect.value;
    renderChips();
    render();
  });
  const cityOptionsLower = new Map(cityOptions.map((c) => [c.toLowerCase(), c]));
  cityInput.addEventListener("input", () => {
    const v = cityInput.value.trim();
    if (v === "") {
      state.city = "";
    } else if (cityOptionsLower.has(v.toLowerCase())) {
      state.city = cityOptionsLower.get(v.toLowerCase());
    } else {
      return; // not (yet) a recognized city -- keep previous filter while typing
    }
    state.cityIso2 = null; // free-text entry can't disambiguate same-named cities
    cityClear.style.display = state.city ? "inline-block" : "none";
    renderChips();
    render();
  });
  cityClear.addEventListener("click", () => {
    cityInput.value = "";
    state.city = "";
    state.cityIso2 = null;
    cityClear.style.display = "none";
    renderChips();
    render();
  });

  // ---------- chips ----------
  function renderChips() {
    const chips = [];
    if (state.genre !== "all") chips.push({ key: "genre", label: `Genre: ${state.genre}` });
    if (state.decadeFrom !== minDecade || state.decadeTo !== maxDecade) chips.push({ key: "decade", label: state.decadeFrom + "s–" + state.decadeTo + "s" });
    if (state.continent !== "all") chips.push({ key: "continent", label: `Continent: ${state.continent}` });
    if (state.city) chips.push({ key: "city", label: `City: ${state.city}${state.cityIso2 ? " (" + (countryNames[state.cityIso2] || state.cityIso2) + ")" : ""}` });
    if (state.countryIso2) chips.push({ key: "country", label: `Country: ${state.countryName || countryNames[state.countryIso2] || state.countryIso2}` });
    if (state.worldTourLabel !== "all") chips.push({ key: "worldTour", label: state.worldTourLabel === "labeled" ? 'self-labeled "World Tour"' : 'without "World Tour" label' });
    if (state.selectedArtist || state.search) chips.push({ key: "search", label: '"' + (state.selectedArtist || state.search) + '"' });
    chipsEl.innerHTML = chips.map((c) => `<span class="chip" data-key="${c.key}">${esc(c.label)}<button aria-label="remove">&times;</button></span>`).join("");
    chipsEl.querySelectorAll(".chip button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.parentElement.dataset.key;
        if (key === "genre") { state.genre = "all"; genreSelect.value = "all"; }
        if (key === "decade") { state.decadeFrom = minDecade; state.decadeTo = maxDecade; decadeFromSelect.value = String(minDecade); decadeToSelect.value = String(maxDecade); }
        if (key === "continent") { state.continent = "all"; continentSelect.value = "all"; }
        if (key === "city") { state.city = ""; state.cityIso2 = null; cityInput.value = ""; cityClear.style.display = "none"; }
        if (key === "country") { state.countryIso2 = null; state.countryName = null; }
        if (key === "worldTour") { state.worldTourLabel = "all"; worldTourSelect.value = "all"; }
        if (key === "search") { state.search = ""; state.selectedArtist = null; state.selectedTourId = null; searchInput.value = ""; searchClear.style.display = "none"; }
        renderChips();
        render();
      });
    });
  }

  // ---------- tour detail modal ----------
  // Clicking a tour in the results list opens this: every country the tour
  // visited (alphabetically, with its cities), and beside it every reference
  // country it did NOT visit (also alphabetically).
  function openTourDetail(tourId) {
    const tour = tourById.get(tourId);
    if (!tour) return;

    const byCountry = new Map();
    footprint.forEach((r) => {
      if (r.tour_id !== tourId || !r.country_iso2) return;
      if (!byCountry.has(r.country_iso2)) {
        byCountry.set(r.country_iso2, { iso2: r.country_iso2, name: r.country_name || r.country_iso2, cities: new Set() });
      }
      if (r.city) byCountry.get(r.country_iso2).cities.add(r.city);
    });
    const visited = [...byCountry.values()].sort((a, b) => a.name.localeCompare(b.name));
    const visitedIso2 = new Set(visited.map((c) => c.iso2));
    const notVisited = REFERENCE_COUNTRIES.filter((c) => !visitedIso2.has(c.iso2));

    tourModalTitle.textContent = artistLabel(tour.artist_name);
    tourModalSubtitle.textContent = `${tour.tour_name} · ${tour.decade != null ? tour.decade + "s" : "?"}`;
    visitedCountEl.textContent = visited.length;
    notVisitedCountEl.textContent = notVisited.length;

    visitedListEl.innerHTML = visited.length
      ? visited
          .map((c) => {
            const cities = [...c.cities].sort((a, b) => a.localeCompare(b)).join(", ");
            return `<div class="modal-country"><span class="country-name">${esc(c.name)}</span>${
              cities ? `<span class="country-cities">${esc(cities)}</span>` : ""
            }</div>`;
          })
          .join("")
      : `<div class="empty-note">No country data for this tour.</div>`;

    notVisitedListEl.innerHTML = notVisited.length
      ? notVisited.map((c) => `<div class="modal-country not-visited"><span class="country-name">${esc(c.name)}</span></div>`).join("")
      : `<div class="empty-note">Every reference country was visited.</div>`;

    tourModalOverlay.classList.add("open");
  }

  function closeTourDetail() {
    tourModalOverlay.classList.remove("open");
  }

  tourModalClose.addEventListener("click", closeTourDetail);
  tourModalOverlay.addEventListener("click", (e) => {
    if (e.target === tourModalOverlay) closeTourDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && tourModalOverlay.classList.contains("open")) closeTourDetail();
  });

  // ---------- init ----------
  renderChips();
  render();
})();
