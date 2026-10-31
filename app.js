import { catalogEntries, getPublishedFilms, isPublishable, isSafeThumbnailUrl, readManagedFilms } from "./catalog.js";

const filmGrid = document.querySelector("#film-grid");
const searchInput = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#film-dialog");
const dialogContent = document.querySelector("#dialog-content");
const count = document.querySelector("#collection-count");
let selectedGenre = "All";
let selectedCategory = "All";
let query = "";
const viewerTerritory = "NG";
const managedFilms = readManagedFilms();
const publishedFilms = getPublishedFilms(managedFilms, viewerTerritory);
const visibleFilms = [
  ...catalogEntries.filter((film) => film.demoOnly),
  ...publishedFilms,
];

const icon = {
  arrow: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4.5 9 5.5-9 5.5v-11Z" /></svg>',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function matchingFilms() {
  return visibleFilms.filter((film) => {
    const matchesGenre = selectedGenre === "All" || film.genre === selectedGenre;
    const matchesCategory =
      selectedCategory === "All" || (film.categories ?? []).includes(selectedCategory);
    const searchable = `${film.title} ${film.genre} ${(film.categories ?? []).join(" ")} ${film.description}`.toLowerCase();
    return matchesGenre && matchesCategory && searchable.includes(query.toLowerCase().trim());
  });
}

function renderCategoryFilters() {
  const categories = [...new Set(visibleFilms.flatMap((film) => film.categories ?? []))]
    .sort((left, right) => left.localeCompare(right));
  if (selectedCategory !== "All" && !categories.includes(selectedCategory)) selectedCategory = "All";
  document.querySelector("#category-filters").innerHTML = ["All", ...categories].map((category) => `
    <button class="category-chip ${category === selectedCategory ? "selected" : ""}" type="button" data-category="${escapeHtml(category)}">
      ${escapeHtml(category === "All" ? "All categories" : category)}
    </button>`).join("");
}

function renderFilms() {
  const films = matchingFilms();
  count.textContent = `${films.length.toString().padStart(2, "0")} STORIES`;
  filmGrid.innerHTML = films.map((film, index) => `
    <article class="film-card">
      <button class="poster poster-${escapeHtml(film.palette)} ${isSafeThumbnailUrl(film.thumbnailUrl) ? "has-thumbnail" : ""}" type="button" data-film-id="${escapeHtml(film.id)}" aria-label="View ${escapeHtml(film.title)} details">
        ${isSafeThumbnailUrl(film.thumbnailUrl) ? `<img class="poster-thumbnail" src="${escapeHtml(film.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
        <span class="poster-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="poster-art" aria-hidden="true"></span>
        <span class="poster-word">${escapeHtml(film.title.split(" ").slice(0, 2).join(" "))}</span>
        <span class="poster-bottom"><span>${escapeHtml(film.genre)}</span><span>${icon.arrow}</span></span>
        ${film.demoOnly ? '<span class="demo-tag">DEMO</span>' : ""}
      </button>
      <div class="film-card-copy">
        <div class="film-categories">${(film.categories ?? []).map((category) => `<span>${escapeHtml(category)}</span>`).join("")}</div>
        <div class="film-card-heading">
          <h3>${escapeHtml(film.title)}</h3>
          <span class="film-year">${escapeHtml(film.year ?? "—")}</span>
        </div>
        <p>${escapeHtml(film.genre)} <span>·</span> ${film.demoOnly ? "Preview only" : "Rights verified"}</p>
      </div>
    </article>
  `).join("");
  emptyState.hidden = films.length > 0;
  filmGrid.hidden = films.length === 0;
}

function renderDetails(film) {
  const playable = isPublishable(film, viewerTerritory);
  const playback = playable
    ? `<div class="authorized-player"><iframe src="${escapeHtml(film.playbackUrl)}" title="Watch ${escapeHtml(film.title)}" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen></iframe></div>`
    : `<div class="unavailable-player"><span class="unavailable-icon">${icon.play}</span><strong>Not available to watch</strong><span>${film.demoOnly ? "This is a fictional demo placeholder. No film or video is attached." : "Rights are not verified for this territory."}</span></div>`;

  dialogContent.innerHTML = `
    <div class="dialog-poster poster-${escapeHtml(film.palette)} ${isSafeThumbnailUrl(film.thumbnailUrl) ? "has-thumbnail" : ""}">
      ${isSafeThumbnailUrl(film.thumbnailUrl) ? `<img class="poster-thumbnail" src="${escapeHtml(film.thumbnailUrl)}" alt="" referrerpolicy="no-referrer" />` : ""}
      <span class="poster-art" aria-hidden="true"></span>
      <span class="poster-word">${escapeHtml(film.title)}</span>
      ${film.demoOnly ? '<span class="demo-tag">DEMO</span>' : ""}
    </div>
    <div class="dialog-copy">
      <div class="eyebrow section-eyebrow">${escapeHtml(film.genre)} <span class="dot-separator">·</span> ${escapeHtml(film.label)}</div>
      <div class="dialog-categories">${(film.categories ?? []).map((category) => `<span>${escapeHtml(category)}</span>`).join("")}</div>
      <h2 id="dialog-title">${escapeHtml(film.title)}</h2>
      <p class="dialog-description">${escapeHtml(film.description)}</p>
      <div class="rights-callout">
        <span class="rights-icon" aria-hidden="true">⌑</span>
        <div><strong>${playable ? "Rights verified" : film.rightsStatus === "verified" ? "Not cleared for this territory" : "Rights not verified"}</strong><span>${playable ? `Approved for territory ${escapeHtml(viewerTerritory)}` : "Requires verified rights, license evidence, territory clearance, and an eligible official player."}</span></div>
      </div>
      ${playback}
      <p class="dialog-footnote">${film.demoOnly ? "This fictional placeholder is only for product demonstration." : "Playback uses the linked official player and remains subject to the source platform's terms."} A title can only be published and played after rights verification.</p>
    </div>`;
}

filmGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-film-id]");
  if (!button) return;
  const film = visibleFilms.find((item) => item.id === button.dataset.filmId);
  if (!film) return;
  renderDetails(film);
  dialog.showModal();
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  renderFilms();
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    selectedGenre = button.dataset.genre;
    document.querySelector(".filter-chip.selected").classList.remove("selected");
    button.classList.add("selected");
    renderFilms();
  });
});

document.querySelector("#category-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategoryFilters();
  renderFilms();
});

document.querySelector("#clear-filters").addEventListener("click", () => {
  query = "";
  selectedGenre = "All";
  selectedCategory = "All";
  searchInput.value = "";
  document.querySelector(".filter-chip.selected").classList.remove("selected");
  document.querySelector('[data-genre="All"]').classList.add("selected");
  renderCategoryFilters();
  renderFilms();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && dialog.open) dialog.close();
});

renderCategoryFilters();
renderFilms();
