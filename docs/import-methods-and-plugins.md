# med-order-lite 药物导入方式与插件说明

本版本支持 4 类主要药物导入方式，并继续保留标准 `drug.md` 导入。

所有导入方式最终都会走同一个数据闭环：

```txt
外部资料
  ↓
导入插件解析
  ↓
DrugDocument
  ↓
标准 drug.md
  ↓
server/kb/drugs/
  ↓
自动重建 server/kb/indexes/drugs.index.json
```

## 1. 说明书文本导入

插件：`label-text`

适用：复制药品说明书正文、网页说明书文本、人工整理文本。

流程：

```txt
粘贴说明书文本
  ↓
识别【适应症】【用法用量】【禁忌】【注意事项】等标题
  ↓
生成 drug.md
  ↓
保存药物库并重建索引
```

## 2. Excel / CSV 批量导入

插件：`excel-csv`

适用：常用药清单、医院药品目录、批量药物基础信息。

支持 CSV 或从 Excel 复制出的表格文本。第一行必须是表头。

推荐列：

```txt
中文通用名,英文名,药物体系,一级分类,二级分类,剂型,规格,给药途径,风险标签,适应症,用法用量,禁忌,注意事项
```

说明：

- 每一行生成一个药物。
- 如果表格中没有完整说明书文本，插件会用“适应症、用法用量、禁忌、注意事项”等列拼成说明书正文。
- 保存后会统一重建一次索引。

## 3. PDF 说明书导入

插件：`label-pdf`

适用：文字型 PDF 说明书。

流程：

```txt
上传 PDF
  ↓
提取 PDF 文本
  ↓
复用 label-text 解析说明书章节
  ↓
生成 drug.md
```

注意：

- 当前第一版支持“文字型 PDF”。
- 如果 PDF 是扫描件，可能提取不到文字，请改用“图片 / 扫描件 OCR 导入”。
- PDF 解析后必须人工核对剂量、频次、规格、禁忌、批准文号。

## 4. 图片 / 扫描件 OCR 导入

插件：`label-ocr`

适用：纸质说明书照片、扫描件。

当前版本不内置 OCR 引擎。推荐流程：

```txt
手机/系统 OCR 识别图片文字
  ↓
复制 OCR 文本
  ↓
上传图片用于来源记录，可选
  ↓
粘贴 OCR 文本
  ↓
生成 drug.md
```

注意：

- OCR 文本必须人工校对。
- 剂量、规格、频次、禁忌、儿童用药等字段尤其需要核对。

## 5. 标准 drug.md 导入

插件/接口：`manual-drug-md` / `/api/drugs/import/markdown`

适用：已经整理好的标准药物 Markdown 文件。

当前 `med-order-lite` 使用 JSON frontmatter，不支持 YAML frontmatter。

## API

```txt
POST /api/plugins/label-text/import
POST /api/drugs/import/csv
POST /api/drugs/import/pdf
POST /api/drugs/import/ocr
POST /api/drugs/import/markdown
POST /api/indexes/rebuild
GET  /api/indexes/status
```

## 安全边界

- 导入结果只是结构化药物资料。
- 生成的医嘱只是候选医嘱模板。
- 所有说明书字段需要人工核对。
- 系统不替代医生判断。
