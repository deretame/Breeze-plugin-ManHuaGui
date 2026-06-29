# Breeze Plugin Example

Breeze 插件示例工程，包含所有 API 类型的占位实现。新插件推荐直接 clone 本仓库进行改造。

## 文档

插件开发文档：[https://deretame.github.io/plugin-dev-docs/](https://deretame.github.io/plugin-dev-docs/)

## 已导出的 fnPath

### 核心
- `getInfo` — 插件信息
- `searchComic` — 搜索漫画
- `getComicDetail` — 漫画详情
- `getReadSnapshot` — 阅读快照
- `getChapter` — 章节内容
- `fetchImageBytes` — 下载图片

### 社交
- `toggleLike` — 点赞
- `toggleFavorite` — 收藏
- `listFavoriteFolders` — 收藏夹列表
- `moveFavoriteToFolder` — 移动到收藏夹
- `getCommentFeed` — 评论列表
- `loadCommentReplies` — 加载回复
- `postComment` — 发评论
- `postCommentReply` — 回复评论

### 发现
- `getAdvancedSearchScheme` — 高级搜索方案
- `getComicListSceneBundle` — 列表场景
- `getRankingData` — 榜单数据
- `getRankingFilterBundle` — 榜单筛选

### 设置
- `getSettingsBundle` — 设置方案
- `getCapabilitiesBundle` — 能力操作
- `getUserInfoBundle` — 用户信息

### 回调
- `onAuthChanged` / `onRememberChanged` / `onThemeChanged` / `onQualityChanged` / `onAdultChanged` / `onHiddenTagsChanged` — 设置字段变更
- `clearPluginCache` — 清理缓存

## 快速开始

```bash
git clone https://github.com/deretame/Breeze-plugin-example.git your-plugin-name
cd your-plugin-name
pnpm install
```

克隆后删除 `.git` 重新初始化：

```bash
# Windows
Remove-Item -Recurse -Force .git

# macOS / Linux
rm -rf .git

git init
```

然后修改 `src/common.ts` 的 `PLUGIN_ID` 和 `src/get-info.ts` 的插件信息。

## 开发

```bash
pnpm run dev
```

dev server 启动后输出 bundle 地址，在 Breeze 中通过"网络安装"加载即可调试。支持热更新。

## 构建

```bash
pnpm run build
```

构建流程：typecheck → 同步版本号 → 生成 `manifest.json` → rspack 打包 → Brotli 压缩。

**构建前请先更新 `src/get-info.ts` 中的 `version` 字段。**
