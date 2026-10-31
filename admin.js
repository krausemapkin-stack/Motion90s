import { getPublishedFilms, isPublishable, isSafeThumbnailUrl, readManagedFilms, writeManagedFilms } from "./catalog.js";
import { makeDraft, normalizeCategories, normalizeChannelInput, parseBulkImport } from "./admin-utils.js";
import { importYouTubeChannel } from "./youtube-import.js";

const list = document.querySelector("#managed-list");
const emptyState = document.querySelector("#no-movies");
const searchInput = document.querySelector("#admin-search");
const dialog = document.querySelector("#edit-dialog");
const form = document.querySelector("#edit-form");
const fileInput = document.querySelector("#bulk-file");
const importButton = document.querySelector("#bulk-import");
const apiKeyInput = document.querySelector("#api-key");
const channelInput = document.querySelector("#channel-input");
const channelImportButton = document.querySelector("#channel-import");
const statusMessage = document.querySelector("#admin-status");
let managedFilms = readManagedFilms();
let selectedFile = null;
let searchQuery = "";

const htmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

function report(message, kind = "") {
  statusMessage.textContent = message;
  statusMessage.className = `admin-status ${kind}`;
}

function persistAndRender(message = "") {
  try {
    writeManagedFilms(managedFilms);
  } catch (error) {
    report(`Could not save this catalog in browser storage: ${error.message}`, "error");
    managedFilms = readManagedFilms();
    renderMovies();
    return false;
  }
  renderMovies();
  if (message) report(message, "success");
  return true;
}

