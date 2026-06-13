# AGENTS.md

## 项目概述

原生 TypeScript monorepo（无框架）。前端是纯 TS + HTML，由自定义静态服务器提供服务；后端是纯 Node.js HTTP 服务器。不使用数据库——药物数据以 **JSON frontmatter** 的 Markdown 文件形式存储在 `server/kb/drugs/`。

## 双包结构

| 包 | 路径 | 入口 | 编译输出 |
|---|---|---|---|
| 前端 | `./` | `src/main.ts` | `dist/`（通过 `tsconfig.web.json`） |
| 后端 | `server/` | `server/src/server.ts` | `server/dist/`（通过 `server/tsconfig.json`） |

根目录的 `tsconfig.json` 设置为 `noEmit: true`——仅用于 `npm run typecheck`。

## 安装与命令

```bash
# 首次安装（两个包有独立的 node_modules）
npm install
npm install --prefix server

# 开发服务器（同时启动前后端；Ctrl+C 停止）
npm run dev            # 前端 :5173（src/ 变化时自动编译），后端 :8787

# 构建 / 验证
npm run build:all      # compile:all + build:indexes + build:public-snapshot
npm run compile:all    # 编译前端 + 后端
npm run typecheck      # 类型检查前端和后端
npm run test           # 单元测试（node:test + tsx，81 个测试）
npm run validate:drugs # 校验 drug.md 文件
npm run smoke:test     # 后端集成冒烟测试
npm run build:indexes  # 手动修改药物文件后重建索引
```

## 容易踩坑的地方

- **后端 `dev` 脚本每次启动都会重新编译**（`tsc && node dist/...`）。没有 watch 模式。
- **药物文件使用 JSON frontmatter，不是 YAML。** YAML 格式的 frontmatter 会导致解析崩溃。
- **手动添加/编辑 `server/kb/drugs/*.md` 后**，必须运行 `npm run build:indexes`，否则药物不会出现在搜索中。
- **两个独立的 `node_modules`**：根目录和 `server/`。后端代码使用的依赖必须写在 `server/package.json` 中。
- **全程 ESM**——两个包都设置了 `"type": "module"`。相对导入必须使用 `.js` 扩展名（TypeScript NodeNext 解析）。
- **测试文件**（`*.test.ts`）放在 `server/src/` 中，与源码同级。通过 `server/tsconfig.json` 的 `exclude` 排除编译。使用 `node --import tsx --test` 运行。

## 架构说明

- **后端路由**：基于表的路由定义在 `server/src/server.ts`，由 `server/src/core/router.ts` 匹配（支持 `:param` 模式）。中间件链（CORS、日志、错误处理）在 `server/src/core/middleware.ts`。
- **药物索引**：`readById` 先查询 `drugs.index.json` 中的文件路径，如果索引不存在则回退到目录扫描。

## 关键目录

```
server/kb/drugs/        # drug.md 源文件（数据存储）
server/kb/indexes/      # drugs.index.json（生成）
server/kb/taxonomies/   # 分类/剂型/给药途径/风险标签字典（JSON）
server/src/core/        # 路由、中间件、应用上下文、配置
server/src/modules/     # 药物知识库、药物导入插件、医嘱生成、分类
scripts/dev-all.mjs     # 启动静态 Web 服务器（带自动编译）+ 后端 API
```
