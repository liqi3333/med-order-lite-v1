# Med Order Lite 项目结构说明

## 根目录

- `index.html`：前端入口页面。
- `src/`：前端 TypeScript 源码。
- `dist/`：前端编译输出，不手工修改。
- `public/`：PWA 图标、manifest、service worker 和药物快照。
- `server/`：本地后端 API、插件系统和药物知识库。
- `scripts/`：开发启动脚本。
- `package.json`：根项目脚本。

## 前端目录

- `src/main.ts`：启动前端，加载后端药物库与分类字典。
- `src/router.ts`：页面路由，只保留首页、药物库、导入药物、生成医嘱。
- `src/components/shell.ts`：页面布局、侧边栏、导航。
- `src/components/drug-card.ts`：药物卡片。
- `src/pages/home-page.ts`：首页和药物搜索入口。
- `src/pages/drug-pages.ts`：药物库与药物详情。
- `src/pages/import-page.ts`：说明书文本导入和标准 drug.md 导入。
- `src/pages/order-page.ts`：按药物生成候选医嘱。
- `src/api/`：前端 API 调用封装。
- `src/types/`：前端类型定义。
- `src/styles.css`：样式。

## 后端目录

- `server/src/server.ts`：后端 HTTP API 入口。
- `server/src/core/app-context.ts`：组装药物库、导入插件、分类字典和医嘱生成模块。
- `server/src/modules/drug-kb/`：药物 Markdown 解析、生成、校验、索引和查询。
- `server/src/modules/drug-entry-plugin/`：药物导入插件注册与执行。
- `server/src/modules/taxonomy/`：读取分类、剂型、给药途径等下拉菜单。
- `server/src/modules/order-generator/`：根据药物说明书生成候选医嘱模板。
- `server/src/plugins/label-text/`：说明书文本导入插件。
- `server/src/plugins/manual-drug-md/`：手工结构化药物导入插件。
- `server/scripts/`：药物索引构建、校验、快照和冒烟测试脚本。

## 本地药物数据库

- `server/kb/drugs/`：正式药物 Markdown 文件。
- `server/kb/taxonomies/`：下拉菜单字典。
- `server/kb/indexes/drugs.index.json`：药物查询索引，由脚本自动生成。
- `server/kb/imports/`：导入过程文件预留目录。
- `server/kb/backups/`：备份预留目录。

## 已删除能力

精简版已移除疾病库、审核中心、相关性计算、规则中心和独立医嘱模板库。
