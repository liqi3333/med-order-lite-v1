# 药物导入插件说明

精简版只保留药物导入插件。

## 当前插件

- `label-text`：粘贴药品说明书文本，自动抽取适应症、用法用量、禁忌、注意事项等章节。
- `manual-drug-md`：接收完整结构化 JSON，生成标准药物 Markdown。

## 前端入口

`#/import` 页面支持两种导入：

1. 说明书文本导入：填写基础信息并粘贴说明书文本。
2. 标准 `drug.md` 导入：直接粘贴完整 Markdown 文件内容。

## 后端接口

- `GET /api/plugins`
- `POST /api/plugins/label-text/import`
- `POST /api/drugs/import/markdown`

导入保存后会直接写入 `server/kb/drugs/` 并重建药物索引。精简版不再进入审核中心。
