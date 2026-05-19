# Med Order Lite API

精简版后端只保留：

1. 药物 Markdown 知识库
2. 药物导入插件
3. 药物分类字典
4. 药物索引构建
5. 候选医嘱生成

已移除疾病库、审核中心、疾病-药物相关性、规则中心和独立医嘱模板库。

## 运行

```bash
npm install
npm run compile
npm start
```

开发：

```bash
npm run dev
```

## API

- `GET /health`
- `GET /api/taxonomies`
- `GET /api/plugins`
- `GET /api/drugs`
- `GET /api/drugs/:id`
- `GET /api/drugs/:id/raw-md`
- `POST /api/plugins/label-text/import`
- `POST /api/drugs/import/markdown`
- `POST /api/orders/generate`
- `POST /api/index/rebuild`
- `GET /api/index/status`

## 数据目录

- `kb/drugs/`：正式药物 Markdown 文件。
- `kb/taxonomies/`：药物分类、剂型、途径、风险标签。
- `kb/indexes/drugs.index.json`：药物索引。
- `kb/imports/`：导入文件预留目录。
- `kb/backups/`：备份预留目录。

## 导入方式

### 说明书文本导入

```bash
curl -X POST http://localhost:8787/api/plugins/label-text/import \
  -H 'content-type: application/json' \
  --data @examples/import-label-text-request.json
```

### 标准 drug.md 导入

```bash
curl -X POST http://localhost:8787/api/drugs/import/markdown \
  -H 'content-type: application/json' \
  -d '{"markdown":"---\nid: drug-example\n..."}'
```
