import test from "node:test";
import assert from "node:assert/strict";
import { catalogEntries, getPublishedFilms, isOfficialPlaybackUrl, isPublishable, isSafeThumbnailUrl } from "./catalog.js";

test("demo entries remain unpublished and are never playable", () => {
  assert.equal(getPublishedFilms(catalogEntries, "NG").length, 0);
  for (const film of catalogEntries) {
    assert.equal(film.visibility, "draft");
    assert.equal(film.rightsStatus, "unverified");
    assert.equal(isPublishable(film, "US"), false);
  }
});

test("only verified films with evidence, matching territory, and official URLs publish", () => {
  const film = {
    visibility: "published",
    rightsStatus: "verified",
    licenseEvidence: "https://archive.org/details/rights-document",
    territories: ["US", "GH"],
    sourceUrl: "https://www.youtube.com/watch?v=abc_123",
    playbackUrl: "https://www.youtube-nocookie.com/embed/abc_123",
    embeddable: true,
  };
  assert.equal(isPublishable(film, "US"), true);
  assert.equal(isPublishable(film, "NG"), false);
  assert.equal(isPublishable({ ...film, licenseEvidence: "   " }, "US"), false);
  assert.equal(isPublishable({ ...film, rightsStatus: "unverified" }, "US"), false);
  assert.equal(isPublishable({ ...film, visibility: "draft" }, "US"), false);
});

test("playback URL validation rejects insecure and arbitrary embeds", () => {
  assert.equal(isOfficialPlaybackUrl("https://www.youtube-nocookie.com/embed/video_1"), true);
  assert.equal(isOfficialPlaybackUrl("https://player.vimeo.com/video/12345"), true);
  assert.equal(isOfficialPlaybackUrl("https://archive.org/embed/demo-item"), true);
  assert.equal(isOfficialPlaybackUrl("http://www.youtube-nocookie.com/embed/video_1"), false);
  assert.equal(isOfficialPlaybackUrl("https://www.youtube-nocookie.com:8443/embed/video_1"), false);
  assert.equal(isOfficialPlaybackUrl("https://user@www.youtube-nocookie.com/embed/video_1"), false);
  assert.equal(isOfficialPlaybackUrl("https://evil.example/embed/video_1"), false);
  assert.equal(isOfficialPlaybackUrl("https://www.youtube-nocookie.com/watch?v=video_1"), false);
});

test("thumbnail URLs must use HTTPS", () => {
  assert.equal(isSafeThumbnailUrl("https://i.ytimg.com/vi/video_1/hqdefault.jpg"), true);
  assert.equal(isSafeThumbnailUrl("http://images.example/poster.jpg"), false);
  assert.equal(isSafeThumbnailUrl("javascript:alert(1)"), false);
});

test("catalog returns only eligible films for the selected territory", () => {
  const approved = {
    visibility: "published",
    rightsStatus: "verified",
    licenseEvidence: "signed grant, on file",
    territories: ["GH"],
    sourceUrl: "https://archive.org/details/demo-item",
    playbackUrl: "https://archive.org/embed/demo-item",
  };
  const films = [{ id: "yes", ...approved }, { id: "no", ...approved, rightsStatus: "unverified" }];
  assert.deepEqual(getPublishedFilms(films, "GH").map((film) => film.id), ["yes"]);
  assert.deepEqual(getPublishedFilms(films, "US"), []);
});

test("YouTube entries require a matching official player and embed permission", () => {
  const youtubeFilm = {
    visibility: "published",
    rightsStatus: "verified",
    licenseEvidence: "license record",
    territories: ["NG"],
    sourceUrl: "https://youtube.com/watch?v=abc_123",
    playbackUrl: "https://www.youtube-nocookie.com/embed/abc_123",
    embeddable: true,
  };
  assert.equal(isPublishable(youtubeFilm, "NG"), true);
  assert.equal(isPublishable({ ...youtubeFilm, embeddable: false }, "NG"), false);
  assert.equal(isPublishable({
    ...youtubeFilm,
    playbackUrl: "https://www.youtube-nocookie.com/embed/a-different-video",
  }, "NG"), false);
  assert.equal(isPublishable({
    ...youtubeFilm,
    sourceUrl: "https://youtube.com/watch?v=abc_123",
    playbackUrl: "https://player.vimeo.com/video/12345",
  }, "NG"), false);
});