function renderMovies() {
  const search = searchQuery.trim().toLowerCase();
  const films = managedFilms.filter((film) =>
    `${film.title} ${film.genre} ${(film.categories ?? []).join(" ")} ${film.description} ${film.sourceUrl}`.toLowerCase().includes(search),
  );
  document.querySelector("#movie-total").textContent = String(managedFilms.length).padStart(2, "0");
  emptyState.hidden = films.length > 0;
  emptyState.querySelector("strong").textContent = managedFilms.length > 0 ? "No matching movies" : "No managed movies yet";
  emptyState.querySelector("p").textContent = managedFilms.length > 0
    ? "Try a different search term."
    : "Import a YouTube channel, upload a CSV or JSON file, or add records through bulk import.";
  list.hidden = films.length === 0;
  list.innerHTML = films.map((film) => {
    const sourceHost = getHost(film.sourceUrl);
    const verified = film.rightsStatus === "verified";
    const embedIssue = ["youtube.com", "youtu.be"].includes(sourceHost) && film.embeddable !== true;
    const status = embedIssue
      ? ["Embed disabled", "issue"]
      : verified
        ? ["Rights verified", "verified"]
        : ["Needs rights review", "issue"];
    return `
      <article class="movie-row">
        <div class="movie-thumbnail">
          ${isSafeThumbnailUrl(film.thumbnailUrl) ? `<img src="${htmlEscape(film.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : '<span aria-hidden="true">M</span>'}
        </div>
        <div class="movie-info">
          <strong>${htmlEscape(film.title)}</strong>
          <span>${htmlEscape(film.genre)} · ${htmlEscape((film.categories ?? []).join(", ") || "Uncategorized")} · ${htmlEscape(film.year ?? "Year unknown")} · ${htmlEscape(film.visibility)}</span>
        </div>
        <span class="status-pill ${status[1]}">${status[0]}</span>
        <div class="row-actions">
          <button class="row-action" type="button" data-action="edit" data-id="${htmlEscape(film.id)}">Edit</button>
          <button class="row-action delete" type="button" data-action="delete" data-id="${htmlEscape(film.id)}">Remove</button>
        </div>
      </article>`;
  }).join("");
}

function getHost(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Invalid source";
  }
}

function openEditor(film) {
  form.reset();
  document.querySelector("#editor-title").textContent = "Edit movie";
  document.querySelector("#film-id").value = film.id;
  document.querySelector("#film-title").value = film.title ?? "";
  document.querySelector("#film-year").value = film.year ?? "";
  document.querySelector("#film-genre").value = film.genre ?? "Other";
  document.querySelector("#film-categories").value = (film.categories ?? []).join(", ");
  document.querySelector("#film-thumbnail").value = film.thumbnailUrl ?? "";
  document.querySelector("#film-description").value = film.description ?? "";
  document.querySelector("#film-source").value = film.sourceUrl ?? "";
  document.querySelector("#film-playback").value = film.playbackUrl ?? "";
  document.querySelector("#film-embeddable").checked = film.embeddable === true;
  document.querySelector("#film-rights").value = film.rightsStatus ?? "unverified";
  document.querySelector("#film-visibility").value = film.visibility ?? "draft";
  document.querySelector("#film-territories").value = (film.territories ?? []).join(", ");
  document.querySelector("#film-evidence").value = film.licenseEvidence ?? "";
  document.querySelector("#editor-warning").textContent =
    film.demoOnly
      ? "Fictional demo placeholders cannot be edited or published from this dashboard."
      : "Publishing for Nigeria requires independently verified rights, license evidence, NG in cleared territories, and an eligible official player.";
  dialog.showModal();
}

function closeEditor() {
  dialog.close();
}

function saveEditor(event) {
  event.preventDefault();
  const id = document.querySelector("#film-id").value;
  const existing = managedFilms.find((film) => film.id === id);
  if (!existing) {
    report("This movie is no longer in the local catalog. Refresh the list and try again.", "error");
    closeEditor();
    return;
  }
  const title = document.querySelector("#film-title").value.trim();
  const yearValue = document.querySelector("#film-year").value;
  const territories = [...new Set(
    document.querySelector("#film-territories").value.toUpperCase().split(",").map((value) => value.trim()).filter(Boolean),
  )];
  const thumbnailUrl = document.querySelector("#film-thumbnail").value.trim();
  if (!title) {
    report("A movie title is required.", "error");
    return;
  }
  if (territories.some((territory) => !/^[A-Z]{2}$/.test(territory))) {
    report("Enter territories as two-letter country codes, separated by commas.", "error");
    return;
  }
  if (thumbnailUrl && !isSafeThumbnailUrl(thumbnailUrl)) {
    report("Thumbnail must be an HTTPS image URL.", "error");
    return;
  }

  const updated = {
    ...existing,
    title,
    year: yearValue ? Number(yearValue) : null,
    genre: document.querySelector("#film-genre").value,
    categories: normalizeCategories(document.querySelector("#film-categories").value),
    thumbnailUrl: thumbnailUrl || null,
    description: document.querySelector("#film-description").value.trim(),
    sourceUrl: document.querySelector("#film-source").value.trim() || null,
    playbackUrl: document.querySelector("#film-playback").value.trim() || null,
    embeddable: document.querySelector("#film-embeddable").checked,
    rightsStatus: document.querySelector("#film-rights").value,
    visibility: document.querySelector("#film-visibility").value,
    territories,
    licenseEvidence: document.querySelector("#film-evidence").value.trim(),
  };
  if (updated.visibility === "published" && !isPublishable(updated, "NG")) {
    report("This movie cannot be published for Nigeria yet. Verify rights, add evidence and NG territory, and provide a supported official source/player (including YouTube's embeddable setting).", "error");
    return;
  }
  managedFilms = managedFilms.map((film) => film.id === id ? updated : film);
  if (persistAndRender(`Saved “${title}”.`)) closeEditor();
}

function upsertImported(incoming) {
  let added = 0;
  let updated = 0;
  const existingById = new Map(managedFilms.map((film) => [film.id, film]));
  const existingBySource = new Map(managedFilms.filter((film) => film.sourceUrl).map((film) => [film.sourceUrl, film]));
  for (const film of incoming) {
    const existing = existingById.get(film.id) ?? existingBySource.get(film.sourceUrl);
    if (existing) {
      const merged = {
        ...existing,
        title: film.title,
        year: film.year ?? existing.year,
        duration: film.duration || existing.duration,
        categories: film.categories.length ? film.categories : existing.categories ?? [],
        thumbnailUrl: film.thumbnailUrl || existing.thumbnailUrl || null,
        description: film.description || existing.description,
        sourceUrl: film.sourceUrl || existing.sourceUrl,
        playbackUrl: film.playbackUrl || existing.playbackUrl,
        embeddable: film.embeddable,
      };
      managedFilms = managedFilms.map((item) => item.id === existing.id ? merged : item);
      existingById.set(existing.id, merged);
      if (merged.sourceUrl) existingBySource.set(merged.sourceUrl, merged);
      updated += 1;
    } else {
      managedFilms.push(film);
      existingById.set(film.id, film);
      if (film.sourceUrl) existingBySource.set(film.sourceUrl, film);
      added += 1;
    }
  }
  return { added, updated };
}

function describeImport({ added, updated }) {
  return `Import complete: ${added} new title${added === 1 ? "" : "s"} added; ${updated} existing title${updated === 1 ? "" : "s"} refreshed. Imported titles remain drafts pending rights review.`;
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files?.[0] ?? null;
  document.querySelector("#file-name").textContent = selectedFile
    ? `${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KB`
    : "CSV headers: title, genre, categories, thumbnailUrl, description…";
  importButton.disabled = !selectedFile;
  report("");
});

importButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  importButton.disabled = true;
  try {
    const imported = parseBulkImport(await selectedFile.text(), selectedFile.name);
    const result = upsertImported(imported);
    if (persistAndRender(describeImport(result))) {
      selectedFile = null;
      fileInput.value = "";
      document.querySelector("#file-name").textContent = "CSV headers: title, genre, categories, thumbnailUrl, description…";
    }
  } catch (error) {
    report(error.message || "Could not import that file.", "error");
  } finally {
    importButton.disabled = !selectedFile;
  }
});

document.querySelector("#export-catalog").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ films: managedFilms }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "motion90s-catalog.json";
  link.click();
  URL.revokeObjectURL(url);
  report("Exported the current local catalog as JSON.", "success");
});

channelImportButton.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    report("Enter a YouTube Data API v3 key to import channel uploads.", "error");
    apiKeyInput.focus();
    return;
  }
  let channel;
  try {
    channel = normalizeChannelInput(channelInput.value);
  } catch (error) {
    report(error.message, "error");
    channelInput.focus();
    return;
  }

  channelImportButton.disabled = true;
  importButton.disabled = true;
  try {
    const imported = await importYouTubeChannel(key, channel);
    const result = upsertImported(imported);
    if (persistAndRender(describeImport(result))) {
      report(`${describeImport(result)} Imported ${imported.length} public uploads.`, "success");
    }
  } catch (error) {
    report(error.message || "YouTube channel import failed.", "error");
  } finally {
    apiKeyInput.value = "";
    channelImportButton.disabled = false;
    importButton.disabled = !selectedFile;
  }
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const film = managedFilms.find((item) => item.id === button.dataset.id);
  if (!film) return;
  if (button.dataset.action === "edit") {
    openEditor(film);
    return;
  }
  if (button.dataset.action === "delete" && window.confirm(`Remove "${film.title}" from this browser's Motion90s catalog?`)) {
    managedFilms = managedFilms.filter((item) => item.id !== film.id);
    persistAndRender(`Removed “${film.title}”.`);
  }
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderMovies();
});
form.addEventListener("submit", saveEditor);
document.querySelector("#close-editor").addEventListener("click", closeEditor);
document.querySelector("#cancel-editor").addEventListener("click", closeEditor);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeEditor();
});

renderMovies();
if (managedFilms.length > 0) {
  const published = getPublishedFilms(managedFilms, "NG").length;
  report(`${managedFilms.length} managed movie${managedFilms.length === 1 ? "" : "s"} loaded from this browser. ${published} currently meet the Nigeria publication checks.`);
}
