# Med Order Lite

`med-order-lite` 是一个本地运行的药物信息管理与候选医嘱生成 Web App。

它面向本地药物知识库维护场景，核心目标是：

```txt
药物说明书 / 药物资料
  ↓
导入插件结构化
  ↓
生成标准 drug.md
  ↓
保存到本地药物库
  ↓
重建药物索引
  ↓
药物查询与候选医嘱生成
```

> 重要提示：本系统只生成候选医嘱模板，不能替代医生判断，不能直接作为处方依据。所有药物信息和医嘱内容必须由医生或药师最终确认。

---

## 1. 当前版本定位

当前版本是精简版药物管理工具，已删除复杂模块，只保留药物相关能力。

保留：

```txt
药物信息库
药物导入插件
候选医嘱生成
药物分类系统
药物索引重建
```

已删除：

```txt
疾病库
疾病-药物相关性
审核中心
规则中心
独立医嘱模板库
疾病驱动推荐逻辑
```

---

## 2. 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | TypeScript + HTML + CSS |
| 后端 | Node.js + TypeScript |
| API | 本地 HTTP API |
| 药物数据库 | Markdown 文件，`drug.md` |
| 结构化字段 | JSON frontmatter |
| 查询索引 | JSON 文件，`drugs.index.json` |
| 分类字典 | JSON 文件 |
| PWA | 基础 manifest 和 service worker |

本项目不使用传统数据库：

```txt
不使用 MySQL
不使用 PostgreSQL
不使用 MongoDB
不使用 SQLite
```

药物原始数据存放在：

```txt
server/kb/drugs/
```

---

## 3. 环境要求

详见：

```txt
REQUIREMENTS.md
```

最低建议：

```txt
Node.js >= 20
npm >= 10
现代浏览器 Chrome / Edge / Safari / Firefox
```

检查版本：

```bash
node -v
npm -v
```

---

## 4. 第一次运行

在项目根目录执行：

```bash
npm install
npm install --prefix server
npm run build:all
npm run dev
```

然后打开：

```txt
前端：http://localhost:5173
后端：http://localhost:8787
健康检查：http://localhost:8787/health
```

说明：

```txt
npm run dev 是开发服务器，会一直运行，不会自动退出。
停止时按 Ctrl + C。
```

---

## 5. 日常启动

依赖安装完成后，后续通常只需要：

```bash
npm run dev
```

如果修改了源码或导入了大量药物，建议执行：

```bash
npm run build:all
npm run dev
```

---

## 6. 常用命令

| 命令 | 说明 |
|---|---|
| `npm install` | 安装根目录依赖 |
| `npm install --prefix server` | 安装后端依赖 |
| `npm run dev` | 同时启动前端和后端 |
| `npm run dev:web` | 只启动前端 |
| `npm run dev:api` | 只启动后端 |
| `npm run compile:all` | 编译前端和后端 |
| `npm run build:indexes` | 重建药物索引 |
| `npm run build:public-snapshot` | 生成前端离线快照 |
| `npm run build:all` | 编译 + 重建索引 + 生成快照 |
| `npm run validate:drugs` | 校验药物 Markdown 文件 |
| `npm run smoke:test` | 后端基础接口测试 |

---

## 7. 项目目录结构

