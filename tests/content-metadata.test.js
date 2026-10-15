"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function validate(t, edit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-metadata-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  ["_scripts", "_data", "_posts", "pages"].forEach(function (dir) {
    fs.mkdirSync(path.join(root, dir));
  });
  fs.copyFileSync(path.join(__dirname, "..", "_scripts", "validate-content.rb"), path.join(root, "_scripts", "validate-content.rb"));
  const fixture = {
    post: { content_tracks: ["oss"], tags: ["Apache Spark", "Compaction"] },
    tags: [
      { id: "spark", label: "Apache Spark", description: "Spark APIs.", aliases: ["Spark"] },
      { id: "compaction", label: "Compaction", description: "Small-file consolidation." }
    ],
    legacy: { Fabric: { track: "fabric" }, Lakehouse: { all: true } }
  };
  if (edit) edit(fixture);
  const writeData = function (name, data) {
    fs.writeFileSync(path.join(root, "_data", name + ".yml"), JSON.stringify(data));
  };
  writeData("content_tracks", {
    oss: { label: "OSS & fundamentals", description: "Reusable concepts." },
    fabric: { label: "Microsoft Fabric", description: "Fabric implementation." }
  });
  writeData("technology_marks", {});
  writeData("article_tags", fixture.tags);
  writeData("legacy_tags", fixture.legacy);
  fs.writeFileSync(path.join(root, "pages", "concept-playground.md"), "");
  fs.writeFileSync(path.join(root, "_posts", "DRAFT-Unpublished.md"), "---\npublished: true\ntags: [Fabric]\n---\nUnpublished draft.");
  fs.writeFileSync(path.join(root, "_posts", "2024-01-01-Test.md"), "---\n" + JSON.stringify(fixture.post) + "\n---\nExample.");
  const result = spawnSync("ruby", [path.join(root, "_scripts", "validate-content.rb")], { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

test("canonical tags and historical aliases validate while undated drafts remain excluded", function (t) {
  const result = validate(t);
  assert.equal(result.status, 0, result.stderr);
});

test("article metadata rejects unknown, alias, duplicate, missing, and excessive tags", function (t) {
  for (const tags of [["Spark", "Compaction"], ["spark", "Compaction"], ["Fabric", "Compaction"], ["Compaction", "Compaction"], [], undefined, "Compaction", Array(6).fill("Compaction")]) {
    const result = validate(t, function (fixture) { fixture.post.tags = tags; });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /2-5 unique canonical labels/);
  }
});

test("registry rejects tags overlapping tracks and retired platform aliases", function (t) {
  for (const label of ["Fabric", "Microsoft Fabric", "OSS & fundamentals", "Lakehouse"]) {
    const result = validate(t, function (fixture) { fixture.tags[0].label = label; });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /overlaps a content track or retired tag/);
  }
});

test("registry rejects duplicate IDs, malformed IDs, and ambiguous aliases", function (t) {
  const edits = [
    function (fixture) { fixture.tags[1].id = "spark"; },
    function (fixture) { fixture.tags[1].id = "Not A Stable ID"; },
    function (fixture) { fixture.tags[1].aliases = ["Spark"]; }
  ];
  for (const edit of edits) {
    const result = validate(t, edit);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate id|kebab-case|ambiguous tag/);
  }
});

test("legacy platform destinations must reference a real track", function (t) {
  const result = validate(t, function (fixture) { fixture.legacy.Fabric.track = "missing"; });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must point to a known track/);
});
