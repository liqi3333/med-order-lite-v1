# 代码重复审查报告

> 审查日期：2026-05-25  
> 项目：med-order-lite 8

---

## 🔴 高优先级 — 前端函数逐字重复

| 函数 | 重复位置 | 说明 |
|---|---|---|
| `categoriesForSystem` | `drug-pages.ts` + `import-page.ts` | 完全相同的逻辑，仅 `taxonomies()` fallback 差异 |
| `childrenForCategory` | `drug-pages.ts` + `import-page.ts` | 同上 |
| `getParam` | `import-page.ts` + `order-page.ts` | 逐字相同，解析 URL hash 参数 |

**建议：** 抽取到 `src/utils/html.ts`，三处改为 import 调用。

---

## 🟡 中优先级

| 问题 | 位置 | 说明 |
|---|---|---|
| **场景 label 映射重复** | 后端 `order-generator.service.ts:scenarioLabel` + 前端 `order-page.ts:scenarioToLabel` | `outpatient→门诊` 等映射维护了两遍 |
| **API 路由别名 5 组** | `server.ts` | `POST /api/index/rebuild` 和 `/api/indexes/rebuild` 指向同一逻辑，CSV/PDF/OCR 路由重复 |
| **前后端类型各自定义** | `server/.../types.ts` vs `src/types/` | `ReviewStatus`、`DrugIndexItem`、`TaxonomyBundle` 等在两端各写一份 |
| **章节标题映射 3 份** | `drug-md.ts`、`label-text/plugin.ts`、`import-page.ts` | `composition→成分` 等映射在三个文件各自维护 |
| **重建索引按钮逻辑重复** | `drug-pages.ts` + `import-page.ts` | 获取按钮、禁用、调 API、toast、恢复 → 模式一致 |

---

## 🟢 低优先级

| 问题 | 说明 |
|---|---|
| `firstValue` 通用函数 | 仅在 `import-page.ts` 内部使用，可提升到 `html.ts` |
| PDF/OCR 插件输入类型 | `LabelPdfImportInput` 和 `LabelOcrImportInput` 结构几乎一样 |

---

## 总结

```
重复来源: 10 处
  🔴 高: 3 个前端函数
  🟡 中: 5 组逻辑/类型/映射
  🟢 低: 2 个可优化项
```

**最值得立即修复的是** 3 个前端重复函数（`categoriesForSystem`、`childrenForCategory`、`getParam`），改动小而收益大。

---

## 三个重复函数详细分析

### 1. `categoriesForSystem(system)` — 按药物体系筛选一级分类

**功能：** 从系统的全部药物分类中，筛选出属于某个"药物体系"（如 `western_medicine`）下的所有一级分类，返回 `{ value, label }` 的下拉选项列表。

**所在页面：**
- `drug-pages.ts`（药物库查询页）—— 用于"高级筛选"中的一级分类下拉框
- `import-page.ts`（导入维护页）—— 用于导入表单中的药物分类下拉框

**为什么会重复：** 两个页面都需要让用户选择药物分类，因此都要从 `state.taxonomies` 中读取分类字典并过滤。写页面时没有抽取公共函数，各自 copy 了一份。

---

### 2. `childrenForCategory(primary)` — 按一级分类查找二级分类

**功能：** 当用户选定一个"一级分类"（如 `anti_infective`）后，查找该分类下的所有"二级分类"子选项。

**所在页面：**
- `drug-pages.ts` —— 高级筛选的二级分类下拉框
- `import-page.ts` —— 导入表单的二级分类下拉框

**为什么会重复：** 同上，两个页面都有"级联下拉框"的需求，各自实现了一遍。

---

### 3. `getParam(name)` — 读取 URL hash 中的参数

**功能：** 从 `#/orders?drug=xxx` 这样的 hash 路由中，提取 `drug` 参数值。

**所在页面：**
- `import-page.ts` —— 读取 `?edit=xxx` 判断是否处于"编辑已有药物"模式
- `order-page.ts` —— 读取 `?drug=xxx` 获取要生成医嘱的药物 ID

**为什么会重复：** 两个页面都需要从 URL hash 中读取参数，各自写了一个小工具函数。

---

## 根本原因

项目没有建立**页面间共享工具函数**的机制。`src/utils/html.ts` 里有 `escapeHtml`、`qs`、`optionHtml` 等通用函数，但这三个函数被遗漏了，各自留在了页面文件内部。

**修复方式：** 把这三个函数的定义移到 `src/utils/html.ts`，三个页面改为 `import` 引用即可。

---

## 改动小，收益大

| 收益维度 | 修复前 | 修复后 |
|---|---|---|
| **维护成本** | 改一个逻辑要跑两个文件各改一次 | 改一处，全局生效 |
| **一致性风险** | 已有细微差异（`taxonomies()` 的 fallback 逻辑不同），未来可能继续分化 | 统一行为，消除隐式 bug |
| **代码量** | 3 个文件 × 约 10 行 = ~30 行 | 1 个文件 × 3 个函数 = ~10 行，减少 20 行 |
| **新人上手** | 看代码时会疑惑"为什么同样逻辑写了两遍" | 一眼看清：这是共享工具函数 |

### 最典型的潜在 bug 场景

当前 `categoriesForSystem` 在两个文件中已有**细微差异**：

```typescript
// drug-pages.ts
(state.taxonomies?.drugCategories.categories || [])

// import-page.ts
taxonomies().drugCategories.categories   // taxonomies() 自带了 fallback
```

如果哪天修改了其中一个的边界处理（比如增加排序、过滤空值），很容易忘记同步另一个，导致药物库页面和导入页面**显示的分类清单不一致**。抽取成共享函数后，这个问题就不存在了。

---

## 一句话总结

> 3 个函数，5 行改动，消除 2 处未来几乎必然发生的"改一边忘另一边"的 bug。
