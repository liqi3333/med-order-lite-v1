# med-order-lite 药物导入插件使用说明书

> 适用项目：`med-order-lite`  
> 适用对象：药物库维护人员、开发人员、临床药师、系统管理员  
> 文档用途：说明如何使用、维护和扩展药物导入插件。  
> 重要提示：本系统仅用于药物信息结构化管理和候选医嘱模板生成，不能替代医生判断，不能直接作为处方依据。

---

## 1. 插件系统是什么

`med-order-lite` 的药物导入插件系统用于把外部药物资料转换成系统可识别的标准药物文件。

核心目标是：

```txt
外部药物资料
  ↓
导入插件解析
  ↓
DrugDocument 结构化对象
  ↓
标准 drug.md 文件
  ↓
保存到本地药物库
  ↓
重建药物索引
  ↓
药物库可查询
  ↓
可用于候选医嘱生成
```

插件不是浏览器插件，也不是 Chrome 扩展，而是 `med-order-lite` 后端中的药物导入模块。

---

## 2. 当前支持的导入插件

### 2.1 `label-text`：说明书文本导入插件

用途：

```txt
粘贴药品说明书文本
  ↓
自动识别说明书章节
  ↓
生成结构化药物信息
  ↓
保存为 drug.md
```

适合导入：

- 药品说明书文本
- 网页复制下来的说明书内容
- OCR 后人工校对过的说明书文本
- 人工整理后的药品说明文字

对应目录：

```txt
server/src/plugins/label-text/
└─ plugin.ts
```

---

### 2.2 `manual-drug-md`：标准 drug.md 导入插件

用途：

```txt
粘贴或上传已经整理好的标准 drug.md
  ↓
系统解析 frontmatter 和正文
  ↓
校验结构
  ↓
保存到药物库
```

适合导入：

- 已经人工整理好的药物 Markdown 文件
- 从其他电脑导出的 drug.md
- 批量整理后的标准药物文件
- 由 AI 或其他工具生成后人工复核过的药物文件

对应目录：

```txt
server/src/plugins/manual-drug-md/
└─ plugin.ts
```

---

## 3. 药物导入的整体流程

简化版 `med-order-lite` 已去掉审核中心，因此导入流程为：

```txt
导入资料
  ↓
插件解析
  ↓
预览结构化结果
  ↓
用户确认保存
  ↓
写入 server/kb/drugs/
  ↓
自动或手动重建 drugs.index.json
  ↓
药物库可查询
```

不再使用旧流程：

```txt
导入
  ↓
待审核
  ↓
审核中心
  ↓
发布
```

---

## 4. 通过前端页面使用插件

### 4.1 打开导入页面

启动项目后，浏览器访问：

```txt
http://localhost:5173
```

进入：

```txt
导入药物
```

页面中应提供至少两种导入方式：

```txt
1. 说明书文本导入
2. 标准 drug.md 导入
```

---

### 4.2 使用说明书文本导入

操作流程：

```txt
1. 进入“导入药物”
2. 选择“说明书文本导入”
3. 填写药物基础信息
4. 选择药物分类、剂型、给药途径
5. 粘贴完整说明书文本
6. 点击“解析 / 预览”
7. 检查解析结果
8. 点击“保存到药物库”
9. 药物进入 server/kb/drugs/
10. 药物库页面可查询该药物
```

建议填写字段：

| 字段 | 是否建议必填 | 说明 |
|---|---:|---|
| 药物通用名 | 是 | 药物主要名称 |
| 英文名 | 否 | 可用于生成 ID 和检索 |
| 商品名 | 否 | 多个商品名可用逗号分隔 |
| 别名 | 否 | 方便搜索 |
| 药物体系 | 是 | 如西药、中成药、生物制品 |
| 一级分类 | 是 | 如抗感染药、心血管系统用药 |
| 二级分类 | 建议 | 如抗菌药、降压药 |
| 剂型 | 是 | 如片剂、胶囊、注射剂 |
| 规格 | 建议 | 按本地说明书填写 |
| 给药途径 | 是 | 如口服、静脉滴注、外用 |
| 生产厂家 | 建议 | 本地说明书或药品目录中补齐 |
| 批准文号 | 建议 | 本地说明书中补齐 |
| 说明书修订日期 | 建议 | 用于版本追踪 |
| 风险标签 | 建议 | 用于医嘱生成时提示风险 |
| 说明书正文 | 是 | 插件解析的主要依据 |

