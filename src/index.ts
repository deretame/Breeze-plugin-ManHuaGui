import type {
  AdvancedSearchContract,
  CapabilitiesBundleContract,
  ChapterContentContract,
  ChapterPage,
  ChapterPayload,
  ChapterSummary,
  ComicDetailContract,
  ComicDetailPayload,
  ComicListScene,
  ComicListSceneBundleContract,
  ComicPagedListContract,
  CommentFeedContract,
  CommentFeedPayload,
  CommentItem,
  CommentMutationContract,
  CommentPostPayload,
  CommentRepliesContract,
  CommentRepliesPayload,
  CommentReplyPayload,
  FetchImageBytesPayload,
  FilterBundleContract,
  FunctionPageContract,
  GetFunctionPagePayload,
  GetPluginHomePagesBundlePayload,
  InfoContract,
  ListFavoriteFoldersResult,
  MoveFavoriteToFolderPayload,
  PluginHomePagesBundleContract,
  PluginHomeTab,
  ReadSnapshotContract,
  ReadSnapshotPayload,
  SearchComicPayload,
  SearchResultContract,
  SettingsBundleContract,
  StringMap,
  ToggleFavoritePayload,
  ToggleFavoriteResult,
  ToggleLikePayload,
  ToggleLikeResult,
  UserInfoBundleContract,
} from "breeze-plugin-kit";
import {
  NOT_FOUND_IMAGE_URL,
  PLUGIN_ID,
  createComicItem,
  createImage,
  toStringMap,
} from "./common";
import { decodeImageUrls } from "./decoder";
import { buildPluginInfo } from "./get-info";
import { buildChapterUrl, buildComicUrl, buildSearchUrl, fetchBytes, fetchHtml } from "./manhuagui";
import { parseComicDetail, parseSearchResult } from "./parser";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** 构建示例章节列表 */
function buildExampleChapters(comicId: string): ChapterSummary[] {
  void comicId;
  return [
    {
      id: "ep-1",
      requestId: "ep-1",
      logicalKey: "ep-1",
      storageChapterId: "ep-1",
      name: "第1话 占位章节",
      order: 1,
      extern: {},
    },
  ];
}

/** 解析 requestId / chapterId 到具体章节 */
function resolveChapterByRequestId(chapters: ChapterSummary[], input: unknown): ChapterSummary {
  const id = String(input ?? "").trim();
  return chapters.find((c) => c.requestId === id || c.id === id) ?? chapters[0];
}

/** 构建示例章节图片 */
function createChapterPages(comicId: string, storageChapterId: string): ChapterPage[] {
  return [
    {
      id: "p-1",
      name: "1.jpg",
      path: `comic/${comicId}/${storageChapterId}/1.jpg`,
      url: NOT_FOUND_IMAGE_URL,
      extern: {},
    },
    {
      id: "p-2",
      name: "2.jpg",
      path: `comic/${comicId}/${storageChapterId}/2.jpg`,
      url: NOT_FOUND_IMAGE_URL,
      extern: {},
    },
  ];
}

// ---------------------------------------------------------------------------
// getInfo — 插件注册信息
// ---------------------------------------------------------------------------

/** 插件注册信息 — Flask 宿主发现插件时调用 */
async function getInfo(): Promise<InfoContract> {
  return buildPluginInfo() as InfoContract;
}

// ---------------------------------------------------------------------------
// searchComic — 搜索漫画
// ---------------------------------------------------------------------------

/** 搜索漫画 — 关键字 / 分页 */
async function searchComic(payload: SearchComicPayload = {}): Promise<SearchResultContract> {
  console.log("[searchComic]", payload);
  const extern = toStringMap(payload.extern);
  const page = Math.max(1, Number(payload.page ?? 1) || 1);
  const keyword = String(payload.keyword ?? extern.keyword ?? "").trim() || "1";

  const url = buildSearchUrl(keyword, page);
  const html = await fetchHtml(url);
  const result = parseSearchResult(html, page);
  result.extern = { ...extern, keyword, page };
  return result;
}

// ---------------------------------------------------------------------------
// getComicDetail — 漫画详情
// ---------------------------------------------------------------------------

/** 漫画详情 — 基本信息 / 章节列表 / 推荐 */
async function getComicDetail(payload: ComicDetailPayload = {}): Promise<ComicDetailContract> {
  console.log("[getComicDetail]", payload);
  const comicId = String(payload.comicId ?? "").trim();
  if (!comicId) throw new Error("comicId 不能为空");

  const url = buildComicUrl(comicId);
  const html = await fetchHtml(url);
  const detail = parseComicDetail(html, comicId);
  detail.extern = payload.extern ?? null;
  return detail;
}

