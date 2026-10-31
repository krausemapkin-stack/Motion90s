const OFFICIAL_PLAYBACK_HOSTS = new Set([
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "archive.org",
]);
const OFFICIAL_SOURCE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "vimeo.com",
  "www.vimeo.com",
  "archive.org",
]);

export const MANAGED_FILMS_STORAGE_KEY = "motion90s.managed-films";

export const catalogEntries = [
  {
    id: "demo-river",
    demoOnly: true,
    title: "Where the River Turns",
    year: null,
    duration: null,
    genre: "Drama",
    categories: ["Family", "Memory"],
    description: "A fictional story about the things we carry home, and the places that keep calling us back.",
    palette: "river",
    label: "Fictional placeholder",
    visibility: "draft",
    rightsStatus: "unverified",
    territories: [],
    licenseEvidence: "",
    sourceUrl: null,
    playbackUrl: null,
  },
  {
    id: "demo-market",
    demoOnly: true,
    title: "Before the Market Opens",
    year: null,
    duration: null,
    genre: "Documentary",
    categories: ["Community", "Daily life"],
    description: "An illustrative portrait of a neighborhood waking up before the first light.",
    palette: "market",
    label: "Fictional placeholder",
    visibility: "draft",
    rightsStatus: "unverified",
    territories: [],
    licenseEvidence: "",
    sourceUrl: null,
    playbackUrl: null,
  },
  {
    id: "demo-postcard",
    demoOnly: true,
    title: "Postcard from August",
    year: null,
    duration: null,
    genre: "Short",
    categories: ["Summer", "Memory"],
    description: "A made-up summer memory, told in the quiet language of old photographs.",
    palette: "postcard",
    label: "Fictional placeholder",
    visibility: "draft",
    rightsStatus: "unverified",
    territories: [],
    licenseEvidence: "",
    sourceUrl: null,
    playbackUrl: null,
  },
  {
    id: "demo-night",
    demoOnly: true,
    title: "The Last Light on Cedar Street",
    year: null,
    duration: null,
    genre: "Drama",
    categories: ["City life", "Night"],
    description: "A fictional late-night walk through a city that feels different after rain.",
    palette: "night",
    label: "Fictional placeholder",
    visibility: "draft",
    rightsStatus: "unverified",
    territories: [],
    licenseEvidence: "",
    sourceUrl: null,
    playbackUrl: null,
  },
];

function isHttpsUrl(value, allowedHosts) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      allowedHosts.has(url.hostname)
    );
  } catch {
    return false;
  }
}

export function isOfficialPlaybackUrl(value) {
  if (!isHttpsUrl(value, OFFICIAL_PLAYBACK_HOSTS)) return false;
  const url = new URL(value);
  if (url.hostname === "www.youtube-nocookie.com") {
    return /^\/embed\/[A-Za-z0-9_-]+$/.test(url.pathname);
  }
  if (url.hostname === "player.vimeo.com") {
    return /^\/video\/\d+$/.test(url.pathname);
  }
  return /^\/embed\/[A-Za-z0-9._-]+$/.test(url.pathname);
}

export function isSafeThumbnailUrl(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function isPublishable(film, territory) {
  const source = getUrl(film?.sourceUrl);
  const playback = getUrl(film?.playbackUrl);
  const isYouTube = source && ["youtube.com", "www.youtube.com", "youtu.be"].includes(source.hostname);
  const matchingOfficialPlayer =
    source &&
    playback &&
    ((isYouTube &&
      playback.hostname === "www.youtube-nocookie.com" &&
      film.embeddable === true &&
      getYouTubeVideoId(source) === getYouTubeEmbedId(playback)) ||
      (["vimeo.com", "www.vimeo.com"].includes(source.hostname) &&
        playback.hostname === "player.vimeo.com" &&
        source.pathname.match(/\/(\d+)\/?$/)?.[1] === playback.pathname.match(/^\/video\/(\d+)$/)?.[1]) ||
      (source.hostname === "archive.org" &&
        playback.hostname === "archive.org" &&
        getArchiveItemId(source) === getArchiveItemId(playback)));

  return Boolean(
    film &&
      film.visibility === "published" &&
      film.rightsStatus === "verified" &&
      typeof film.licenseEvidence === "string" &&
      film.licenseEvidence.trim() &&
      Array.isArray(film.territories) &&
      film.territories.includes(territory) &&
      isHttpsUrl(film.sourceUrl, OFFICIAL_SOURCE_HOSTS) &&
      isOfficialPlaybackUrl(film.playbackUrl) &&
      matchingOfficialPlayer,
  );
}

export function getPublishedFilms(films, territory) {
  return films.filter((film) => isPublishable(film, territory));
}

export function readManagedFilms(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const stored = JSON.parse(storage.getItem(MANAGED_FILMS_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((film) => film && typeof film.id === "string" && !film.demoOnly) : [];
  } catch (error) {
    console.error("Could not read the Motion90s catalog from local storage.", error);
    return [];
  }
}

export function writeManagedFilms(films, storage = globalThis.localStorage) {
  if (!storage) throw new Error("Local storage is not available in this browser.");
  storage.setItem(MANAGED_FILMS_STORAGE_KEY, JSON.stringify(films));
}

function getUrl(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getYouTubeVideoId(url) {
  const id = url.hostname === "youtu.be"
    ? url.pathname.slice(1)
    : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

function getYouTubeEmbedId(url) {
  return url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,20})$/)?.[1] ?? null;
}

function getArchiveItemId(url) {
  return url.pathname.match(/^\/(?:details|embed)\/([^/]+)\/?$/)?.[1] ?? null;
}
