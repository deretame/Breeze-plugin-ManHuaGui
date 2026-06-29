/**
 * 漫画柜 HTML 解析器（基于 BreezeHtml / cheerio 子集）。
 */

import type { BreezeApi, BreezeSelection } from "../types/breeze-html";
import type {
  ChapterSummary,
  ComicDetailContract,
  ComicDetailNormal,
  ComicListItem,
  ImageItem,
  MetadataListItem,
  PagingInfo,
  SearchResultContract,
  StringMap,
} from "../types/type";
import {
  buildChapterUrl,
  buildComicUrl,
  normalizeUrl,
  parseComicPath,
} from "./manhuagui";
import { PLUGIN_ID, createActionItem, createImage } from "./common";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function loadHtml(html: string): BreezeApi {
  return BreezeHtml.load(html);
}

function extractText($el: BreezeSelection): string {
  return $el.text().trim();
}

function extractAttr($el: BreezeSelection, name: string): string {
  return ($el.attr(name) ?? "").trim();
}

function firstText($root: BreezeSelection, selector: string): string {
  return $root.find(selector).first().text().trim();
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseStatusText(text: string): {
  finished: boolean;
  updatedAt: string;
  latestChapterName: string;
} {
  const t = text.replace(/\s+/g, " ");
  const finished = /完結/.test(t) || /已完结/.test(t);
  let updatedAt = "";
  let latestChapterName = "";

  const dateMatch = t.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) updatedAt = dateMatch[1];

  const chapterMatch = t.match(/更新至\s*[[【]?([^\]】]+)/);
  if (chapterMatch) latestChapterName = chapterMatch[1].trim();

  return { finished, updatedAt, latestChapterName };
}

function buildComicListItem(
  bid: string,
  title: string,
  subtitle: string,
  coverUrl: string,
  statusInfo: ReturnType<typeof parseStatusText>,
  author: string[],
  tags: string[],
): ComicListItem {
  const cover: ImageItem = createImage({
    id: bid,
    url: normalizeUrl(coverUrl),
    name: `${bid}.jpg`,
    path: `comic/${bid}/cover.jpg`,
    extern: { bid },
  });

  return {
    source: PLUGIN_ID,
    id: bid,
    title,
    subtitle,
    finished: statusInfo.finished,
    likesCount: 0,
    viewsCount: 0,
    updatedAt: statusInfo.updatedAt,
    cover,
    metadata: [
      {
        type: "author",
        name: "作者",
        value: author.length
          ? author.map((a) => createActionItem(a))
          : [createActionItem("未知")],
      },
      {
        type: "tags",
        name: "類型",
        value: tags.length
          ? tags.map((t) => createActionItem(t))
          : [createActionItem("未知")],
      },
    ],
    raw: {
      bid,
      title,
      subtitle,
      author,
      tags,
      finished: statusInfo.finished,
      updatedAt: statusInfo.updatedAt,
      latestChapterName: statusInfo.latestChapterName,
    },
    extern: { bid },
  };
}

function buildPaging(page: number, total: number, pageSize = 10): PagingInfo {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pages,
    total,
    hasReachedMax: page >= pages,
  };
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

export function parseSearchResult(
  html: string,
  page: number,
): SearchResultContract {
  const root = loadHtml(html);
  const items: ComicListItem[] = [];

  root(".book-result > ul > li").each(
    (_idx: number, li: BreezeSelection) => {
      const $li = root(li);

      const $cover = $li.find(".book-cover a.bcover").first();
      const href = extractAttr($cover, "href");
      const parsed = parseComicPath(href);
      if (!parsed) return;
      const bid = parsed.bid;

      const title =
        extractAttr($cover, "title") || extractText($li.find("dt a").first());
      const $subtitleA = $li.find("dt small a").first();
      const subtitle = $subtitleA.length > 0 ? extractText($subtitleA) : "";
      const coverUrl = extractAttr($cover.find("img").first(), "src");

      const statusText = extractText($li.find(".tags.status").first());
      const statusInfo = parseStatusText(statusText);

      const authors: string[] = [];
      $li.find(".tags").each((_i: number, el: BreezeSelection) => {
        const $el = root(el);
        const text = $el.text();
        if (text.includes("作者：")) {
          $el.find("a").each((_j: number, a: BreezeSelection) => {
            const $a = root(a);
            const name = $a.text().trim();
            if (name) authors.push(name);
          });
        }
      });

      const tags: string[] = [];
      $li.find(".tags").each((_i: number, el: BreezeSelection) => {
        const $el = root(el);
        const text = $el.text();
        if (text.includes("類型：")) {
          $el.find("a").each((_j: number, a: BreezeSelection) => {
            const $a = root(a);
            const name = $a.text().trim();
            if (name) tags.push(name);
          });
        }
      });

      items.push(
        buildComicListItem(
          bid,
          title,
          subtitle,
          coverUrl,
          statusInfo,
          authors,
          tags,
        ),
      );
    },
  );

  const totalText = root(".result-count strong").last().text().trim();
  const total = safeNumber(totalText.replace(/,/g, ""));
  const paging = buildPaging(page, total, 10);

  return {
    source: PLUGIN_ID,
    extern: { page },
    scheme: {
      version: "1.0.0" as const,
      type: "searchResult" as const,
      source: PLUGIN_ID,
      list: "comicGrid",
    },
    data: { paging, items },
    paging,
    items,
  };
}

