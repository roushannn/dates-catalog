// Instagram's share sheet sends links like https://www.instagram.com/p/<code>/?igsh=...
// (posts), /reel/<code>/ or /tv/<code>/. Profile links are deliberately not matched.
const INSTAGRAM_URL_PATTERN = /https?:\/\/(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i;

// Instagram serves an empty JS shell to normal browsers, but gives link-preview crawlers
// server-rendered meta tags containing the caption.
const CRAWLER_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export interface InstagramPost {
  url: string;
  author: string | null;
  caption: string;
}

export function findInstagramUrl(text: string): string | null {
  const m = text.match(INSTAGRAM_URL_PATTERN);
  // Normalise to the canonical post URL, dropping tracking params like ?igsh=.
  if (!m) return null;
  const type = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase();
  return `https://www.instagram.com/${type}/${m[2]}/`;
}

function decodeHtmlEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return named[code.toLowerCase()] ?? whole;
  });
}

function getMetaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

// Hashtag/mention-only lines ("#LikeTheEgg #EggGang") are noise for event extraction.
function stripTagOnlyLines(caption: string): string {
  return caption
    .split(/\r?\n/)
    .filter((line) => !/^(?:\s*[#@][\w.]+)+\s*$/.test(line))
    .join("\n")
    .trim();
}

/**
 * Fetches a public post's caption. Returns null if Instagram doesn't hand it over
 * (private post, login wall, rate limiting, network error) — callers should fall back
 * to asking the user for the details.
 */
export async function fetchInstagramPost(url: string): Promise<InstagramPost | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT, "Accept-Language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch (err) {
    console.error("Instagram fetch failed:", err);
    return null;
  }

  // og:description looks like: `12 likes, 3 comments - someuser on January 4, 2019: "caption".`
  // The "on <date>" is the posting date, so it's dropped to keep it out of date detection.
  const description = getMetaContent(html, "og:description") ?? getMetaContent(html, "description");
  if (!description) return null;

  const m = description.match(/^.*?-\s*([\w.]+)\s+on\s+[^:]+:\s*"([\s\S]*)"\.?\s*$/);
  if (!m) return null;

  const caption = stripTagOnlyLines(m[2]);
  if (!caption) return null;
  return { url, author: m[1], caption };
}
