# Med Order Lite API

这是 `med-order-lite` 的本地后端 API，负责药物文件读写、药物导入插件、药物索引构建和候选医嘱生成。

## 环境要求

详见项目根目录：

```txt
../REQUIREMENTS.md
```

后端要求：

```txt
Node.js >= 20
npm >= 10
```

## 安装后端依赖

在项目根目录执行：

```bash
npm install --prefix server
```

或在 `server/` 目录内执行：

```bash
npm install
```

## 常用命令

```bash
npm run compile --prefix server
npm run dev --prefix server
npm run start --prefix server
npm run build:indexes --prefix server
npm run validate:drugs --prefix server
npm run smoke:test --prefix server
```

## 后端端口

默认：

```txt
http://localhost:8787
```

健康检查：

```txt
http://localhost:8787/health
```

## 核心目录

```txt
server/src/                 后端源码
server/src/plugins/         导入插件
server/src/modules/drug-kb/ 药物 Markdown 数据库模块
server/kb/drugs/            药物 drug.md 文件
server/kb/taxonomies/       分类、剂型、给药途径、风险标签
server/kb/indexes/          药物索引
```

## 安全边界

本后端只生成候选医嘱模板，不构成医疗建议或自动处方。所有导入药物和生成结果必须由医生或药师确认。