```txt
med-order-lite/
├─ src/                         前端源码
│  ├─ api/                       前端 API 调用封装
│  ├─ components/                前端组件
│  ├─ pages/                     页面：首页、药物库、导入、医嘱生成
│  ├─ types/                     前端类型定义
│  └─ utils/                     前端工具函数
│
├─ server/                       后端项目
│  ├─ src/                       后端源码
│  │  ├─ modules/                后端核心模块
│  │  │  ├─ drug-kb/             药物 Markdown 知识库读写、索引
│  │  │  ├─ drug-entry-plugin/   药物导入插件执行与保存
│  │  │  └─ order-generator/     候选医嘱生成
│  │  ├─ plugins/                药物导入插件
│  │  └─ server.ts               后端 API 入口
│  │
│  ├─ kb/                        本地文件型药物数据库
│  │  ├─ drugs/                  药物 drug.md 文件
│  │  ├─ taxonomies/             分类、剂型、给药途径、风险标签
│  │  ├─ indexes/                药物索引
│  │  ├─ imports/                导入来源、临时数据
│  │  └─ backups/                备份目录
│  │
│  └─ scripts/                   构建索引、校验、快照脚本
│
├─ public/                       PWA 静态资源和离线快照
├─ docs/                         项目文档
├─ dist/                         前端编译产物
├─ index.html                    前端入口
├─ package.json                  根项目依赖和脚本
├─ REQUIREMENTS.md               环境和依赖要求
└─ README.md                     项目说明
```

---

## 8. 核心功能

### 8.1 药物库

功能：

```txt
查看药物列表
搜索药物
按分类、剂型、给药途径筛选
查看药物详情
查看说明书结构化字段
查看药物来源和风险标签
```

药物数据来自：

```txt
server/kb/drugs/**/*.md
```

查询索引来自：

```txt
server/kb/indexes/drugs.index.json
```

---

### 8.2 药物导入

当前支持：

```txt
1. 说明书文本导入
2. Excel / CSV 批量导入
3. PDF 说明书导入
4. 图片 / 扫描件 OCR 文本导入
5. 标准 drug.md 导入
```

统一流程：

```txt
外部资料
  ↓
插件解析
  ↓
生成 DrugDocument
  ↓
生成 drug.md
  ↓
保存到 server/kb/drugs/
  ↓
自动重建药物索引
```

相关文档：

```txt
docs/import-methods-and-plugins.md
docs/import-plugins.md
```

---

### 8.3 候选医嘱生成

功能：

```txt
选择药物
选择场景
填写患者条件
根据说明书字段生成候选医嘱模板
显示禁忌、注意事项、相互作用、特殊人群提示
复制候选医嘱
```

候选医嘱基于：

```txt
用法用量
禁忌
注意事项
不良反应
药物相互作用
特殊人群
风险标签
```

相关文档：

```txt
docs/order-generation.md
```

---

## 9. 药物文件格式

每个药物一个 `drug.md` 文件。

当前要求：

```txt
JSON frontmatter + Markdown 正文
```

示例：

```md
---
{
  "id": "drug-example",
  "type": "drug",
  "status": "active",
  "names": {
    "generic_cn": "示例药物",
    "generic_en": "Example Drug",
    "brand_names": [],
    "aliases": []
  },
  "classification": {
    "system": "western_medicine",
    "primary_category": "anti_infective",
    "secondary_category": "cephalosporins_first_generation",
    "pharmacologic_class": "first_generation_cephalosporin"
  },
  "forms": [
    {
      "dosage_form": "injection",
      "strength": "请按本地说明书补充",
      "route": "iv_drip"
    }
  ],
  "risk_tags": ["allergy_check_required"],
  "sources": [],
  "review": {
    "review_status": "approved",
    "lifecycle": "active",
    "updated_at": "2026-05-20",
    "version": 1
  }
}
---

# 药物说明

## 适应症

## 用法用量

## 禁忌

## 注意事项
```

详细格式见：

```txt
docs/drug-md-format.md
```

---

## 10. 药物分类系统

当前分类系统位于：

```txt
server/kb/taxonomies/drug-categories.json
```

分类设计文档：

```txt
docs/med-order-lite-drug-classification-system.md
```

分类采用：

```txt
药物体系 system
  ↓
一级分类 primary_category
  ↓
二级分类 secondary_category
  ↓
三级药理分类 pharmacologic_class，预留
```

示例：

```json
{
  "system": "western_medicine",
  "primary_category": "anti_infective",
  "secondary_category": "cephalosporins_third_generation",
  "pharmacologic_class": "third_generation_cephalosporin"
}
```

