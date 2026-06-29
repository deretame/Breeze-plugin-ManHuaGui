/**
 * 漫画柜（manhuagui.com / 看漫画繁体版）站点常量与网络请求封装。
 */

export const BASE_URL = "https://tw.manhuagui.com";
export const IMAGE_BASE_HOST = "hamreus.com";
export const DEFAULT_IMAGE_SERVER = "us1";
export const REFERER = BASE_URL + "/";

/** 统一请求头 */
export function buildHeaders(): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.0",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    Referer: REFERER,
  };
}

/** 将相对协议 URL（//...）补全为 https:// */
export function normalizeUrl(url: string): string {
  const s = String(url ?? "").trim();
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `${BASE_URL}${s}`;
  return s;
}

/** 搜索页 URL */
export function buildSearchUrl(keyword: string, page = 1): string {
  const encoded = encodeURIComponent(keyword);
  if (page <= 1) return `${BASE_URL}/s/${encoded}.html`;
  return `${BASE_URL}/s/${encoded}_p${page}.html`;
}

/** 漫画详情页 URL */
export function buildComicUrl(bid: string | number): string {
  return `${BASE_URL}/comic/${bid}/`;
}

/** 阅读页 URL */
export function buildChapterUrl(
  bid: string | number,
  cid: string | number,
): string {
  return `${BASE_URL}/comic/${bid}/${cid}.html`;
}

/** 图片完整 URL */
export function buildImageUrl(
  server: string,
  path: string,
  file: string,
  sl: { e: number; m: string },
): string {
  return `https://${server}.${IMAGE_BASE_HOST}${path}${file}?e=${sl.e}&m=${sl.m}`;
}

/** 通用 HTML 请求 */
export async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  return resp.text();
}

/** 通用二进制请求 */
export async function fetchBytes(url: string): Promise<Uint8Array> {
  const resp = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${url}`);
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

/** 从漫画柜 URL /comic/{bid}/ 或 /comic/{bid}/{cid}.html 中提取 bid/cid */
export function parseComicPath(
  href: string,
): { bid: string; cid?: string } | null {
  const m = href.match(/\/comic\/(\d+)(?:\/(\d+)\.html)?/);
  if (!m) return null;
  return { bid: m[1], cid: m[2] };
}
