# Prompt 构建逻辑与时序图（Gemini CLI）

本文系统整理 Gemini CLI 项目中 Prompt 是如何被构建、注入并随会话演进，并给出关键代码位置与扩展入口，便于二次开发与审计。

## 一、架构总览与关键组件

- `packages/cli`：终端 UI（Ink/React），采集用户输入、快捷指令与 `@path` 文件注入。
- `packages/core`：业务核心，负责 Prompt 组装、工具声明、历史管理、API 交互与工具调度。
  - `GeminiClient`（`core/client.ts`）：协调模型调用、会话初始化、参数构建。
  - `GeminiChat`（`core/geminiChat.ts`）：管理对话历史、流式响应、令牌窗口与错误处理。
  - `ContentGenerator`（`core/contentGenerator.ts`）：统一不同鉴权/后端的请求生成与发送。
  - `ToolRegistry`（`tools/tool-registry.ts`）：注册/发现工具，并以 `FunctionDeclaration` 形式暴露给 LLM。
  - `CoreToolScheduler`（`core/coreToolScheduler.ts`）：解析与执行工具调用，含确认、并发、状态机。
  - `converter.ts`（`code_assist/converter.ts`）：结构化数据到 Vertex/Gemini 请求 JSON 的转换器。
  - `prompts.ts`（`core/prompts.ts`）：系统 Prompt 文本生成，支持环境变量覆盖与用户记忆拼接。

## 二、Prompt 组装流程（逻辑串）

1. 用户输入采集（CLI）
   - `InputPrompt.tsx` 负责文本与 `@path/to/file` 文件内容注入，形成结构化 `parts`。
2. 历史消息拼接（Core）
   - `GeminiChat` 维护完整会话历史（`role=user|model`，`parts=[text|tool|thought]`），必要时进行压缩/裁剪。
3. 系统 Prompt 注入（System Instruction）
   - `getCoreSystemPrompt(userMemory?)` 生成长文本系统指令。
   - 支持通过 `GEMINI_SYSTEM_MD` 指定外部文件覆盖，或 `GEMINI_WRITE_SYSTEM_MD=true` 将默认系统指令写盘。
4. 工具声明注入（Function Declarations）
   - `ToolRegistry` 收集所有已注册/发现工具，生成 `tools: FunctionDeclaration[]` 注入到请求 `config.tools`。
5. 采样/安全/流控参数填充（GenerationConfig）
   - 温度、`topK`、`maxOutputTokens`、`stopSequences` 等均在 `config.generationConfig`。
6. 构造 LLM 请求 JSON 并发送
   - `converter.toVertexGenerateContentRequest` 将 `contents`（历史+本轮输入）、`systemInstruction`、`tools`、`generationConfig` 转为标准请求 JSON，交由 `ContentGenerator` 调用 Gemini/Vertex。
7. 流式响应与工具调用处理
   - 若响应包含函数调用，`CoreToolScheduler` 进行确认（如文件写/命令执行），执行工具并把结果合并回历史。

## 三、核心数据结构（请求 JSON）

- 顶层：
  - `contents: Content[]`：多轮历史 + 本轮输入，每项 `role=user|model`，`parts=[{text:...}, ...]`。
  - `config.systemInstruction: Content | string`：系统 Prompt 长文本。
  - `config.tools: ToolListUnion`：工具声明，LLM 可主动 function call。
  - `config.generationConfig: {...}`：采样、安全、流控等参数集合。
- 关键转换：
  - `toVertexGenerateContentRequest(req)` 负责把内部结构转为 API 所需 JSON，处理 `systemInstruction`、`tools`、`generationConfig` 等。

参考示例与说明详见：`/prompt_llm_json_struct.md`

## 四、时序图（从输入到响应）

ASCII 时序示意（简化）：

```
User        CLI(InputPrompt)   Core(GeminiClient/Chat)   ToolRegistry   GeminiAPI
 │  输入         │                        │                    │             │
 │──────────────▶│  组装parts             │                    │             │
 │               │───────────────请求参数─▶│                    │             │
 │               │                        │ 注入system/tools   │             │
 │               │                        │───────────────调用─▶             │
 │               │                        │◀───────流式响应────│             │
 │               │                        │  检测函数调用      │             │
 │               │                        │────调度/执行/确认─▶│             │
 │               │                        │◀────────工具结果───│             │
 │◀──最终输出────│◀────────历史合并/文本───│                    │             │
```

## 十一、完整时序调用图（详版）

