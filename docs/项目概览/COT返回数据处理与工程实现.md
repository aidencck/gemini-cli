# 思维链（COT）返回数据处理与工程实现（体系化/系统化/结构化/分层次）

本文件面向工程二次开发，系统整理“LLM 思维链（COT）返回数据”的分层处理架构、数据契约、处理策略、具体案例与伪代码，实现可解释、可控、可复现的闭环能力。

## 一、执行摘要
- 目标：对 COT 相关返回进行“隔离→解析→治理→装配→调度→存档”的闭环处理，保障用户显示与工程消费一致。
- 方法：采用分层架构（采集/解析、隔离、装配、调度、历史、治理），以标准 JSON 契约和可插拔策略实现。
- 应用：适配本项目的 `functionCall/functionResponse`、结构化输出（文本+JSON）、历史维护与压缩、工具安全门控等。

## 二、分层架构与职责
- 输入采集层（Streaming/Non-Streaming）
  - 统一处理流式与非流式返回；聚合文本、JSON 片段与工具调用信号。
- 解析归段层（Segmentation）
  - 将返回拆分为：`cot_thought`（思维链，需隔离）、`tool_plan`（工具计划）、`functionCall`（可执行）、`final`（用户可见）。
- COT 隔离层（Redaction）
  - 对标注 `thought: true` 的段落进行隔离：不向用户显示、不直接注入工具参数，仅用于日志与评估。
- 结构化装配层（Assembly）
  - 统一“文本 + JSON”输出；将 `final` 文本与结构化契约合并为标准响应对象。
- 工具调度层（Orchestration）
  - 将 `functionCall` 转译为实际工具调用；采集 `functionResponse` 并写回历史；执行失败走重试/降级。
- 历史维护与压缩层（History/Compression）
  - 精选+综合双轨维护；触发令牌阈值进行摘要/压缩；保持会话状态一致性。
- 质量治理层（Validation/Metrics）
  - 契约校验、字段充分性/正确性/一致性、安全红线检查、审计与可追踪性。

## 三、数据契约（标准化）
- 响应对象（工程侧消费）
```json
{
  "user_instruction": "...",
  "cot_thought": { "thought": true, "template": "Step-by-Step", "steps": ["..."] },
  "tool_plan": { "commands": ["..."], "safety": "..." },
  "functionCall": { "name": "file.write", "arguments": { "path": "...", "content": "..." } },
  "final": { "text": "用户可见总结", "patch": { "path": "...", "diff": "..." } },
  "metadata": { "task_type": "Bug Fixing", "granularity": "Function", "risk": "Low" }
}
```
- 约束
  - `cot_thought.thought` 必须为 `true`，用于隔离识别。
  - `functionCall` 与 `tool_plan` 不得包含敏感字段（需先脱敏/过滤）。
  - `final.text` 必须可独立呈现；`final.patch` 仅在工程侧消费。

## 四、处理策略（核心逻辑）
- 流式/非流式一致路径
  - 流式：对 JSON 片段进行增量解析（边界容错），将 `cot_thought` 缓存隔离；仅将 `final.text` 片段流式展示。
  - 非流式：一次性解析并走统一装配流程。
- 隔离与降噪
  - 对 `cot_thought` 执行敏感信息红线检查（路径、密钥、账号、内网域名），不入工具参数；仅保留摘要用于评估。
- 工具门控
  - `functionCall` 需通过白名单与参数校验；失败→重试（指数退避）→降级（仅输出计划，不执行）。
- 合同校验
  - 以 JSON Schema 校验响应对象；字段缺失或类型错误→回退到纯文本模式并记录告警。
- 错误处理
  - 无效 JSON（半结构化）：尝试修复→若失败则仅显示 `final.text` 并记录日志。

## 五、处理流程伪代码
```ts
interface LLMRawChunk { text?: string; json?: string; }
interface ProcessResult {
  display: { text: string }; // 用户可见
  internal: {
    cot?: object; toolPlan?: object; functionCall?: object; final?: object;
    audit: { warnings: string[]; errors: string[] };
  };
}

function processLLMOutput(chunks: LLMRawChunk[]): ProcessResult {
  const state = { cot: undefined, toolPlan: undefined, functionCall: undefined, final: { text: '' }, audit: { warnings: [], errors: [] } };
  for (const c of chunks) {
    const obj = tryParseJSON(c.json);
    if (!obj) { state.final.text += c.text ?? ''; continue; }
    if (obj.cot_thought?.thought === true) state.cot = redact(obj.cot_thought);
    if (obj.tool_plan) state.toolPlan = sanitize(obj.tool_plan);
    if (obj.functionCall) state.functionCall = validateCall(obj.functionCall) ? obj.functionCall : (state.audit.warnings.push('invalid_call'), undefined);
    if (obj.final?.text) state.final.text += obj.final.text;
    if (obj.final?.patch) state.final.patch = obj.final.patch;
  }
  const display = { text: state.final.text.trim() };
  return { display, internal: { cot: state.cot, toolPlan: state.toolPlan, functionCall: state.functionCall, final: state.final, audit: state.audit } };
}
```

