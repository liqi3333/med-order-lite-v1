# drug.md 药物文件格式

药物数据库采用 `YAML frontmatter + Markdown 正文`。

```md
---
id: drug-example
type: drug
status: active

names:
  generic_cn: 示例药物
  generic_en: Example Drug
  brand_names: []
  aliases: []

classification:
  system: western_medicine
  primary_category: anti_infective
  secondary_category: antibacterial
  pharmacologic_class: 示例分类
  prescription_type: prescription

forms:
  - dosage_form: tablet
    strength: 示例规格
    route: oral

risk_tags:
  - allergy_check_required

sources:
  - source_id: source-drug-example
    source_type: package_insert
    title: 示例药物说明书
    imported_at: "2026-05-19"

review:
  review_status: approved
  lifecycle: active
  updated_at: "2026-05-19"
  version: 1
---

# 药物说明

## 适应症

## 用法用量

## 禁忌

## 注意事项

## 不良反应

## 药物相互作用
```

保存到 `server/kb/drugs/` 后，运行 `npm run build:drug-index` 重建索引。
