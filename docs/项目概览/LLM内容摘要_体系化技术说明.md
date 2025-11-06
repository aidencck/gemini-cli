# LLM 内容摘要：体系化技术说明

## 文档目标与适用范围
- 系统化、分层次梳理项目当前通过 LLM 完成“内容摘要”的能力与实现路径。
- 面向架构师与工程团队，用于设计决策、工程落地、质量门禁与演进规划。
- 覆盖“会话摘要压缩（Chat Compression）”的现状与“长文档摘要（Long-Doc Summarization）”的推荐方案与对接点。

## 现有实现综述（会话摘要压缩）
- 触发机制
  - 在 `GeminiClient.tryCompressChat(force?: boolean)` 中进行触发判断：
    - 获取整理后的历史：`this.getChat().getHistory(true)`。
    - 使用 `ContentGenerator.countTokens` 统计历史上下文 token 数；非强制时根据模型上下文上限进行压缩判断。
    - 当 `tokenCount >= 0.95 * tokenLimit(model)` 时触发压缩（默认阈值 95%）。
- 摘要请求
  - 发送一条用户消息（`summarizationRequestMessage.text`）到模型：
    - “Summarize our conversation up to this point... This summary will replace the current chat history...”
  - 通过 `GeminiChat.sendMessage({ message })` 获得模型返回文本。
- 历史替换
  - 构造新的历史 `newHistory`：
    - `role: 'user', parts: [summarizationRequestMessage]`
    - `role: 'model', parts: [{ text: response.text }]`
  - 调用 `startChat(newHistory)` 重置会话历史，使摘要替代原上下文以节省成本。
  - 再次计数 `countTokens(newHistory)`，返回 `ChatCompressionInfo { originalTokenCount, newTokenCount }`。
- 主要参与组件与类型
  - `packages/core/src/core/client.ts`：`GeminiClient.tryCompressChat`（触发判定、请求组装、历史替换、指标返回）。
  - `packages/core/src/core/geminiChat.ts`：发送消息、维护历史、输出合并与压缩优化（描述性文档与实现细节）。
  - `packages/core/src/core/turn.ts`：`ChatCompressionInfo`、`ServerGeminiChatCompressedEvent` 等事件类型。
  - `tokenLimits.ts`：模型上下文上限；`models.ts`：默认模型与配置。
  - `ContentGenerator`：`countTokens`、模型调用参数（`GenerateContentConfig: { temperature: 0, topP: 1 }`）。

## 分层架构与项目映射
- 战略层（目标与标准）
  - 能力目标：在不丢失关键信息前提下，降低会话上下文 token 成本，稳定对话连贯性与任务执行连续性。
  - 质量标准：覆盖度（必须保留关键主题与细节）、一致性（与历史事实一致）、可审计（摘要与原始历史的关系可追溯）。
  - 文档映射：`docs/项目概览/00.00_项目架构深度综述.md`（“总结压缩降低上下文成本”）、`docs/model/LLM模型调用文档.md`。
- 战术层（策略与编排）
  - 会话压缩策略：阈值触发 + 单次摘要替换；可扩展为“分阶段压缩 + 多摘要快照”。
  - 长文档摘要策略（建议）：分块（Chunking）→ 分段摘要（Map）→ 汇总（Reduce）→ 迭代细化（Refine），支持层级摘要与主题结构化。
  - 关联工具策略：`ReadManyFilesTool` 读取多文件；后续可扩展“分块器 + 摘要管线”工具。
- 操作层（执行与反馈）
  - 会话摘要执行：按当前实现发送摘要请求、更新历史并返回压缩指标。
  - 文档摘要执行（建议对接点）：根据文件/文本长度进行分块，逐块摘要并保留引用信息，最后汇总生成结构化摘要结果与指标。
  - 输出与反馈：流式解析与合并、错误分类、用户提示与可视化（后续可在 CLI 增加“摘要预览/保存”命令）。
- 支撑层（安全/异常/度量/历史）
  - 安全与合规：摘要中避免包含敏感信息；对外部文档摘要需脱敏与权限控制。
  - 异常与恢复：模型错误/限流/超时重试；回退策略与提示；摘要失败时保留原历史并记录审计事件。
  - 度量与历史：记录压缩前后 token、延迟、摘要大小、覆盖率抽样结果；摘要历史以快照形式保留可追踪性。

## 数据契约与类型（现状与建议）
- 现有会话摘要压缩指标
  - `ChatCompressionInfo`：`{ originalTokenCount: number; newTokenCount: number; }`
  - 事件：`ServerGeminiChatCompressedEvent` → `GeminiEventType.ChatCompressed`。
- 会话摘要消息结构
  - `Content[]` 历史：`{ role: 'user' | 'model'; parts: Part[] }`；摘要替换后以 2 条消息组成新历史。
- 建议新增文档摘要结构（示例 Schema）
  - `DocumentSummarizationResult`：
    - `doc_id: string`（文件或任务标识）
    - `strategy: 'chunk-map-reduce' | 'refine' | 'hybrid'`
    - `overview: string`（全局概览）
    - `key_points: { title: string; detail: string; refs?: string[] }[]`
    - `citations?: { source: string; location?: string; quote?: string }[]`
    - `metrics?: { tokens_in: number; tokens_out: number; latency_ms: number; coverage_ratio?: number; factual_consistency?: number }`
    - `confidence?: number`（0-1）
    - `audit: { created_at: string; model: string; parameters?: Record<string, unknown> }`

