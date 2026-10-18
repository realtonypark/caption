import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicAddress,
  checkedUrl,
  extractArticle,
  googleDocExportUrl,
  nextHop,
  filenameFromDisposition,
} from "./import.mjs";

test("blocks private, mapped, metadata, multicast, and reserved network addresses", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.168.0.1",
    "172.16.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
  ])
    assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
  await assert.rejects(
    checkedUrl("https://article.test/", async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    /Private/,
  );
  for (const url of [
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://example.com:8080",
  ])
    await assert.rejects(checkedUrl(url), /public/);
});
test("extracts article text and headings without evaluating source scripts", () => {
  const source =
    "<html><head><title>A real article</title></head><body><nav>Menu</nav><article><h1>A real article</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    "</p><h2>Everyday access</h2><p>" +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    '</p><script>throw new Error("Do not execute source HTML")</script></article></body></html>';
  const article = extractArticle(source, "https://example.com/article");
  assert.equal(article.title, "A real article");
  assert.ok(article.paragraphs.some((p) => p.heading === "Everyday access"));
  assert.ok(
    article.paragraphs.every((p) => !p.text.includes("Do not execute")),
  );
});
test("turns shared Google Doc links into PDF exports and leaves published pages alone", () => {
  const exported =
    "https://docs.google.com/document/d/1AbC-d_9/export?format=pdf";
  for (const url of [
    "https://docs.google.com/document/d/1AbC-d_9/edit?usp=sharing",
    "https://docs.google.com/document/d/1AbC-d_9",
    "https://docs.google.com/document/u/0/d/1AbC-d_9/edit#heading=h.x",
  ])
    assert.equal(googleDocExportUrl(url), exported, url);
  for (const url of [
    "https://docs.google.com/document/d/e/2PACX-1vT/pub",
    "https://docs.google.com/spreadsheets/d/1AbC/edit",
    "https://example.com/document/d/1AbC/edit",
    "http://docs.google.com/document/d/1AbC/edit",
  ])
    assert.equal(googleDocExportUrl(url), undefined, url);
});
test("explains private Google files instead of importing the sign-in page", () => {
  assert.throws(
    () =>
      nextHop(
        "https://accounts.google.com/ServiceLogin?continue=x",
        "https://docs.google.com/document/d/1/export?format=pdf",
      ),
    /private/,
  );
  assert.equal(
    nextHop("/next", "https://example.com/start"),
    "https://example.com/next",
  );
});
test("reads a download name from Content-Disposition", () => {
  assert.equal(
    filenameFromDisposition(
      `attachment; filename="Notes.pdf"; filename*=UTF-8''My%20Caf%C3%A9%20Notes.pdf`,
    ),
    "My Café Notes.pdf",
  );
  assert.equal(
    filenameFromDisposition('attachment; filename="plain.pdf"'),
    "plain.pdf",
  );
  assert.equal(filenameFromDisposition(null), "");
  assert.equal(
    filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A"),
    "",
  );
});
