import { makeDraft } from "./admin-utils.js";

export async function importYouTubeChannel(apiKey, channel, { fetchImpl = globalThis.fetch, onProgress = () => {} } = {}) {
  onProgress("Looking up the YouTube channel…");
  const channelData = await youtubeApi("channels", {
    part: "contentDetails,snippet",
    [channel.type === "id" ? "id" : "forHandle"]: channel.value,
  }, apiKey, fetchImpl);
  const channelItem = channelData.items?.[0];
  if (!channelItem) throw new Error("No matching YouTube channel was found.");
  const playlistId = channelItem.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("This YouTube channel does not expose a public uploads playlist.");

  const uploads = [];
  let pageToken = "";
  const seenTokens = new Set();
  do {
    onProgress(`Loading public uploads… ${uploads.length} found`);
    const page = await youtubeApi("playlistItems", {
      part: "snippet,contentDetails",
      maxResults: "50",
      playlistId,
      ...(pageToken ? { pageToken } : {}),
    }, apiKey, fetchImpl);
    uploads.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? "";
    if (pageToken && seenTokens.has(pageToken)) {
      throw new Error("YouTube returned a repeated page token; import stopped to avoid duplicating uploads.");
    }
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);

  const videosById = new Map();
  const ids = [...new Set(uploads.map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId).filter(Boolean))];
  for (let offset = 0; offset < ids.length; offset += 50) {
    onProgress(`Checking official video details… ${Math.min(offset + 50, ids.length)} of ${ids.length}`);
    const batch = await youtubeApi("videos", {
      part: "contentDetails,snippet,status",
      id: ids.slice(offset, offset + 50).join(","),
    }, apiKey, fetchImpl);
    for (const video of batch.items ?? []) videosById.set(video.id, video);
  }

  const channelTitle = channelItem.snippet?.title ?? "YouTube channel";
  return uploads.flatMap((item, index) => {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return [];
    const video = videosById.get(videoId);
    const snippet = item.snippet ?? {};
    const film = makeDraft({
      id: `youtube-${videoId}`,
      title: snippet.title || video?.snippet?.title || "Untitled video",
      description: snippet.description || video?.snippet?.description || "",
      year: (snippet.publishedAt ?? "").slice(0, 4),
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      playbackUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    }, index);
    film.embeddable = video?.status?.embeddable === true;
    film.duration = formatDuration(video?.contentDetails?.duration);
    film.thumbnailUrl = getThumbnailUrl(video?.snippet?.thumbnails ?? snippet.thumbnails);
    film.label = `YouTube import · ${channelTitle}`;
    return [film];
  });
}

function getThumbnailUrl(thumbnails = {}) {
  for (const size of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[size]?.url;
    if (typeof url === "string" && /^https:\/\/i\.ytimg\.com\//.test(url)) return url;
  }
  return null;
}

async function youtubeApi(resource, parameters, key, fetchImpl) {
  const query = new URLSearchParams({ ...parameters, key });
  let response;
  try {
    response = await fetchImpl(`https://www.googleapis.com/youtube/v3/${resource}?${query}`);
  } catch {
    throw new Error("Could not reach the YouTube Data API. Check the connection and API-key referrer restrictions.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`YouTube returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason;
    const message = result.error?.message ?? "The request was rejected.";
    throw new Error(`YouTube API error${reason ? ` (${reason})` : ""}: ${message}`);
  }
  return result;
}

function formatDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "");
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}