```
User                CLI(InputPrompt)        CLI(App)            Core(GeminiClient)         Core(GeminiChat)         ToolRegistry          ContentGenerator        Converter             GeminiAPI             CoreToolScheduler         Tools                 Turn Manager          Telemetry/Error
 │                         │                    │                         │                          │                         │                         │                      │                      │                         │                     │                     │
 │ 输入/快捷指令/@文件     │                    │                         │                          │                         │                         │                      │                      │                         │                     │                     │
 │───────────────────────▶│ assemble parts     │ onSubmit(params)        │                         │                          │                         │                      │                      │                         │                     │                     │
 │                         │──────────────────▶│────────────────────────▶│ build request            │                          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │ - getCoreSystemPrompt    │                          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │ - collect tools          │                          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │ - generationConfig       │                          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ prepare history          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ (curate/compress)        │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │────────────────────────▶│ discover/registry       │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ tools declarations       │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │                          │                         │ create content gen    │ toVertexRequest      │                      │                         │                     │                     │
 │                         │                    │                         │────────────────────────▶│────────────────────────▶│────────────────────────▶│─────────────────────▶│─────────────────────▶│ send stream           │                         │                     │                     │
 │                         │                    │                         │                         │                          │                         │                      │                      │◀──────────────────────│                     │                     │
 │                         │                    │                         │                         │◀──────── stream events ─│                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ update history/state     │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ detect function calls    │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │────────────────────────▶│                         │                      │                      │                         │ schedule/confirm     │                     │                     │
 │                         │                    │                         │                         │                          │                         │                      │                      │                         │────────────────────▶│ execute              │                     │                     │
 │                         │                    │                         │                         │                          │                         │                      │                      │                         │◀─────────────────────│ result               │                     │                     │
 │                         │                    │                         │                         │ merge tool result        │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ send tool result to API  │                         │                      │                      │──────────────────────▶│                     │                     │                     │
 │                         │                    │                         │                         │◀────────── continued stream/response ───────────────│                      │                      │                         │                     │                     │
 │                         │                    │                         │                         │ finalize text/structured │                         │                      │                      │                         │                     │                     │
 │◀───── final output ─────│◀───────────────────│◀────────────────────────│                         │                          │                         │                      │                      │                         │                     │                     │
 │                         │                    │                         │ usage/metadata           │                          │                         │                      │                      │                         │                     │ log prompt/tool      │
 │                         │                    │                         │ error handling           │                          │                         │                      │                      │                         │                     │ reportError          │
```

- 说明
  - 输入与组装：`InputPrompt.tsx` 负责将文本与 `@path` 文件内容结构化为 `parts`，`onSubmit` 将 `SendMessageParameters` 传递给 `GeminiClient`。
  - 请求构建：`GeminiClient` 汇总 `systemInstruction`（`getCoreSystemPrompt`）、`tools`（`ToolRegistry`）、`generationConfig` 并准备 `contents`（历史+本轮输入）。
  - 历史管理：`GeminiChat` 进行上下文维护、裁剪与压缩（`tokenLimits.ts`），并在流式过程中追加历史与状态。
  - 工具声明：`ToolRegistry` 输出 `FunctionDeclaration` 列表注入到 `config.tools`。
  - 转换与发送：`ContentGenerator` 使用 `converter.toVertexGenerateContentRequest` 将内部结构转换为 Vertex/Gemini 标准请求 JSON，携带 `systemInstruction/tools/generationConfig`，并发起流式调用。
  - 工具调度：当响应包含函数调用，`GeminiChat` 触发 `CoreToolScheduler` 的 `schedule`；如需要确认，走 `handleConfirmationResponse` 后执行对应工具 `execute`，结果合并并回传至模型继续生成。
  - 收尾与输出：`GeminiChat` 汇总文本与结构化函数调用（`getStructuredResponse`），返回终端 UI 展示；同时记录 `usageMetadata`、遥测事件与错误日志。

- 关键函数与文件映射
  - 输入 UI：`packages/cli/src/ui/components/InputPrompt.tsx`
  - 客户端与会话：`packages/core/src/core/client.ts`、`packages/core/src/core/geminiChat.ts`
  - 系统 Prompt：`packages/core/src/core/prompts.ts`（`getCoreSystemPrompt`）
  - 工具注册/声明：`packages/core/src/tools/tool-registry.ts`
  - 调度与确认：`packages/core/src/core/coreToolScheduler.ts`
  - 回合与事件：`packages/core/src/core/turn.ts`
  - 转换器：`packages/core/src/code_assist/converter.ts`（`toVertexGenerateContentRequest`、`toContents`、`toPart`、`toVertexGenerationConfig`）
  - 响应整合：`packages/core/src/utils/generateContentResponseUtilities.ts`（`getStructuredResponse`）
  - 错误与遥测：`packages/core/src/utils/errorReporting.ts`、`packages/core/src/utils/errors.ts`、`packages/core/src/telemetry/clearcut-logger/event-metadata-key.ts`

- 请求与响应的衔接
  - 请求端仅包含 `contents/config`；响应端可能携带 `automaticFunctionCallingHistory`、`usageMetadata` 等（见 `GenerateContentResponse`）。
  - 响应文本与函数调用提取：`getStructuredResponse` 将文本与函数调用 JSON 合并为结构化字符串，便于 UI 展示与后处理。

- 代码入口与转换路径
  - 组装：`core/client.ts`（顶层参数构建）、`core/geminiChat.ts`（历史管理与消息发送）。
  - 系统 Prompt：`core/prompts.ts`（`getCoreSystemPrompt`）。
  - 工具声明：`tools/tool-registry.ts`（注册/发现、声明生成）。
  - 转换：`code_assist/converter.ts`（`toVertexGenerateContentRequest`、`toContents`、`toPart`、`toVertexGenerationConfig`）。

详见：`/prompt_llm_json_struct.md`。

## 八、审计与遥测

- 遥测键值：`packages/core/src/telemetry/clearcut-logger/event-metadata-key.ts`
  - 如 `GEMINI_CLI_USER_PROMPT_LENGTH`、`GEMINI_CLI_TOOL_CALL_NAME` 等，便于统计输入规模与工具使用情况。

## 九、常见问题与边界

- 系统 Prompt 过长
  - 建议在系统指令中保持高层规则与关键流程，示例适度；长文本可按需外部化并版本管理。
- 历史窗口与令牌限制
  - 在 `GeminiChat` 中做好裁剪/压缩策略，避免超限导致报错或上下文丢失。
- 工具声明的一致性
  - 更新/新增工具时，确保 `FunctionDeclaration` 与实际执行参数严格一致，避免 LLM 调用失败。
- 安全与确认
  - 修改文件/执行命令类工具必须走确认流程；记录审计日志并合理降级处理异常。