---

## 11. 药物索引

索引文件：

```txt
server/kb/indexes/drugs.index.json
```

通过 App 页面导入药物后，系统会自动重建索引。

如果手动复制 `drug.md` 到药物库目录，请手动重建索引：

```bash
npm run build:indexes
```

或者前端点击：

```txt
药物库 → 重建索引
```

索引接口：

```txt
POST /api/indexes/rebuild
GET  /api/indexes/status
```

相关文档：

```txt
docs/index-rebuild.md
```

---

## 12. 后端 API 概览

常用 API：

```txt
GET  /health

GET  /api/drugs
GET  /api/drugs/:id
GET  /api/drugs/:id/raw-md

GET  /api/taxonomies
GET  /api/plugins

POST /api/drugs/import/label-text
POST /api/drugs/import/csv
POST /api/drugs/import/pdf
POST /api/drugs/import/ocr
POST /api/drugs/import/markdown

POST /api/orders/generate

POST /api/indexes/rebuild
GET  /api/indexes/status
```

---

## 13. PDF / OCR 导入说明

当前 PDF 导入适合：

```txt
文字型 PDF
可复制文字的药品说明书 PDF
```

不适合：

```txt
扫描版 PDF
图片版说明书
复杂中文字体编码 PDF
```

图片 / 扫描件 OCR 当前采用稳妥方式：

```txt
上传图片作为来源记录
粘贴 OCR 后的说明书文本
再由说明书文本解析器生成 drug.md
```

如果要做真正高精度本地 OCR，需要后续引入：

```txt
Tesseract.js 或 PaddleOCR
PDF 转图片能力
中文 OCR 语言包
OCR 结果人工校对界面
```

---

## 14. 常见问题

### 14.1 `frontmatter 不是合法 JSON`

原因：药物文件使用了 YAML frontmatter。

错误：

```md
---
id: drug-example
type: drug
---
```

正确：

```md
---
{
  "id": "drug-example",
  "type": "drug"
}
---
```

---

### 14.2 `Cannot read properties of undefined (reading 'review_status')`

原因：`drug.md` 缺少 `review.review_status`。

至少补充：

```json
"review": {
  "review_status": "approved",
  "lifecycle": "active",
  "updated_at": "2026-05-20",
  "version": 1
}
```

---

### 14.3 药物库查不到新药

处理：

```bash
npm run build:indexes
```

或点击：

```txt
药物库 → 重建索引
```

---

### 14.4 `npm install` 下载失败

切换 npm 源：

```bash
npm config set registry https://registry.npmjs.org/
```

国内网络可用：

```bash
npm config set registry https://registry.npmmirror.com
```

然后重新安装：

```bash
npm install
npm install --prefix server
```

---

## 15. 文档索引

```txt
REQUIREMENTS.md                                      环境与依赖要求
docs/project-structure.md                            项目结构说明
docs/drug-md-format.md                               药物 Markdown 格式说明
docs/import-methods-and-plugins.md                   导入方式和插件说明
docs/import-plugins.md                               导入插件机制说明
docs/index-rebuild.md                                索引重建说明
docs/order-generation.md                             候选医嘱生成说明
docs/med-order-lite-drug-classification-system.md    新版药物分类系统
docs/classification-migration-report.md              分类迁移记录
```

---

## 16. GitHub

```txt
仓库地址：https://github.com/liqi3333/med-order-lite-v1
默认分支：main
```

克隆：

```bash
git clone https://github.com/liqi3333/med-order-lite-v1.git
cd med-order-lite-v1
```

---

## 17. 安全边界

本系统只用于药物信息结构化管理和候选医嘱模板生成。

必须遵守：

```txt
不自动推荐药物
不替代医生判断
不直接作为处方依据
导入药物必须按本地正式说明书复核
候选医嘱必须由医生最终确认
```
