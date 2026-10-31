import test from "node:test";
import assert from "node:assert/strict";
import { importYouTubeChannel } from "./youtube-import.js";

const response = (data) => ({ ok: true, status: 200, json: async () => data });

test("YouTube channel import follows every uploads page and preserves rights gates", async () => {
  const calls = [];
  const fetchImpl = async (requestUrl) => {
    const url = new URL(requestUrl);
    calls.push(url);
    if (url.pathname.endsWith("/channels")) {
      return response({ items: [{
        snippet: { title: "Test channel" },
        contentDetails: { relatedPlaylists: { uploads: "UU_test_uploads" } },
      }] });
    }
    if (url.pathname.endsWith("/playlistItems")) {
      if (!url.searchParams.has("pageToken")) {
        return response({
          items: [{
            snippet: { title: "First video", description: "Description one", publishedAt: "2001-02-03T00:00:00Z" },
            contentDetails: { videoId: "video001" },
          }],
          nextPageToken: "page-two",
        });
      }
      assert.equal(url.searchParams.get("pageToken"), "page-two");
      return response({
        items: [{
          snippet: { title: "Second video", description: "Description two", publishedAt: "2002-03-04T00:00:00Z" },
          contentDetails: { videoId: "video002" },
        }],
      });
    }
    if (url.pathname.endsWith("/videos")) {
      assert.deepEqual(url.searchParams.get("id").split(","), ["video001", "video002"]);
      return response({ items: [
        { id: "video001", snippet: { thumbnails: { high: { url: "https://i.ytimg.com/vi/video001/hqdefault.jpg" } } }, status: { embeddable: true }, contentDetails: { duration: "PT1H2M3S" } },
        { id: "video002", status: { embeddable: false }, contentDetails: { duration: "PT4M5S" } },
      ] });
    }
    throw new Error(`Unexpected API request: ${url.pathname}`);
  };

  const progress = [];
  const films = await importYouTubeChannel("test-api-key", { type: "handle", value: "testchannel" }, {
    fetchImpl,
    onProgress: (message) => progress.push(message),
  });
  assert.equal(films.length, 2);
  assert.equal(calls.filter((url) => url.pathname.endsWith("/playlistItems")).length, 2);
  assert.equal(films[0].id, "youtube-video001");
  assert.equal(films[1].title, "Second video");
  assert.equal(films[0].duration, "1h 2m");
  assert.equal(films[0].thumbnailUrl, "https://i.ytimg.com/vi/video001/hqdefault.jpg");
  assert.equal(films[1].duration, "4m 5s");
  assert.equal(films[0].embeddable, true);
  assert.equal(films[1].embeddable, false);
  for (const film of films) {
    assert.equal(film.visibility, "draft");
    assert.equal(film.rightsStatus, "unverified");
    assert.deepEqual(film.territories, []);
    assert.equal(film.licenseEvidence, "");
  }
  assert.ok(progress.includes("Loaded 2 public uploads."));
});

test("YouTube API error detail is surfaced to the caller", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      error: {
        message: "The caller does not have quota.",
        errors: [{ reason: "quotaExceeded" }],
      },
    }),
  });
  await assert.rejects(
    importYouTubeChannel("test-api-key", { type: "id", value: "UC1234567890123456789012" }, { fetchImpl }),
    /quotaExceeded.*does not have quota/,
  );
});

test("repeated page tokens stop an invalid pagination loop", async () => {
  const fetchImpl = async (requestUrl) => {
    const url = new URL(requestUrl);
    if (url.pathname.endsWith("/channels")) {
      return response({ items: [{
        contentDetails: { relatedPlaylists: { uploads: "UU_test_uploads" } },
      }] });
    }
    return response({ items: [], nextPageToken: "repeat" });
  };
  await assert.rejects(
    importYouTubeChannel("test-api-key", { type: "id", value: "UC1234567890123456789012" }, { fetchImpl }),
    /repeated page token/,
  );
});
