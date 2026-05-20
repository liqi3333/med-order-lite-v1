# 药物分类系统升级记录

本次更新内容：

1. 使用新的药物分类体系替换 `server/kb/taxonomies/drug-categories.json`。
2. 分类字典保持现有 App 兼容格式：`systems + categories + children`。
3. 将新的分类设计文档加入 `docs/med-order-lite-drug-classification-system.md`。
4. 同步迁移现有示例药物分类字段。
5. 重建药物索引和公开快照。

## 示例药物迁移

| 药物 ID | 旧一级分类 | 旧二级分类 | 新一级分类 | 新二级分类 | 新三级/药理分类 |
|---|---|---|---|---|---|
| drug-demo-alpha | anti_infective | antibacterial | anti_infective | other_antibacterials | prototype_antiinfective_demo |
| drug-demo-beta | respiratory_system | antitussive | respiratory | antitussives | prototype_respiratory_symptomatic_demo |
| drug-demo-gamma | nutrition_electrolyte | fluid | nutrition_electrolytes_and_vitamins | crystalloids | prototype_fluid_electrolyte_support_demo |

## 注意

- 本次没有修改前端或后端源码，只更新知识库分类字典、示例药物分类字段、索引和文档。
- 后续新增真实药物时，应优先使用新分类体系中的 `primary_category` 和 `secondary_category`。
- 如果无法准确归类，可临时使用对应系统下的 `other_*` 二级分类，并在药物文件中标记需要人工复核。