// ---------------------------------------------------------------------------
// detail
// ---------------------------------------------------------------------------

function parseDetailTags(
  root: BreezeApi,
  $root: BreezeSelection,
  label: string,
): string[] {
  const result: string[] = [];
  $root.find("ul.detail-list li span").each(
    (_idx: number, span: BreezeSelection) => {
      const $span = root(span);
      const strongText = $span.find("strong").first().text().trim();
      if (strongText.includes(label)) {
        $span.find("a").each((_i: number, a: BreezeSelection) => {
          const name = root(a).text().trim();
          if (name) result.push(name);
        });
      }
    },
  );
  return result;
}

function parseDetailStatusText($root: BreezeSelection): {
  finished: boolean;
  updatedAt: string;
  totalViews: number;
  totalLikes: number;
} {
  const text = $root.find("ul.detail-list li.status").first().text();
  const { finished, updatedAt } = parseStatusText(text);
  return { finished, updatedAt, totalViews: 0, totalLikes: 0 };
}

function parseChapters(
  root: BreezeApi,
  $root: BreezeSelection,
  bid: string,
): ChapterSummary[] {
  const groups: ChapterSummary[][] = [];

  // 漫画柜把章节分成多个 ul，每个 ul 内部是倒序的；
  // 按页面顺序遍历每个 ul，先将其内部倒序，再整体拼接。
  $root.find("#chapter-list-1 ul").each(
    (_idx: number, ul: BreezeSelection) => {
      const $ul = root(ul);
      const group: ChapterSummary[] = [];
      $ul.find("li a").each((_i: number, a: BreezeSelection) => {
        const $a = root(a);
        const href = extractAttr($a, "href");
        const parsed = parseComicPath(href);
        if (!parsed?.cid) return;
        const cid = parsed.cid;
        const name = extractAttr($a, "title") || extractText($a);
        group.push({
          id: cid,
          requestId: cid,
          logicalKey: cid,
          storageChapterId: cid,
          name,
          order: 0,
          extern: { bid, cid },
        });
      });
      groups.push(group.reverse());
    },
  );

  const flat = groups.flat();
  flat.forEach((c, idx) => {
    c.order = idx + 1;
  });
  return flat;
}

export function parseComicDetail(
  html: string,
  bid: string,
): ComicDetailContract {
  const root = loadHtml(html);
  const $detail = root(".book-detail");

  const title = firstText($detail, ".book-title h1");
  const description = root("#intro-cut").first().text().trim();
  const coverUrl = extractAttr(root(".book-cover img").first(), "src");

  const authors = parseDetailTags(root, $detail, "作者：");
  const tags = parseDetailTags(root, $detail, "劇情：");
  const status = parseDetailStatusText($detail);
  const chapters = parseChapters(root, root("#chapter-list-1"), bid);

  const cover: ImageItem = createImage({
    id: bid,
    url: normalizeUrl(coverUrl),
    name: `${bid}.jpg`,
    path: `comic/${bid}/cover.jpg`,
    extern: { bid },
  });

  const creator = {
    id: authors[0] ?? "unknown",
    name: authors[0] ?? "未知",
    avatar: createImage({
      id: `author-${authors[0] ?? "unknown"}`,
      url: "",
      name: "avatar",
      path: "placeholder/author.jpg",
      extern: {},
    }),
    onTap: {} as StringMap,
    extern: {},
  };

  const metadata: MetadataListItem[] = [
    {
      type: "author",
      name: "作者",
      value: authors.length
        ? authors.map((a) => createActionItem(a))
        : [createActionItem("未知")],
    },
    {
      type: "tags",
      name: "類型",
      value: tags.length
        ? tags.map((t) => createActionItem(t))
        : [createActionItem("未知")],
    },
  ];

  const normal: ComicDetailNormal = {
    comicInfo: {
      id: bid,
      title,
      titleMeta: [
        createActionItem(`章節數：${chapters.length}`),
        createActionItem(`狀態：${status.finished ? "完結" : "連載中"}`),
      ],
      creator,
      description,
      cover,
      metadata,
      extern: { bid },
    },
    eps: chapters,
    recommend: [],
    totalViews: status.totalViews,
    totalLikes: status.totalLikes,
    totalComments: 0,
    isFavourite: false,
    isLiked: false,
    allowComments: false,
    allowLike: false,
    allowCollected: false,
    allowDownload: true,
    extern: { bid },
  };

  return {
    source: PLUGIN_ID,
    comicId: bid,
    extern: { bid },
    scheme: {
      version: "1.0.0" as const,
      type: "comicDetail" as const,
      source: PLUGIN_ID,
    },
    data: {
      normal,
      raw: {
        bid,
        title,
        authors,
        tags,
        description,
        finished: status.finished,
        updatedAt: status.updatedAt,
        chapters,
      },
    },
  };
}

export { buildComicUrl, buildChapterUrl };
