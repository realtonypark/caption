import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export const publicAddress = (address) => {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress())
      ip = ip.toIPv4Address();
    return ip.range() === "unicast";
  } catch {
    return false;
  }
};

export const checkedUrl = async (raw, resolve = lookup) => {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Use a public HTTP or HTTPS page.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolve(host, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !publicAddress(address))
  )
    throw new Error("Private network addresses cannot be imported.");
  return { url, addresses };
};

export const downloadSource = async (raw, signal) => {
  let target = raw;
  const paper = /^https:\/\/(?:www\.)?arxiv\.org\/abs\/([\w./-]+)$/i.exec(raw);
  if (paper) target = `https://arxiv.org/pdf/${paper[1]}`;
  for (let hop = 0; hop < 6; hop++) {
    const { url, addresses } = await checkedUrl(target);
    // Pin the checked DNS result; a second resolution must not reach a private host.
    const agent = new Agent({
      connect: {
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        },
      },
    });
    try {
      const response = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CaptionReader/1.0)",
          Accept: "text/html,application/pdf",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location)
          throw new Error("That page redirected without a destination.");
        target = new URL(location, url).href;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          `That site returned ${response.status}. Try downloading its PDF or another public link.`,
        );
      }
      const type = (
        response.headers.get("content-type") ?? ""
      ).toLowerCase();
      if (!/html|application\/pdf/.test(type)) {
        await response.body?.cancel();
        throw new Error("That link is not an article or PDF.");
      }
      const limit = type.includes("application/pdf") ? 25_000_000 : 6_000_000;
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit)
          throw new Error("This source is too large to import.");
        chunks.push(chunk);
      }
      return { bytes: Buffer.concat(chunks), type, url: url.href };
    } finally {
      await agent.close();
    }
  }
  throw new Error("That link redirected too many times.");
};

export const extractArticle = (html, url) => {
  const { document } = parseHTML(html);
  const base = document.createElement("base");
  base.setAttribute("href", url);
  document.head?.appendChild(base);
  // Server-rendered article text may arrive in hidden streaming segments.
  for (const segment of document.querySelectorAll('div[hidden][id^="S:"]')) {
    const slot =
      document.getElementById(segment.id.replace("S:", "B:")) ??
      document.getElementById(segment.id.replace("S:", "P:"));
    if (slot?.parentNode) {
      while (segment.firstChild)
        slot.parentNode.insertBefore(segment.firstChild, slot);
      segment.remove();
    } else segment.removeAttribute("hidden");
  }
  for (const table of document.querySelectorAll("table"))
    if (table.querySelector("th, caption")) table.removeAttribute("class");
  const article = new Readability(document, { charThreshold: 200 }).parse();
  if (!article?.content)
    throw new Error(
      "No readable article was found. Download a PDF or try its public article link.",
    );
  const { document: clean } = parseHTML(
    `<html><body>${article.content}</body></html>`,
  );
  const paragraphs = [];
  let heading;
  for (const element of clean.querySelectorAll("h1,h2,h3,h4,p,li,pre,table")) {
    if (element.parentElement?.closest("li,pre,table")) continue;
    const text = element.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/^H\d$/.test(element.tagName)) {
      if (text !== article.title) heading = text;
      continue;
    }
    paragraphs.push({ text, explanation: "", ...(heading ? { heading } : {}) });
    heading = undefined;
  }
  if (
    !paragraphs.length ||
    paragraphs.map((p) => p.text).join(" ").length < 160
  )
    throw new Error(
      "That page has too little readable text. It may require a subscription or JavaScript.",
    );
  return {
    title: article.title || new URL(url).hostname,
    author: (article.byline || article.siteName || new URL(url).hostname).slice(
      0,
      160,
    ),
    description: (article.excerpt || "").slice(0, 400),
    location: url,
    paragraphs,
  };
};