---

### 4.3 使用标准 drug.md 导入

操作流程：

```txt
1. 进入“导入药物”
2. 选择“标准 drug.md 导入”
3. 粘贴完整 drug.md 内容
4. 点击“解析 / 预览”
5. 检查药物 ID、名称、分类、说明书字段
6. 点击“保存到药物库”
7. 系统保存到 server/kb/drugs/
8. 重建索引后可查询
```

标准 `drug.md` 必须包含：

```txt
---
JSON frontmatter
---

# 药物说明

## 成份
## 性状
## 适应症
## 用法用量
## 禁忌
## 注意事项
...
```

注意：当前 `med-order-lite-v1` 的解析器要求 frontmatter 是 **JSON**，不是 YAML。

---

## 5. 当前 drug.md 标准格式

当前兼容版药物文件建议使用 **JSON frontmatter + Markdown 正文**。

示例：

```md
---
{
  "id": "drug-example-tablet",
  "type": "drug",
  "status": "active",
  "names": {
    "generic_cn": "示例药物片",
    "generic_en": "Example Drug Tablets",
    "brand_names": [],
    "aliases": ["示例药物"]
  },
  "classification": {
    "system": "western_medicine",
    "primary_category": "common_high_frequency",
    "secondary_category": "general",
    "pharmacologic_class": "example_class"
  },
  "forms": [
    {
      "dosage_form": "tablet",
      "strength": "请按本地说明书补充",
      "route": "oral"
    }
  ],
  "risk_tags": [
    "allergy_check_required"
  ],
  "sources": [
    {
      "source_id": "drug-example-tablet-source",
      "source_type": "package_insert",
      "title": "示例药物片说明书",
      "url": "",
      "imported_at": "2026-05-19",
      "imported_by": "local_user",
      "revision_date": "请按本地说明书补充"
    }
  ],
  "review": {
    "review_status": "approved",
    "lifecycle": "active",
    "created_by": "local_user",
    "reviewed_by": "local_review_required",
    "reviewed_at": "2026-05-19",
    "updated_at": "2026-05-19",
    "version": 1
  }
}
---

# 药物说明

## 成份

请按本地说明书补充。

## 性状

请按本地说明书补充。

## 适应症

请按本地说明书补充。

## 用法用量

请按本地说明书补充具体剂量、频次、疗程和适用人群。

## 禁忌

请按本地说明书补充。

## 注意事项

请按本地说明书补充。

## 不良反应

请按本地说明书补充。

## 药物相互作用

请按本地说明书补充。

## 特殊人群

### 妊娠

请按本地说明书补充。

### 哺乳

请按本地说明书补充。

### 儿童

请按本地说明书补充。

### 老年

请按本地说明书补充。

### 肾功能不全

请按本地说明书补充。

### 肝功能不全

请按本地说明书补充。

## 贮藏

请按本地说明书补充。

## 包装

请按本地说明书补充。

## 有效期

请按本地说明书补充。

## 执行标准

请按本地说明书补充。

## 批准文号

请按本地说明书补充。
```

---

## 6. 说明书文本推荐格式

为了提高 `label-text` 插件识别准确率，建议说明书文本使用清晰的章节标题。

推荐格式：

```txt
【药品名称】
阿莫西林胶囊

【成份】
本品主要成份为阿莫西林。

【性状】
本品内容物为白色或类白色粉末。

【适应症】
适用于敏感菌所致感染。具体以本地说明书为准。

【用法用量】
请按本地说明书补充具体剂量、频次、疗程和适用人群。

【禁忌】
对本品或相关药物过敏者禁用。具体以本地说明书为准。

【注意事项】
用药前应详细询问过敏史。具体以本地说明书为准。

【不良反应】
可见胃肠道反应、皮疹等。具体以本地说明书为准。

【药物相互作用】
与其他药物合用时需注意相互作用。具体以本地说明书为准。

【孕妇及哺乳期妇女用药】
请按本地说明书补充。

【儿童用药】
请按本地说明书补充。

【老年用药】
请按本地说明书补充。

【贮藏】
请按本地说明书补充。

【批准文号】
请按本地说明书补充。
```

---

## 7. 插件支持识别的标题格式

`label-text` 插件应尽量支持以下标题格式：

```txt
【适应症】内容
【适应症】
适应症：内容
一、适应症
1. 适应症
## 适应症
```

