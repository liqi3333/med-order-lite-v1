# AI 智能导入 — 实现任务清单

> 创建时间：2026-06-30
> 提醒时间：2026-07-01 12:00

---

## Phase 1: AI 类型定义 + 配置管理
- [ ] `server/src/modules/ai/types.ts` — 类型定义
- [ ] `server/src/modules/ai/config.ts` — 配置管理（.env + 运行时覆盖）

## Phase 2: LLM Provider 抽象层
- [ ] `server/src/modules/ai/llm-provider.ts` — 抽象层 + 工厂函数
- [ ] `server/src/modules/ai/providers/openai.ts` — OpenAI provider
- [ ] `server/src/modules/ai/providers/anthropic.ts` — Anthropic provider
- [ ] `server/src/modules/ai/providers/deepseek.ts` — DeepSeek provider
- [ ] `server/src/modules/ai/providers/google.ts` — Google Gemini provider

## Phase 3: AI 药品说明书解析核心
- [ ] `server/src/modules/ai/label-parser.ts` — Prompt 模板 + 解析逻辑

## Phase 4: AI 增强版插件
- [ ] `server/src/plugins/ai-label-text/plugin.ts` — AI 增强版插件

## Phase 5: 后端路由 + 注册
- [ ] `server/src/core/app-context.ts` — 注册 AI 配置 + 插件
- [ ] `server/src/server.ts` — 新增 `/api/ai/*` 路由

## Phase 6: 前端 UI
- [ ] `src/pages/import-page.ts` — Import 页面新增 "AI 智能导入" tab
- [ ] `src/components/shell.ts` — 导航栏 "模型设置" 按钮
- [ ] 新建模态框组件 — 模型设置 GUI
- [ ] `src/styles.css` — AI 相关样式

## Phase 7: 测试 + 验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run smoke:test`
