const GENRES = new Set(["Drama", "Documentary", "Short", "Other"]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unfinished quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one movie row.");

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (!headers.includes("title")) throw new Error("The CSV needs a title column.");
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

export function parseBulkImport(text, fileName = "") {
  const records = fileName.toLowerCase().endsWith(".csv")
    ? parseCsv(text)
    : parseJson(text);
  if (!Array.isArray(records)) throw new Error("Import a JSON array of movie records or a CSV file.");
  return records.map((record, index) => makeDraft(record, index));
}

export function makeDraft(record, index = 0) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Movie row ${index + 1} is not a valid record.`);
  }
  const title = cleanText(record.title, 180);
  if (!title) throw new Error(`Movie row ${index + 1} is missing a title.`);
  const sourceUrl = cleanText(record.sourceUrl ?? record.sourceurl ?? record.source_url, 1000);
  const videoId = extractYouTubeId(sourceUrl);
  const importedId = cleanText(record.id, 180);

  return {
    id: importedId || (videoId
      ? `youtube-${videoId}`
      : `film-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`),
    demoOnly: false,
    title,
    year: cleanYear(record.year),
    duration: cleanText(record.duration, 40),
    genre: GENRES.has(record.genre) ? record.genre : "Other",
    categories: normalizeCategories(record.categories ?? record.category),
    description: cleanText(record.description, 5000),
    palette: ["river", "market", "postcard", "night"][index % 4],
    thumbnailUrl: cleanText(record.thumbnailUrl ?? record.thumbnailurl ?? record.thumbnail_url, 1000) || null,
    label: "Imported catalog record",
    visibility: "draft",
    rightsStatus: "unverified",
    territories: [],
    licenseEvidence: "",
    sourceUrl: sourceUrl || null,
    playbackUrl: cleanText(record.playbackUrl ?? record.playbackurl ?? record.playback_url, 1000) ||
      (videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null),
    embeddable: record.embeddable === true,
  };
}

export function normalizeCategories(value) {
  const categories = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const seen = new Set();
  return categories
    .map((category) => cleanText(category, 40))
    .filter((category) => {
      const key = category.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function normalizeChannelInput(input) {
  const value = input.trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return { type: "id", value };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(value)) return { type: "handle", value: value.slice(1) };

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a YouTube channel ID, @handle, or youtube.com channel URL.");
  }
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    throw new Error("Only youtube.com channel URLs are supported.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0].startsWith("@")) {
    return normalizeChannelInput(segments[0]);
  }
  if (segments.length === 2 && segments[0] === "channel" && /^UC[A-Za-z0-9_-]{20,}$/.test(segments[1])) {
    return { type: "id", value: segments[1] };
  }
  throw new Error("Use a channel URL in the form youtube.com/@handle or youtube.com/channel/UC…");
}

function parseJson(text) {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data?.films;
  } catch {
    throw new Error("The JSON file could not be parsed.");
  }
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanYear(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year >= 1888 && year <= 2100 ? year : null;
}

function extractYouTubeId(value) {
  try {
    const url = new URL(value);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)) return null;
    const id = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
