# 意图识别与思维链（COT）处理体系

本文系统化、结构化、分层次整理项目中“意图识别（Intent Recognition）”与“思维链（Chain-of-Thought, COT）”的处理逻辑，重点阐述输入与输出的关键路径、判定节点与协同机制，并给出二次开发的接口与扩展方向。

## 核心总结
- 双轨输入与输出管理：同时维护“完整历史（Comprehensive）”与“精选历史（Curated）”，以保证判定与续写的稳定性与合规性。
- 意图识别总控：通过“下一说话人判定”与“工具调用判定”双门控，判断是继续由模型输出、触发工具、还是等待用户；函数响应与空模型消息特殊兜底。
- COT识别与隔离：通过 `isThoughtContent` 对首段标记为 `thought: true` 的模型输出进行识别，确保思维链与可展示内容分离；在输出装配时进行过滤/合并。
- 输入关键处理：基于精选历史构造判定上下文；同时对函数响应、工具结果、空消息进行兼容性修复，避免非法结构被回传至服务端。
- 输出关键处理：统一的“结构化输出装配”策略将文本与函数调用合并为可消费的串/JSON；工具调度将模型返回转译为 `functionResponse` 以进入历史与后续推理。
- 流式与非流式一致性：在非流式结束后或流式最后片段处统一触发历史记录与判定，保证时序一致与可重入性。
- 与工具调度协同：工具调用的函数化转译与回写（`convertToFunctionResponse`）与“下一说话人判定”协作，避免早停或重复询问。

---

## 一、分层架构
- 接口层（Interface / Prompt Layer）
  - 系统提示词模板与工作流提示：`core/prompts.ts`
  - 思维链支持判定：`client.ts:isThinkingSupported(model)`
- 意图门控层（Intent Gate Layer）
  - 下一说话人判定：`utils/nextSpeakerChecker.ts:checkNextSpeaker`
  - 函数响应检测：`utils/messageInspectors.ts:isFunctionResponse`
- COT识别层（COT Layer）
  - 思维链内容识别：`core/geminiChat.ts:isThoughtContent`
  - 流/非流响应解析与过滤：`utils/generateContentResponseUtilities.*`
- 输出装配层（Output Assembly Layer）
  - 文本与工具调用结构化聚合：`utils/generateContentResponseUtilities.getStructuredResponse*`
  - 工具调用响应转译：`core/coreToolScheduler.convertToFunctionResponse`
  - MCP工具响应内容处理：`tools/mcp-tool.ts:processFunctionResponse`
- 调度与历史层（Scheduler & History Layer）
  - 历史维护接口：`core/geminiChat.ts:getHistory/recordHistory/...`
  - 历史压缩与总结：`core/client.ts:tryCompressChat`（见历史维护文档）

## 二、输入关键处理（Input Handling）
- 精选历史（Curated History）作为判定上下文
  - 在“下一说话人判定”中使用 `chat.getHistory(true)` 获取精选历史，避免不合法或空内容（例如模型返回空 parts）破坏后续调用。
- 综合历史（Comprehensive History）用于最后一条消息的结构检查
  - 若最后一条是用户的纯 `functionResponse`，表示工具结果已返回，应由模型继续说话（触发续写/总结/结果解释）。
- 空模型消息兜底
  - 当最后消息为模型但 `parts.length === 0`，强制插入空文本 `''` 以形成合法消息结构，避免服务端拒绝。
- 判定输入构造
  - 精选历史末尾追加判定提示（`CHECK_PROMPT`）作为用户内容，让模型返回 JSON 结构（schema 校验）决定下一说话人。

## 三、意图识别（Intent Recognition）
- 下一说话人判定（Next Speaker Gate）
  - 规则顺序：模型意图继续（未完成或声明下一步）→ 明确向用户提问 → 默认等待用户。
  - 输入：精选历史 + 判定提示；输出：`{ next_speaker: 'user' | 'model', reasoning }`。
  - 兼容：函数响应与空模型消息的快捷判定与兜底路径。
- 工具调用判定
  - 从响应 parts 中抽取 `functionCall`（`getFunctionCalls*`）；若存在合法调用，由调度器接管，生成 `functionResponse` 并写回历史。

## 四、COT处理（Chain-of-Thought Handling）
- COT识别
  - `isThoughtContent(content)` 检测模型首段是否标记 `thought: true`，用于识别不可展示的思维链内容。
- COT隔离与过滤
  - 在输出合并时优先剔除 COT 段或将其与可展示文本分离，保证对用户显示与对工具调用的输入不污染。
- 思维链与工具的协同
  - 当模型启用“思维链支持”（`isThinkingSupported`）时，内部推理可更丰富，但外部展示仍遵循过滤与装配策略。

