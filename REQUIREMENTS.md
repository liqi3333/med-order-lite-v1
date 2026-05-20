# Med Order Lite 环境与依赖要求

> 本文件说明运行 `med-order-lite` 所需的本地环境、依赖来源、安装命令和常见问题。  
> 注意：本项目不是 Python 项目，因此不使用 `requirements.txt` 安装依赖；Node.js 项目的依赖由 `package.json` 管理。

---

## 1. 项目类型

`med-order-lite` 是一个本地运行的 Web App：

```txt
前端：TypeScript + HTML + CSS
后端：Node.js + TypeScript
数据库：本地 Markdown / JSON 文件知识库
```

项目不依赖传统数据库：

```txt
不需要 MySQL
不需要 PostgreSQL
不需要 MongoDB
不需要 SQLite
不需要 Docker
```

当前数据库文件位于：

```txt
server/kb/drugs/          药物 drug.md 文件
server/kb/taxonomies/     分类、剂型、给药途径、风险标签字典
server/kb/indexes/        药物索引 drugs.index.json
```

---

## 2. 必需环境

| 项目 | 要求 |
|---|---|
| 操作系统 | macOS / Windows / Linux 均可 |
| Node.js | 建议 `20.x` 或更高版本 |
| npm | 随 Node.js 安装，建议 `10.x` 或更高版本 |
| 浏览器 | Chrome / Edge / Safari / Firefox 的较新版本 |
| 网络 | 首次 `npm install` 需要联网下载依赖；运行 App 时可本地离线使用 |
| 磁盘空间 | 建议至少 500 MB 可用空间，药物库增大后需更多空间 |

检查版本：

```bash
node -v
npm -v
```

建议结果类似：

```txt
node v20.x.x 或更高
npm 10.x.x 或更高
```

---

## 3. 依赖文件在哪里

本项目有两个依赖配置文件。

### 3.1 根目录依赖

```txt
package.json
```

主要用于前端、根命令和统一脚本。

当前主要依赖：

```txt
typescript
```

安装命令：

```bash
npm install
```

---

### 3.2 后端依赖

```txt
server/package.json
```

主要用于后端 API、药物导入插件、索引构建脚本。

当前主要依赖：

```txt
typescript
@types/node
```

安装命令：

```bash
npm install --prefix server
```

---

## 4. 第一次安装步骤

在项目根目录执行：

```bash
npm install
npm install --prefix server
npm run build:all
npm run dev
```

启动后访问：

```txt
前端：http://localhost:5173
后端：http://localhost:8787
健康检查：http://localhost:8787/health
```

---

## 5. 日常启动

如果已经安装过依赖，后续通常只需要：

```bash
npm run dev
```

停止服务：

```txt
Ctrl + C
```

---

## 6. 常用命令

| 命令 | 作用 |
|---|---|
| `npm install` | 安装根目录依赖 |
| `npm install --prefix server` | 安装后端依赖 |
| `npm run compile:all` | 编译前端和后端 TypeScript |
| `npm run build:indexes` | 重建药物索引 |
| `npm run build:public-snapshot` | 生成前端离线快照 |
| `npm run build:all` | 编译 + 重建索引 + 生成快照 |
| `npm run dev` | 同时启动前端和后端 |
| `npm run dev:web` | 只启动前端静态服务 |
| `npm run dev:api` | 只启动后端 API |
| `npm run smoke:test` | 后端基础接口冒烟测试 |
| `npm run validate:drugs` | 校验药物 `drug.md` 文件 |

---

## 7. npm registry 建议

如果 `npm install` 很慢或失败，可以切换 npm 源。

官方源：

```bash
npm config set registry https://registry.npmjs.org/
```

国内网络可选镜像源：

```bash
npm config set registry https://registry.npmmirror.com
```

查看当前源：

```bash
npm config get registry
```

---

## 8. package-lock.json 说明

如果你的环境里曾经出现类似：

```txt
packages.applied-caas-gateway1.internal.api.openai.org
```

说明锁文件里记录了不可访问的内部 npm 源。

处理方式：

```bash
rm -rf node_modules package-lock.json
rm -rf server/node_modules server/package-lock.json
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install
npm install --prefix server
```

本发布包默认不依赖任何私有 npm 源。

---

## 9. PDF / OCR 导入依赖说明

当前版本支持这些导入入口：

```txt
说明书文本导入
Excel / CSV 批量导入
PDF 说明书导入
图片 / 扫描件 OCR 文本导入
标准 drug.md 导入
```

当前实现原则：

```txt
尽量不引入大型外部依赖，优先保证本地容易安装和运行。
```

注意：

```txt
PDF 导入主要适合文字型 PDF。
扫描版 PDF 和图片说明书需要先通过外部 OCR 工具识别文字，再粘贴 OCR 文本导入。
```

如果未来要实现真正高精度本地 OCR，需要额外引入：

```txt
Tesseract.js
PaddleOCR
PDF 页面转图片工具
OCR 中文语言包
```

这些当前不作为默认依赖。

---

## 10. 本地文件数据库要求

药物文件必须位于：

```txt
server/kb/drugs/
```

每个药物一个 `.md` 文件，例如：

```txt
server/kb/drugs/western-medicine/anti-infective/drug-cefazolin-sodium-injection.md
```

药物文件必须使用：

```txt
JSON frontmatter + Markdown 正文
```

不要使用 YAML frontmatter，否则可能报错：

```txt
frontmatter 不是合法 JSON
```

---

## 11. 导入新药后的索引要求

通过 App 导入新药后，系统会自动重建索引。

如果你手动复制 `drug.md` 到：

```txt
server/kb/drugs/
```

则需要点击前端：

```txt
药物库 → 重建索引
```

或执行：

```bash
npm run build:indexes
```

---

## 12. 常见问题

### 12.1 `npm: command not found`

说明没有安装 Node.js，或 Node.js 没加入 PATH。

处理：安装 Node.js 20+ 后重新打开终端。

---

### 12.2 `http://localhost:8787` 打不开

后端根路径可能没有页面，正常测试地址是：

```txt
http://localhost:8787/health
```

网页入口是：

```txt
http://localhost:5173
```

---

### 12.3 `npm run dev` 一直运行不退出

这是正常现象。它是开发服务器，会一直运行直到你按：

```txt
Ctrl + C
```

---

### 12.4 药物库找不到新药

请先重建索引：

```bash
npm run build:indexes
```

或在前端点击：

```txt
药物库 → 重建索引
```

---

## 13. 安全边界

本系统仅用于药物信息结构化管理和候选医嘱模板生成。

```txt
不能替代医生判断
不能直接作为处方依据
不能自动推荐药物
所有候选医嘱必须由医生最终确认
药物说明书内容必须按本地正式说明书复核
```
