# med-order-lite

## 项目定位

本地药物信息管理与候选医嘱生成 Web App。

## 核心功能

- 药物信息管理
- 药物导入插件
- 基于药物说明书生成候选医嘱模板

已删除疾病库、审核中心、疾病-药物相关性、规则中心和独立医嘱模板库。

## 本地运行

```bash
npm install
npm install --prefix server
npm run build:all
npm run dev
```

## 访问地址

前端：http://localhost:5173

后端：http://localhost:8787

健康检查：http://localhost:8787/health

## 主要目录

```txt
src/                         前端源码
server/src/modules/drug-kb/   药物 Markdown 知识库
server/src/plugins/           药物导入插件
server/kb/drugs/              本地药物数据库
server/kb/taxonomies/         分类、剂型、给药途径等下拉菜单
server/kb/indexes/            药物索引
```

## 重要说明

本系统仅生成候选医嘱模板，不能替代医生判断，所有医嘱必须由医生最终确认。
