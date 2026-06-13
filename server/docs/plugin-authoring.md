# 药物导入插件开发说明

精简版只支持药物导入插件。插件的目标是把外部输入转换成标准 `DrugDocument`，再由系统生成并保存 `drug.md`。

## 插件位置

```txt
server/src/plugins/<plugin-id>/plugin.ts
```

## 插件接口

插件需要实现 `DrugImportPlugin`：

```ts
export interface DrugImportPlugin<I = unknown> {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  import(input: I, context: DrugImportContext): Promise<{
    frontmatter: DrugFrontmatter;
    label: DrugLabelSections;
    notes: string[];
  }>;
}
```

## 当前插件

- `label-text`：说明书文本导入。
- `manual-drug-md`：手工结构化药物导入。

## 保存模式

- `preview`：只预览，不写入文件。
- `publish`：校验通过后直接保存到 `server/kb/drugs/` 并重建索引。

精简版没有审核中心，也没有待审核队列。