示例：

```txt
【用法用量】
口服。具体剂量请按本地说明书补充。

用法用量：口服。具体剂量请按本地说明书补充。

一、用法用量
口服。具体剂量请按本地说明书补充。

1. 用法用量
口服。具体剂量请按本地说明书补充。
```

---

## 8. 说明书字段映射规则

| 说明书标题 | 系统字段 |
|---|---|
| 药品名称 | names.generic_cn |
| 成份 | ingredients |
| 性状 | description |
| 适应症 | indications |
| 功能主治 | indications |
| 用法用量 | dosage |
| 禁忌 | contraindications |
| 注意事项 | warnings |
| 不良反应 | adverse_reactions |
| 药物相互作用 | interactions |
| 药理毒理 | pharmacology |
| 药代动力学 | pharmacokinetics |
| 孕妇及哺乳期妇女用药 | pregnancy / lactation |
| 儿童用药 | pediatric |
| 老年用药 | geriatric |
| 肾功能不全 | renal_impairment |
| 肝功能不全 | hepatic_impairment |
| 贮藏 | storage |
| 包装 | packaging |
| 有效期 | validity |
| 执行标准 | standard |
| 批准文号 | approval_number |
| 生产企业 | manufacturer |
| 说明书修订日期 | revision_date |

---

## 9. 必填和建议字段规则

### 9.1 最低必填字段

导入药物时，至少需要：

```txt
药物通用名
药物 ID
药物体系
一级分类
剂型
给药途径
说明书正文或 drug.md 正文
review.review_status
review.lifecycle
```

### 9.2 医嘱生成建议必填字段

如果该药物要用于候选医嘱生成，强烈建议补齐：

```txt
用法用量
禁忌
注意事项
药物相互作用
特殊人群
规格
给药途径
风险标签
来源信息
```

其中最关键的是：

```txt
用法用量
禁忌
注意事项
```

如果缺少用法用量，候选医嘱生成应提示：

```txt
说明书缺少“用法用量”字段，无法生成完整候选医嘱，请人工补充。
```

---

## 10. 分类、剂型和给药途径规则

药物分类、剂型、给药途径不建议随意手写，应从系统字典中选择。

字典目录：

```txt
server/kb/taxonomies/
```

常见文件：

```txt
drug-categories.json
dosage-forms.json
routes.json
risk-tags.json
prescription-types.json
frequencies.json
```

如果导入时报错：

```txt
分类不存在
剂型不存在
给药途径不存在
risk tag 不存在
```

应先更新对应 taxonomy 文件，再重新导入。

---

## 11. 风险标签规则

风险标签用于候选医嘱生成时提示医生注意风险。

常见风险标签：

```txt
allergy_check_required        需要过敏史校验
renal_adjustment_required     需要肾功能校验
hepatic_adjustment_required   需要肝功能校验
pregnancy_check_required      需要妊娠校验
lactation_check_required      需要哺乳校验
interaction_check_required    需要相互作用校验
high_alert_drug               高警示药品
antimicrobial                 抗菌药物
cold_chain_required           需冷链
light_protection_required     需避光
```

风险标签不会自动构成禁忌结论，只用于提醒。

---

## 12. 导入后的保存位置

导入成功后，药物文件保存到：

```txt
server/kb/drugs/
```

推荐按分类放置：

```txt
server/kb/drugs/western-medicine/anti-infective/drug-amoxicillin-capsule.md
server/kb/drugs/western-medicine/cardiovascular/drug-amlodipine-tablet.md
server/kb/drugs/western-medicine/digestive-system/drug-omeprazole-capsule.md
```

索引文件：

```txt
server/kb/indexes/drugs.index.json
```

索引文件不要手工编辑，应由系统重建。

---

## 13. 重建索引

导入药物后需要重建索引。

命令方式：

```bash
npm run build:indexes
```

如果是一键版，建议在 App 中提供按钮：

```txt
系统设置 → 重建药物索引
```

索引重建完成后，药物库页面才能查询到新导入药物。

---

## 14. API 使用方式

前端通常会调用后端 API，不需要用户手工调用。

常用 API：

```txt
GET  /api/plugins
GET  /api/taxonomies

GET  /api/drugs
GET  /api/drugs/:id
GET  /api/drugs/:id/raw-md

POST /api/drugs/import/label-text
POST /api/drugs/import/markdown
POST /api/orders/generate
POST /api/indexes/rebuild
```