## 提示模板与分阶段示例
- 会话摘要模板（当前代码使用）
  - 目标：用一条用户消息请求对话摘要，并以模型回答替换历史上下文。
  - 建议增强：
    - 要求“信息保留清单”（主题、问题、答案、决策点、TODO）与“省略说明”（未纳入细节）。
    - 添加格式契约（JSON/Markdown 标题结构）以便后续可审计与自动评估。
- 文档分块摘要（Map）模板示例
  - 指令要点：
    - 保留标题/小节结构与关键术语；输出 `key_points` 分条列出；包含 `refs` 标注来源文件与行号范围（若可用）。
    - 避免冗余与重复；对不确定内容增加 `confidence` 说明。
- 汇总（Reduce）模板示例
  - 将多个块摘要合并为层级结构：`overview` + `key_points`（分层）+ `citations`；
  - 输出同时计算指标占位：`tokens_out`、`coverage_ratio`（经验估计）。
- 迭代细化（Refine）模板示例
  - 在已有汇总上补充遗漏主题/术语；消除冲突；统一术语与风格；保留审计字段。

## 会话压缩与文档摘要时序（示意）
- 会话压缩（现状）
  1. `GetHistory(curated=true)` → `countTokens(history)` → `tokenLimit(model)`
  2. `threshold check (0.95 * limit)` → `sendMessage(summary_request)`
  3. `response.text` → `newHistory = [user: summary_request, model: summary]`
  4. `startChat(newHistory)` → `countTokens(newHistory)` → 返回 `ChatCompressionInfo`
- 文档摘要（建议）
  1. 分块：根据 token/字符长度 + 重叠；
  2. Map：对每块生成结构化摘要，保留 `refs` 与 `citations`；
  3. Reduce：合并为层级概览与关键点；
  4. Refine：针对覆盖率与一致性进行一次迭代校正；
  5. 输出：`DocumentSummarizationResult` + 指标与审计快照。

## 质量指标与门禁（建议）
- 延迟与成本
  - `latency_ms`：会话压缩 < 2s（TTFB），完整 < 10s；文档摘要视规模分阶段统计。
  - `tokens_in/out` 与 `token_saving_ratio = 1 - newTokenCount/originalTokenCount`。
- 覆盖度与一致性
  - 覆盖率估计：主题/关键点清单与采样核对；
  - 一致性：随机抽样原文比对，测算“事实一致性”评分（人工/半自动）。
- 稳定性与失败率
  - 成功率 > 99%；重试率 < 5%；回退率 < 1%。
- 审计与可追溯
  - 保留摘要快照、模型与参数、引用与来源位置；支持“摘要→原文”逆向访问。

## 配置与参数（现状与建议）
- 现状
  - 阈值：`0.95 * tokenLimit(model)`；强制压缩 `force=true` 可绕过阈值检查（代码支持）。
  - 模型参数：`temperature=0, topP=1`，偏向确定性输出；可根据摘要任务调优（如增加 `topP` 稍微提升覆盖）。
- 建议
  - 可在配置中外置压缩阈值与摘要模板；允许选择“替换历史”或“附加摘要快照”。
  - 引入“摘要格式契约”与校验器；对写入类操作增设确认提示与审批。

## 风险与缓解
- 信息丢失与偏差：引入格式契约与覆盖检查；必要时保留多摘要版本并对比选优。
- 幻觉风险：增加引用与来源标注；对关键事实加上信心值与人工抽检。
- 隐私与合规：敏感数据脱敏；摘要用途与范围受控；审计可追踪。
- 性能与成本：分块阈值与并发控制；避免超长上下文；必要时回退到轻量模型。

## 未来演进与路线图
- 层级摘要与结构化输出：支持章节/主题层级与统一术语；摘要格式与契约化落地。
- RAG 增强：结合检索上下文对摘要进行事实校准；对知识库/代码库支持“主题摘要”。
- 评估体系：建立自动化评估集与指标，支持回归测试与门禁。
- 工具生态：封装“文档摘要管线”工具（分块、Map、Reduce、Refine），与 `ToolRegistry` 对接。
- 可视化与治理：摘要时序图、覆盖热图、审计流水；配置控制台与阈值管理。

## 参考与外部最佳实践
- 长文档摘要的分段与可控细节实践（Map-Reduce/Refine 思路）[0]。
- 多文档/主题摘要与新闻标题生成的提示工程策略与门禁要点[1]。
- LLM 基础与思维链（CoT）用于逐步推理与摘要的背景综述[2]。
- 多文档总结方法（Stuff/Map-Reduce/Refine）工程实践参考[3]。
- PDF 文档切分与分段摘要整合的示例参考[4]。

> 引用说明：上文的序号对应外部参考编号；工程落地需结合本项目的模型与限额策略进行适配与验证。

---

### 附：工程接入建议（简要清单）
- CLI 增加 `summarize` 子命令：输入文件/目录，输出结构化摘要与审计快照。
- 在核心层新增 `DocumentSummarizationPipeline`：
  - `chunk(text|files) → map(prompt) → reduce(prompt) → refine(prompt)`；
  - 与 `ContentGenerator` 协作，支持并发与速率限制；
  - 输出 `DocumentSummarizationResult` 并写入快照。
- 在现有会话压缩上增加“摘要快照”保留与可视化入口，避免信息不可逆丢失。