## 五、输出装配（Output Assembly）
- 文本与函数调用统一装配
  - `getStructuredResponse*` 根据存在的文本与函数调用，生成“文本 + \n + JSON”或单独文本/JSON，以匹配 CLI/文档/工具消费。
- 工具响应标准化
  - 核心调度器将模型返回转译为 `functionResponse` 并与可能的二进制/文件内容共同回写；MCP 工具在模型返回函数响应时，进一步提取其 `content` 部分以生成可读字符串或 JSON 片段。
- 流式与非流式响应对齐
  - 非流式：在响应完成后进行一次性解析与历史写入。
  - 流式：在最后片段合并处触发同样的解析、过滤与历史回写，保证跨模式一致。

## 六、与工具调度的协同（AFC / Scheduler）
- 工具调用的生命周期
  - 调度状态（Validating → Scheduled → Executing → Successful/Errored/Cancelled/Waiting）与 UI/CLI 反馈保持一致。
- 函数化转译与历史回写
  - `convertToFunctionResponse(toolName, callId, llmContent)` 将模型返回的结果统一转译为结构化 `functionResponse`（兼容文本、二进制、文件、空数组/空文本）。
- 与下一说话人判定协作
  - 当历史末尾是 `functionResponse`，下一说话人优先判定为模型，避免工具结果后对话意外停滞。

## 七、错误处理与安全
- 判定失败与 API 异常
  - JSON 解析失败或接口异常时返回 `null`，不强制推进，避免错误扩散；打印告警便于排查。
- 非法消息结构修复
  - 空模型消息注入空文本兜底；函数响应检测避免将不可展示的内容作为用户输入重放。
- 隐私与安全
  - 工具参数与响应在历史写入与显示环节进行最小化披露；敏感数据建议在二次开发中加入脱敏过滤。

## 八、性能与压缩
- 令牌限制与总结压缩
  - 当历史接近令牌上限时，触发 `tryCompressChat` 将长对话总结为紧凑上下文；意图判定与 COT 识别继续基于压缩后的精选历史。
- 解析效率
  - 响应解析函数均走首候选、首 parts 快路径，避免不必要的全量扫描。

## 九、二次开发方向（扩展建议）
- 意图识别增强
  - 判定策略扩展（更多规则、稳健的“未完成输出”检测）。
  - 引入对“工具意图但未执行”的软恢复策略与重试提示。
- COT高级控制
  - 在不同任务类型下动态允许/禁止 COT 输出；对 COT 片段进行摘要或因子化（例如关键思路列表）。
- 输出装配模板化
  - 根据终端形态（CLI/Web/Docs）切换不同装配策略与展示模板，支持“只文本/只JSON/混合”。
- 安全与隐私
  - 参数与返回值的敏感字段脱敏；为函数响应添加签名或校验信息。
- 观测与质控
  - 为判定与装配节点增加遥测与指标（判定耗时、命中率、装配错误率）。

## 十、代码索引（关键实现位置）
- 意图判定
  - `utils/nextSpeakerChecker.ts:checkNextSpeaker`（下一说话人判定，精选历史 + JSON Schema 返回）
  - `utils/messageInspectors.ts:isFunctionResponse`（判断用户消息是否为函数响应）
- COT识别
  - `core/geminiChat.ts:isThoughtContent`（首段 `thought: true` 检测）
- 响应解析与装配
  - `utils/generateContentResponseUtilities.ts:getResponseText* / getFunctionCalls* / getStructuredResponse*`
  - `tools/mcp-tool.ts:processFunctionResponse`（MCP函数响应内容处理与串/JSON输出）
- 工具调度与函数化转译
  - `core/coreToolScheduler.test.ts:convertToFunctionResponse`（转译覆盖文本、二进制、文件与空值）
- 思维链支持判定
  - `core/client.ts:isThinkingSupported(model)`（是否启用“思维链”能力）

## 十一、时序概要（文本版）
- 非流式一次对话
  - 用户输入 → 模型生成 → 解析函数调用与文本 → 工具调度（如有） → 转译 `functionResponse` → 历史记录 → 下一说话人判定 → 模型续写或等待用户。
- 流式响应
  - 用户输入 → 模型流式生成（增量片段） → 最末片段合并 → 解析与过滤（含 COT） → 工具调度（如有） → 历史记录 → 下一说话人判定。

---

如需：
- 增加可点击的代码锚点（文件 + 行号）索引；
- 绘制“下一说话人判定”与“结构化输出装配”时序图；
- 提供“扩展任务清单”便于研发迭代；

可继续在本文件后追加相应章节并加入目录索引。