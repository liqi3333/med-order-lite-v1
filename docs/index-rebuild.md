# 药物索引重建说明

`med-order-lite` 的药物查询依赖药物索引文件：

```txt
server/kb/indexes/drugs.index.json
```

药物原始数据保存在：

```txt
server/kb/drugs/
```

前端药物库页面不会每次直接扫描所有 `drug.md`，而是读取后端根据 `drug.md` 构建出的索引。

---

## 1. 导入后自动重建索引

通过 App 导入药物时，后端会自动重建索引。

覆盖场景：

```txt
说明书文本导入
标准 drug.md 导入
未来 PDF/OCR/Excel 插件导入
```

流程：

```txt
导入药物
  ↓
保存 drug.md 到 server/kb/drugs/
  ↓
自动调用 drugRepository.buildIndex()
  ↓
更新 server/kb/indexes/drugs.index.json
  ↓
药物库可立即查询
```

导入结果里会显示：

```txt
索引已自动重建，当前索引药物数：N
```

如果药物保存成功但索引重建失败，页面会提示：

```txt
药物已保存，但索引自动重建失败，请在药物库页面点击“重建索引”。
```

---

## 2. 手动复制 drug.md 后需要点击“重建索引”

如果你不是通过 App 导入，而是直接把文件复制到：

```txt
server/kb/drugs/western-medicine/...
```

后端默认无法知道你刚刚复制了新文件，因此不会自动索引。

此时需要进入：

```txt
药物库 → 重建索引
```

点击后，后端会扫描 `server/kb/drugs/` 中所有 `.md` 文件，并重新生成：

```txt
server/kb/indexes/drugs.index.json
```

---

## 3. 后端 API

### 重建索引

```txt
POST /api/indexes/rebuild
```

兼容旧接口：

```txt
POST /api/index/rebuild
```

返回示例：

```json
{
  "ok": true,
  "drugs": 51,
  "indexPath": "/path/to/server/kb/indexes/drugs.index.json",
  "rebuiltAt": "2026-05-20T10:30:00.000Z"
}
```

### 查看索引状态

```txt
GET /api/indexes/status
```

兼容旧接口：

```txt
GET /api/index/status
```

返回示例：

```json
{
  "ok": true,
  "drugs": {
    "exists": true,
    "count": 51,
    "indexPath": "/path/to/server/kb/indexes/drugs.index.json",
    "updatedAt": "2026-05-20T10:30:00.000Z"
  }
}
```

---

## 4. 命令行重建索引

仍然可以用命令行重建：

```bash
npm run build:indexes
```

但日常使用推荐直接在前端点击：

```txt
药物库 → 重建索引
```

---

## 5. 常见问题

### 药物文件已经复制进去，但药物库里查不到

处理：

```txt
药物库 → 点击“重建索引” → 刷新查询
```

### 点击重建索引失败

常见原因：

```txt
1. 某个 drug.md 的 frontmatter 不是合法 JSON
2. 缺少 review.review_status
3. 分类、剂型或给药途径格式异常
4. 文件扩展名不是 .md
```

先修复对应 `drug.md`，再重新点击“重建索引”。

---

## 6. 推荐使用习惯

通过 App 导入：

```txt
导入药物 → 保存到药物库 → 自动重建索引 → 药物库查询
```

手动复制文件：

```txt
复制 drug.md 到 server/kb/drugs/ → 药物库点击“重建索引” → 查询验证
```