## 六、具体数据案例与处理逻辑
- 案例 1：Bug 修复（边界条件）
```json
{
  "user_instruction": "空数组输入导致解析器崩溃，需修复并加单测",
  "cot_thought": { "thought": true, "template": "Decision Tree", "steps": ["识别空输入", "入口加 guard", "补充单测"] },
  "tool_plan": { "commands": ["npm run test -w packages/cli"], "safety": "仅小范围变更" },
  "functionCall": { "name": "file.patch", "arguments": { "path": "packages/cli/src/commands.ts", "snippet": "if (!args || args.length===0) return showHelp();" } },
  "final": { "text": "已修复空输入崩溃并补充测试" },
  "metadata": { "task_type": "Bug Fixing", "granularity": "Function" }
}
```
处理：
- 隔离 `cot_thought` → 不显示；缓存摘要用于评估。
- 校验 `functionCall` → 在白名单内（`file.patch`），参数合法→执行；失败则降级为只输出 `tool_plan`。
- 装配 `final` → 用户端仅显示“已修复…”的总结文本。

- 案例 2：新功能（端到端流程）
```json
{
  "user_instruction": "新增命令 gemini init 生成最小模板",
  "cot_thought": { "thought": true, "template": "Step-by-Step", "steps": ["定义契约", "生成模板", "冲突检测"] },
  "tool_plan": { "commands": ["npm run build", "npm run e2e"], "safety": "工作目录写入" },
  "functionCall": { "name": "fs.write", "arguments": { "path": "templates/min/package.json", "content": "{...}" } },
  "final": { "text": "已实现 init 命令并通过 e2e" }
}
```
处理：
- `cot_thought` 隔离；`functionCall` 执行写入；`final.text` 展示。
- 记录 `functionResponse` 到历史；失败则回滚和提示。

- 案例 3：测试与质量（契约快照）
```json
{
  "user_instruction": "为 JSON 输出添加快照测试",
  "cot_thought": { "thought": true, "template": "Decision Tree", "steps": ["选关键字段", "生成快照", "集成CI"] },
  "tool_plan": { "commands": ["npm run test", "git diff -- snapshots"] },
  "final": { "text": "已添加快照测试并接入CI" }
}
```
处理：
- 无 `functionCall` → 不执行工具，显示 `final`；将 `tool_plan` 写入内部记录便于追踪。

- 案例 4：评审与治理（依赖安全）
```json
{
  "user_instruction": "扫描依赖安全风险并制定升级方案",
  "cot_thought": { "thought": true, "template": "Plan-Execute-Evaluate", "steps": ["识别高危", "查阅修复版本", "分步升级计划"] },
  "tool_plan": { "commands": ["npm audit", "npx depcheck"], "safety": "只读" },
  "final": { "text": "已输出安全与依赖治理报告" },
  "metadata": { "risk": "Medium" }
}
```
处理：
- `cot_thought` 隔离；`tool_plan` 仅记录不执行；`final` 展示结论。

## 七、配置与开关（工程参数）
- `EXPOSE_COT`（默认 false）：是否在开发模式展示 COT 摘要（仅显式开启）。
- `STRICT_JSON`（默认 true）：严格校验 JSON 契约，失败回退纯文本模式。
- `AUTO_TOOL_EXECUTE`（默认 guarded）：白名单内自动执行工具；否则仅展示计划。
- `STREAM_MODE`（默认 on）：启用流式增量解析与展示。

## 八、质量与合规治理
- 敏感信息红线：路径/密钥/账号/内网域名→脱敏或拒绝执行。
- 审计追踪：记录 `functionCall/functionResponse` 与策略决策；保留时间线与哈希。
- 指标度量：COT 完整度、合同一致性、工具成功率、重试次数、回退频率、时延与成本。

## 九、工程协同与扩展
- 与本项目协同：`functionCall → 调度 → functionResponse` 写回历史；结构化装配（文本+JSON）；精选/综合历史维护；CLI/文档/API 一致消费。
- 模型切换策略：复杂推理任务偏向强推理模型，通用生成偏向高吞吐模型；COT 始终 `thought:true` 隔离。
- ReAct 协同：将外部工具取数融入 `tool_plan` 与 `functionCall`，避免将 COT 直接注入工具参数。

## 十、关联与后续工作
- 关联文档：
  - `docs/项目概览/LLM返回数据处理逻辑.md`
  - `docs/项目概览/COT端到端闭环体系.md`
  - `docs/项目概览/意图识别与COT处理体系.md`
- 后续增强：提供 JSON Schema、契约校验脚本、CI 集成、错误修复器（invalid JSON 修复）、指标看板与治理控制台。