如需手工测试说明书文本导入，可用 curl：

```bash
curl -X POST http://localhost:8787/api/drugs/import/label-text \
  -H "content-type: application/json" \
  --data @example-label-text-import.json
```

---

## 15. 常见错误与处理

### 15.1 frontmatter 不是合法 JSON

原因：

```txt
当前解析器要求 JSON frontmatter，但文件使用了 YAML frontmatter。
```

错误格式：

```yaml
---
id: drug-example
type: drug
---
```

正确格式：

```json
---
{
  "id": "drug-example",
  "type": "drug"
}
---
```

---

### 15.2 Cannot read properties of undefined: review_status

原因：

```txt
frontmatter 缺少 review 字段。
```

需要补充：

```json
"review": {
  "review_status": "approved",
  "lifecycle": "active",
  "created_by": "local_user",
  "reviewed_by": "local_review_required",
  "reviewed_at": "2026-05-19",
  "updated_at": "2026-05-19",
  "version": 1
}
```

---

### 15.3 分类不存在

原因：

```txt
drug.md 中的 primary_category 或 secondary_category 不在 taxonomies 中。
```

处理：

```txt
1. 修改 drug.md，把分类改成已有合法值
2. 或更新 server/kb/taxonomies/drug-categories.json
```

---

### 15.4 药物库查不到新导入药物

可能原因：

```txt
1. drug.md 没有保存到 server/kb/drugs/
2. 没有重建索引
3. frontmatter 校验失败
4. 文件扩展名不是 .md
```

处理：

```bash
npm run build:indexes
```

然后刷新前端药物库页面。

---

### 15.5 医嘱生成结果为空

可能原因：

```txt
1. 用法用量字段为空
2. 药物详情没有解析到说明书章节
3. 药物 ID 选择错误
4. drug.md 正文标题不规范
```

建议检查这些章节是否存在且有内容：

```txt
## 用法用量
## 禁忌
## 注意事项
```

---

## 16. 插件扩展方式

未来可以新增插件，例如：

```txt
label-pdf
label-ocr
excel-drugs
website-html
dxy-text
```

新增插件目录：

```txt
server/src/plugins/new-plugin-name/
└─ plugin.ts
```

插件必须做到：

```txt
输入外部资料
  ↓
解析为 DrugDocument
  ↓
交给 drug-md 模块生成 drug.md
```

新增插件后，需要在后端上下文中注册，通常对应：

```txt
server/src/core/app-context.ts
```

---

## 17. 药物导入质量等级建议

建议为每个药物设置质量等级：

| 等级 | 含义 |
|---|---|
| A | 已按本地正式说明书完整复核，可用于候选医嘱生成 |
| B | 来源可信，但部分字段仍需补充 |
| C | 结构化初稿，仅用于测试或继续补录 |
| D | 不建议用于医嘱生成 |

建议在 frontmatter 中加入：

```json
"quality": {
  "level": "C",
  "status": "needs_local_package_insert_review",
  "checked_by": "",
  "checked_at": "",
  "notes": "请按本地说明书复核后再用于候选医嘱生成"
}
```

---

## 18. 安全边界

药物导入插件只负责结构化药物资料，不负责判断临床适用性。

必须遵守：

```txt
导入的药物说明书需要人工核对
生成的 drug.md 需要人工确认
候选医嘱需要医生最终确认
系统不自动推荐药物
系统不替代医生判断
系统不保证外部来源文本完全正确
```

候选医嘱生成结果必须显示：

```txt
仅为候选医嘱模板，请结合患者情况并由医生最终确认后使用。
```

---

## 19. 推荐日常使用流程

```txt
1. 获取本地正式药品说明书
2. 复制完整说明书文本
3. 打开“导入药物”
4. 选择“说明书文本导入”
5. 填写药物基础信息
6. 选择分类、剂型、给药途径和风险标签
7. 粘贴说明书文本
8. 点击解析 / 预览
9. 检查适应症、用法用量、禁忌、注意事项
10. 确认保存到药物库
11. 重建索引
12. 在药物库查询验证
13. 进入“生成医嘱”抽样测试
```

---

## 20. 一句话总结

`med-order-lite` 的药物插件规则是：

> 所有外部药物资料都必须通过导入插件转换成统一的 `drug.md` 文件，保存到 `server/kb/drugs/`，再通过索引用于药物查询和候选医嘱生成。