// ---------------------------------------------------------------------------
// getChapter — 章节内容（下载场景）
// ---------------------------------------------------------------------------

/** 获取章节内容（下载用） — 返回该章的全部图片 */
async function getChapter(payload: ChapterPayload = {}): Promise<ChapterContentContract> {
  console.log("[getChapter]", payload);
  const comicId = String(payload.comicId ?? "").trim();
  if (!comicId) throw new Error("comicId 不能为空");

  const chapters = buildExampleChapters(comicId);
  const chapter = resolveChapterByRequestId(chapters, payload.chapterId);
  const pages = createChapterPages(comicId, chapter.storageChapterId);

  return {
    source: PLUGIN_ID,
    comicId,
    chapterId: chapter.id,
    extern: payload.extern ?? null,
    scheme: {
      version: "1.0.0" as const,
      type: "chapterContent" as const,
      source: PLUGIN_ID,
    },
    data: {
      comic: {
        id: comicId,
        source: PLUGIN_ID,
        title: chapter.name,
        extern: chapter.extern,
      },
      chapter: {
        id: chapter.id,
        requestId: chapter.requestId,
        logicalKey: chapter.logicalKey,
        storageChapterId: chapter.storageChapterId,
        name: chapter.name,
        order: chapter.order,
        pages,
        extern: chapter.extern,
      },
      chapters: chapters.map((item) => ({
        id: item.id,
        requestId: item.requestId,
        logicalKey: item.logicalKey,
        storageChapterId: item.storageChapterId,
        name: item.name,
        order: item.order,
        extern: item.extern,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// getReadSnapshot — 阅读快照（在线阅读用）
// ---------------------------------------------------------------------------

/** 获取阅读快照 — 返回当前章节图片 + 章节导航列表 */
async function getReadSnapshot(payload: ReadSnapshotPayload = {}): Promise<ReadSnapshotContract> {
  console.log("[getReadSnapshot]", payload);
  const comicId = String(payload.comicId ?? "").trim();
  const chapterId = String(payload.chapterId ?? "").trim();
  if (!comicId) throw new Error("comicId 不能为空");
  if (!chapterId) throw new Error("chapterId 不能为空");

  const detail = await getComicDetail({ comicId, extern: payload.extern });
  const normal = toStringMap(toStringMap(detail.data).normal);
  const comicInfo = toStringMap(normal.comicInfo);
  const chapters = (normal.eps ?? []) as {
    id: string;
    requestId: string;
    logicalKey: string;
    storageChapterId: string;
    name: string;
    order: number;
    extern: Record<string, unknown>;
  }[];

  const currentChapter =
    chapters.find((c) => c.requestId === chapterId || c.id === chapterId) ?? chapters[0];
  if (!currentChapter) throw new Error("未找到章节");

  const url = buildChapterUrl(comicId, chapterId);
  const html = await fetchHtml(url);
  const imageUrls = decodeImageUrls(html);

  const pages = imageUrls.map((imageUrl, idx) => ({
    id: `${chapterId}-p-${idx}`,
    name: `${idx + 1}.jpg`,
    path: `comic/${comicId}/${chapterId}/${idx + 1}.jpg`,
    url: imageUrl,
    extern: { bid: comicId, cid: chapterId, index: idx },
  }));

  return {
    source: PLUGIN_ID,
    extern: payload.extern ?? null,
    data: {
      comic: {
        id: String(comicInfo.id ?? comicId),
        source: PLUGIN_ID,
        title: String(comicInfo.title ?? ""),
        extern: toStringMap(comicInfo.extern),
      },
      chapter: {
        id: currentChapter.id,
        requestId: currentChapter.requestId,
        logicalKey: currentChapter.logicalKey,
        storageChapterId: currentChapter.storageChapterId,
        name: currentChapter.name,
        order: currentChapter.order,
        pages,
        extern: currentChapter.extern,
      },
      chapters: chapters.map((item) => ({
        id: item.id,
        name: item.name,
        order: item.order,
        extern: item.extern,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// fetchImageBytes — 下载图片
// ---------------------------------------------------------------------------

/** 下载图片二进制数据 */
async function fetchImageBytes({
  url = "",
  timeoutMs = 30000,
  taskGroupKey = "",
  extern = {},
}: FetchImageBytesPayload = {}): Promise<Uint8Array<ArrayBufferLike>> {
  console.log("[fetchImageBytes]", { url, timeoutMs, taskGroupKey, extern });
  const targetUrl = String(url).trim();
  if (!targetUrl) throw new Error("url 不能为空");
  void { timeoutMs, taskGroupKey, extern };
  return fetchBytes(targetUrl);
}

// ---------------------------------------------------------------------------
// toggleLike — 点赞
// ---------------------------------------------------------------------------

/** 点赞 / 取消点赞 */
async function toggleLike(payload: ToggleLikePayload = {}): Promise<ToggleLikeResult> {
  console.log("[toggleLike]", payload);
  void payload;
  return { liked: !payload.currentLiked };
}

// ---------------------------------------------------------------------------
// toggleFavorite — 收藏
// ---------------------------------------------------------------------------

/** 收藏 / 取消收藏 */
async function toggleFavorite(payload: ToggleFavoritePayload = {}): Promise<ToggleFavoriteResult> {
  console.log("[toggleFavorite]", payload);
  void payload;
  return { favorited: !payload.currentFavorite, nextStep: "none" };
}

// ---------------------------------------------------------------------------
// listFavoriteFolders — 收藏夹列表
// ---------------------------------------------------------------------------

/** 获取收藏夹列表 */
async function listFavoriteFolders(): Promise<ListFavoriteFoldersResult> {
  return { items: [{ id: "fav-1", name: "默认收藏夹" }] };
}

// ---------------------------------------------------------------------------
// moveFavoriteToFolder — 移动到收藏夹
// ---------------------------------------------------------------------------

/** 将漫画移动到指定收藏夹 */
async function moveFavoriteToFolder(
  payload: MoveFavoriteToFolderPayload = {},
): Promise<{ ok: boolean }> {
  console.log("[moveFavoriteToFolder]", payload);
  void payload;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// getAdvancedSearchScheme — 高级搜索方案
// ---------------------------------------------------------------------------

/** 高级搜索方案 — 定义搜索页面上的筛选字段 */
async function getAdvancedSearchScheme(
  _payload: Record<string, unknown> = {},
): Promise<AdvancedSearchContract> {
  console.log("[getAdvancedSearchScheme]", _payload);
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "advancedSearch" as const,
      title: "高级搜索",
      fields: [
        {
          key: "sortBy",
          kind: "choice" as const,
          label: "排序",
          options: [
            { label: "最新", value: "latest" },
            { label: "最热", value: "hot" },
          ],
        },
        {
          key: "categories",
          kind: "multiChoice" as const,
          label: "分类选择",
          options: [
            { label: "示例分类 A", value: "cat-a" },
            { label: "示例分类 B", value: "cat-b" },
            { label: "示例分类 C", value: "cat-c" },
          ],
        },
        {
          key: "freeOnly",
          kind: "switch" as const,
          label: "只看免费",
        },
        {
          key: "minPages",
          kind: "text" as const,
          label: "最少页数",
        },
      ],
    },
    data: { values: { sortBy: "latest" } },
  };
}

// ---------------------------------------------------------------------------
// getComicListSceneBundle — 漫画列表场景
// ---------------------------------------------------------------------------

/** 漫画列表场景 — 定义排行榜 / 最新 / 分类等 tab */
async function getComicListSceneBundle(): Promise<ComicListSceneBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "comicListSceneBundle" as const,
    },
    data: {
      scene: {
        title: "示例排行榜",
        source: PLUGIN_ID,
        body: {
          type: "pluginPagedComicList" as const,
          request: {
            fnPath: "getRankingData",
            core: {},
            extern: { source: "ranking" },
          },
        },
        filter: {
          fnPath: "getRankingFilterBundle",
          extern: { source: "ranking" },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// getPluginHomePagesBundle — 插件首页
// ---------------------------------------------------------------------------

/** 构建排行榜 scene（与 getComicListSceneBundle 同源，供首页 tab 复用） */
function buildRankingScene(): ComicListScene {
  return {
    title: "示例排行榜",
    source: PLUGIN_ID,
    body: {
      type: "pluginPagedComicList" as const,
      request: {
        fnPath: "getRankingData",
        core: {},
        extern: { source: "ranking" },
      },
    },
    filter: {
      fnPath: "getRankingFilterBundle",
      extern: { source: "ranking" },
    },
  };
}

/** 插件首页 — 排行榜 tab（无登录插件只补第一页，不置 haveCloudFavorite） */
async function getPluginHomePagesBundle(
  _payload: GetPluginHomePagesBundlePayload = {},
): Promise<PluginHomePagesBundleContract> {
  const tabs: PluginHomeTab[] = [{ id: "ranking", title: "示例排行榜", scene: buildRankingScene() }];
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "homePagesBundle" as const,
    },
    data: { tabs },
  };
}

// ---------------------------------------------------------------------------
// getRankingData — 榜单数据
// ---------------------------------------------------------------------------

/** 分页漫画列表（排行榜 / 最新 / 分类等共享此函数） */
async function getRankingData(_payload: SearchComicPayload = {}): Promise<ComicPagedListContract> {
  console.log("[getRankingData]", _payload);
  const item = createComicItem("rank-1", "示例榜单漫画");
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "rankingFeed" as const,
    },
    data: {
      hasReachedMax: true,
      items: [item],
    },
  };
}

// ---------------------------------------------------------------------------
// getRankingFilterBundle — 榜单筛选
// ---------------------------------------------------------------------------

/** 榜单筛选 — choice 类型的 FilterField 示例 */
async function getRankingFilterBundle(): Promise<FilterBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      fields: [
        {
          key: "rankType",
          kind: "choice" as const,
          label: "榜单类型",
          options: [
            {
              label: "日榜",
              value: "day",
              result: { extern: { rankType: "day" } },
            },
            {
              label: "周榜",
              value: "week",
              result: { extern: { rankType: "week" } },
            },
            {
              label: "月榜",
              value: "month",
              result: { extern: { rankType: "month" } },
            },
          ],
        },
      ],
    },
    data: { values: { rankType: "day" } },
  };
}

// ---------------------------------------------------------------------------
// getCommentFeed — 评论列表
// ---------------------------------------------------------------------------

/** 获取评论列表 */
async function getCommentFeed(_payload: CommentFeedPayload = {}): Promise<CommentFeedContract> {
  console.log("[getCommentFeed]", _payload);
  const comment: CommentItem = {
    id: "c-1",
    author: { name: "示例用户", avatar: { url: "", path: "" } },
    content: "这是占位评论内容",
    createdAt: "2026-01-01",
    replyCount: 0,
    replies: [],
    extern: {},
  };
  return {
    source: PLUGIN_ID,
    extern: null,
    scheme: { version: "1.0.0" as const, type: "commentFeed" as const },
    data: {
      topItems: [],
      items: [comment],
      paging: { hasReachedMax: true },
      replyMode: "lazy",
      canComment: { comic: false, reply: false },
    },
  };
}

// ---------------------------------------------------------------------------
// loadCommentReplies — 评论回复列表
// ---------------------------------------------------------------------------

/** 获取评论的回复列表 */
async function loadCommentReplies(
  _payload: CommentRepliesPayload = {},
): Promise<CommentRepliesContract> {
  console.log("[loadCommentReplies]", _payload);
  return {
    source: PLUGIN_ID,
    extern: null,
    scheme: { version: "1.0.0" as const, type: "commentReplies" as const },
    data: {
      commentId: "c-1",
      items: [],
      paging: { hasReachedMax: true },
    },
  };
}

// ---------------------------------------------------------------------------
// postComment — 发送评论
// ---------------------------------------------------------------------------

/** 发送评论 */
async function postComment(_payload: CommentPostPayload = {}): Promise<CommentMutationContract> {
  console.log("[postComment]", _payload);
  return {
    source: PLUGIN_ID,
    scheme: { version: "1.0.0" as const, type: "commentMutation" as const },
    data: {
      ok: true,
      mode: "postComment",
      created: null,
      insertHint: { needsRefetch: true },
    },
  };
}

// ---------------------------------------------------------------------------
// postCommentReply — 回复评论
// ---------------------------------------------------------------------------

/** 回复评论 */
async function postCommentReply(
  _payload: CommentReplyPayload = {},
): Promise<CommentMutationContract> {
  console.log("[postCommentReply]", _payload);
  return {
    source: PLUGIN_ID,
    scheme: { version: "1.0.0" as const, type: "commentMutation" as const },
    data: {
      ok: true,
      mode: "postReply",
      parentId: "c-1",
      created: null,
      insertHint: {
        strategy: "prepend",
        targetCommentId: "c-1",
        needsRefetch: true,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// getSettingsBundle — 设置方案
// ---------------------------------------------------------------------------

/**
 * 设置方案 — 定义插件设置页面 UI。
 *
 * 支持的 FieldKind:
 * - `text`     : 文本输入
 * - `password` : 密码输入（掩码）
 * - `switch`   : 开关
 * - `choice`   : 单选下拉 / 选择
 * - `multiChoice` : 多选弹窗
 *
 * fnPath 可用于字段变更时回调插件函数：
 *   当用户在设置页修改字段值后，插件会收到 fnPath 对应的调用，
 *   参数为 { key, value, allValues }。
 * persist: false 会禁止自动保存到本地数据库。
 */
async function getSettingsBundle(): Promise<SettingsBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "settings" as const,
      sections: [],
    },
    data: {
      canShowUserInfo: false,
      values: {},
    },
  };
}

// ---------------------------------------------------------------------------
// Capabilities — "操作" 区段
// ---------------------------------------------------------------------------

/** 设置页底部"操作"区段 */
async function getCapabilitiesBundle(): Promise<CapabilitiesBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "capabilities" as const,
      actions: [{ key: "clear", title: "清理插件缓存", fnPath: "clearPluginCache" }],
    },
    data: {},
  };
}

// ---------------------------------------------------------------------------
// getUserInfoBundle — 用户信息卡片
// ---------------------------------------------------------------------------

/** 设置页用户信息卡片 */
async function getUserInfoBundle(): Promise<UserInfoBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: { version: "1.0.0" as const, type: "userInfo" as const },
    data: {
      title: "账号信息",
      avatar: createImage({
        id: "u-1",
        url: "",
        name: "avatar",
        path: "u/1.jpg",
        extern: {},
      }),
      lines: ["用户名: example", "等级: 1", "经验: 0"],
    },
  };
}

// ---------------------------------------------------------------------------
// getFunctionPage — 插件自定义页面
// ---------------------------------------------------------------------------

/** 插件自定义页面（示例中只抛出错误，实际使用时按 FunctionPageContract 返回 body 节点） */
async function getFunctionPage(
  _payload: GetFunctionPagePayload = {},
): Promise<FunctionPageContract> {
  throw new Error(
    "getFunctionPage 未实现——示例中不包含 FunctionPage，请使用 ComicListSceneBundleContract",
  );
}

// ---------------------------------------------------------------------------
// fnPath 回调 — 设置页字段变更时调用
// ---------------------------------------------------------------------------

/** 示例：用户名/密码变更回调——建议在两次变更完后统一校验并登录 */
async function onAuthChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onAuthChanged]", payload);
  void payload;
  return {};
}

