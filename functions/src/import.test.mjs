import { test } from "node:test";
import assert from "node:assert/strict";
import { publicAddress, checkedUrl, extractArticle } from "./import.mjs";

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
test("extracts article text and headings without evaluating source scripts", async () => {
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
  const article = await extractArticle(source, "https://example.com/article");
  assert.equal(article.title, "A real article");
  assert.ok(article.paragraphs.some((p) => p.heading === "Everyday access"));
  assert.ok(
    article.paragraphs.every((p) => !p.text.includes("Do not execute")),
  );
});

test("keeps article images as figure paragraphs with absolute URLs", async () => {
  const source =
    "<html><head><title>With figures</title></head><body><article><h1>With figures</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    '</p><img src="/files/map.png" alt="A map"><p>' +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    "</p></article></body></html>";
  const article = await extractArticle(source, "https://example.com/article", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  assert.deepEqual(
    article.paragraphs.map((p) => p.image ?? null),
    [null, "https://example.com/files/map.png", null],
  );
  assert.equal(article.paragraphs[1].text, "(Figure)");
});

test("keeps small embedded images and counts oversized ones", async () => {
  const tiny =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const source =
    "<html><head><title>Embedded</title></head><body><article><h1>Embedded</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    `</p><img src="${tiny}" alt="Tiny"><img src="data:image/png;base64,${"A".repeat(400_000)}"><p>` +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    "</p></article></body></html>";
  const article = await extractArticle(source, "https://example.com/article");
  assert.deepEqual(
    article.paragraphs.map((p) => p.image ?? null),
    [null, tiny, null],
  );
  assert.match(article.description, /1 figures omitted/);
});

test("omits article images on private network hosts", async () => {
  const source =
    "<html><head><title>Private</title></head><body><article><h1>Private</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    '</p><img src="https://intranet.test/map.png"><p>' +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    "</p></article></body></html>";
  const article = await extractArticle(
    source,
    "https://example.com/article",
    async () => [{ address: "127.0.0.1", family: 4 }],
  );
  assert.ok(article.paragraphs.every((p) => !p.image));
  assert.match(article.description, /1 figures omitted/);
});

test("omits non-web article image schemes", async () => {
  const source =
    "<html><head><title>Schemes</title></head><body><article><h1>Schemes</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    '</p><img src="ftp://example.com/map.png"><p>' +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    "</p></article></body></html>";
  const article = await extractArticle(source, "https://example.com/article");
  assert.ok(article.paragraphs.every((p) => !p.image));
  assert.match(article.description, /1 figures omitted/);
});

test("skips malformed article images without failing the import", async () => {
  const source =
    "<html><head><title>Bad figure</title></head><body><article><h1>Bad figure</h1><p>" +
    "The city relies on reliable connections and ordinary maintenance. ".repeat(
      10,
    ) +
    '</p><img src="https://"><p>' +
    "Services matter when people can reach them safely and dependably. ".repeat(
      10,
    ) +
    "</p></article></body></html>";
  const article = await extractArticle(source, "https://example.com/article");
  assert.ok(article.paragraphs.every((p) => !p.image));
  assert.match(article.description, /1 figures omitted/);
});
