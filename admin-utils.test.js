import test from "node:test";
import assert from "node:assert/strict";
import { makeDraft, normalizeCategories, normalizeChannelInput, parseBulkImport, parseCsv } from "./admin-utils.js";

test("bulk imports are always unverified drafts regardless of supplied rights fields", () => {
  const [film] = parseBulkImport(JSON.stringify([{
    title: "Channel upload",
    sourceUrl: "https://www.youtube.com/watch?v=abc12345",
    rightsStatus: "verified",
    visibility: "published",
    territories: ["NG"],
    licenseEvidence: "claimed",
  }]));
  assert.equal(film.id, "youtube-abc12345");
  assert.equal(film.playbackUrl, "https://www.youtube-nocookie.com/embed/abc12345");
  assert.deepEqual(film.categories, []);
  assert.equal(film.thumbnailUrl, null);
  assert.equal(film.rightsStatus, "unverified");
  assert.equal(film.visibility, "draft");
  assert.deepEqual(film.territories, []);
  assert.equal(film.licenseEvidence, "");
  assert.equal(film.embeddable, false);
});

test("bulk import normalizes movie categories and carries a thumbnail URL", () => {
  const [film] = parseBulkImport(JSON.stringify([{
    title: "Festival Night",
    categories: ["Festival", " Ghanaian cinema ", "Festival"],
    thumbnailUrl: "https://i.ytimg.com/vi/abc12345/hqdefault.jpg",
  }]));
  assert.deepEqual(film.categories, ["Festival", "Ghanaian cinema"]);
  assert.equal(film.thumbnailUrl, "https://i.ytimg.com/vi/abc12345/hqdefault.jpg");
  const [csvFilm] = parseBulkImport(
    "title,categories,thumbnailUrl\nHomecoming,\"Family, Heritage\",https://i.ytimg.com/vi/abc12345/hqdefault.jpg",
    "movies.csv",
  );
  assert.deepEqual(csvFilm.categories, ["Family", "Heritage"]);
  assert.deepEqual(normalizeCategories(" family, Family , drama "), ["family", "drama"]);
});

test("CSV import handles escaped quotes, commas, and line breaks", () => {
  const records = parseCsv('title,description,genre\n"River, Again","A ""quiet"" story\nwith a return.",Drama\n');
  assert.deepEqual(records, [{
    title: "River, Again",
    description: 'A "quiet" story\nwith a return.',
    genre: "Drama",
  }]);
  const [film] = parseBulkImport("title,description,genre\nRiver,Story,Drama", "films.csv");
  assert.equal(film.title, "River");
  assert.equal(film.description, "Story");
});

test("channel import accepts handles, channel IDs, and YouTube channel URLs only", () => {
  assert.deepEqual(normalizeChannelInput("@motion90s"), { type: "handle", value: "motion90s" });
  assert.deepEqual(normalizeChannelInput("https://www.youtube.com/@motion90s"), { type: "handle", value: "motion90s" });
  assert.deepEqual(normalizeChannelInput("UC1234567890123456789012"), { type: "id", value: "UC1234567890123456789012" });
  assert.throws(() => normalizeChannelInput("https://evil.example/@motion90s"), /Only youtube\.com/);
});

test("bulk import rejects malformed or untitled records", () => {
  assert.throws(() => parseBulkImport('{"not":"an array"}'), /JSON array/);
  assert.throws(() => makeDraft({ title: "  " }), /missing a title/);
  assert.throws(() => parseCsv('title,description\n"unfinished story'), /unfinished quoted field/);
});