/** 示例：记住密码开关变更回调 */
async function onRememberChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onRememberChanged]", payload);
  if (payload.value) {
    // 用户打开了"记住密码"，持久化凭据
    void payload.allValues;
  }
  return {};
}

/** 示例：主题变更回调 */
async function onThemeChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onThemeChanged]", payload);
  void payload;
  return {};
}

/** 示例：画质变更回调 */
async function onQualityChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onQualityChanged]", payload);
  void payload;
  return {};
}

/** 示例：成人内容开关变更回调 */
async function onAdultChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onAdultChanged]", payload);
  void payload;
  return {};
}

/** 示例：屏蔽标签多选变更回调 */
async function onHiddenTagsChanged(
  payload: { key?: string; value?: unknown; allValues?: StringMap } = {},
): Promise<Record<string, unknown>> {
  console.log("[onHiddenTagsChanged]", payload);
  void payload;
  return {};
}

/** 示例：清理插件缓存操作 */
async function clearPluginCache(): Promise<Record<string, unknown>> {
  return { ok: true };
}

// ---------------------------------------------------------------------------
// default export — 导出所有函数
// ---------------------------------------------------------------------------

export default {
  // core
  getInfo,
  searchComic,
  getComicDetail,
  getChapter,
  getReadSnapshot,
  fetchImageBytes,

  // social
  toggleLike,
  toggleFavorite,
  listFavoriteFolders,
  moveFavoriteToFolder,
  getCommentFeed,
  loadCommentReplies,
  postComment,
  postCommentReply,

  // discovery
  getAdvancedSearchScheme,
  getComicListSceneBundle,
  getRankingData,
  getRankingFilterBundle,
  getPluginHomePagesBundle,

  // settings
  getSettingsBundle,
  getCapabilitiesBundle,
  getUserInfoBundle,

  // fnPath callbacks
  onAuthChanged,
  onRememberChanged,
  onThemeChanged,
  onQualityChanged,
  onAdultChanged,
  onHiddenTagsChanged,
  clearPluginCache,

  // function pages
  getFunctionPage,
};
