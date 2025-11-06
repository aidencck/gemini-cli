# COT增量工具纳入与思维链扩展体系（系统化・结构化・分层）

目标：当工程中新增工具与逻辑时，让LLM在思维链（COT）阶段自然“纳入增量工具”，在规划与推理中体现这些能力，并通过统一合同与门控实现可执行、可回放、可评估的端到端闭环。

## 0. 背景与目标
- 背景：项目持续引入新工具（如查询、文件操作、Web自动化、命令执行等），需要LLM在COT中主动使用并解释这些增量能力。
- 目标：
  - 在COT前半段“先列工具与步骤”并包含增量工具信息；
  - 通过工具注册表 + 合同扩展 + 提示模板，实现自动适配；
  - 保持安全门控、幂等与成本控制，支持回放与度量。

## 1. 增量纳入场景与挑战
- 场景：新增工具（web_fetch、mcp_Puppeteer_*、run_command 等）、扩展逻辑（复杂门控、回退策略、跨文件变更）。
- 挑战：
  - 一致合同：不同工具的参数与行为要对齐到统一结构；
  - 发现与选择：模型需“知道新工具存在并何时使用”；
  - 安全与幂等：避免破坏性执行；
  - 成本与性能：控制推理与工具调用开销。

## 2. 分层架构（五层）
- 工具注册层（Tool Registry）：维护工具清单、能力标签、兼容环境、风险等级、示例用法。
- 合同与能力层（Contract & Capabilities）：统一 `tool_plan_v2` 合同，扩展字段以承载增量信息（能力、门控、回退、成本、阻塞性）。
- 提示规划层（Prompt Planning）：Few-shot模板与规则，让模型在COT中先输出工具计划并解释选择与期望结果。
- 执行与门控层（Execution & Gating）：依据 `when/preconditions`、安全策略与幂等要求执行，失败走 `rollback`。
- 度量与反馈层（Telemetry & Feedback）：收集合同合规率、执行成功率、回退率与端到端成功率，驱动数据与模板迭代。

## 3. 合同扩展（tool_plan_v2）
> 在已有 `tool_plan` 基础上扩展增量字段，以适配新工具与复杂逻辑。
```json
{
  "version": "tool_plan_v2",
  "tool_registry_version": "2025.11.01",
  "tools": [
    {
      "id": "code-search",
      "name": "search_codebase",
      "capability_tag": ["search", "code-navigation"],
      "args": {
        "information_request": "find usage of X",
        "target_directories": ["/root/gemini-cli/packages/core/src"]
      },
      "preconditions": ["未定位入口", "需要调用栈线索"],
      "postconditions": ["返回路径与行号候选"],
      "when": "定位不足或需要交叉验证",
      "expect": "获得候选列表以供下一步验证",
      "rollback": "扩大目录或改用正则",
      "compat": {"runtime": "nodejs@18", "os": "linux"},
      "risk_level": "low",
      "cost_estimate": {"latency_ms": 200, "tokens": 0},
      "blocking": false
    },
    {
      "id": "web-get",
      "name": "web_fetch",
      "capability_tag": ["http", "fetch"],
      "args": {"url": "https://example.com/docs"},
      "preconditions": ["需要外部文档/接口说明"],
      "postconditions": ["返回HTML/JSON响应"],
      "when": "项目内未找到足够信息",
      "expect": "获取上下游依赖文档",
      "rollback": "改用内部文档或缓存",
      "compat": {"network": true},
      "risk_level": "medium",
      "cost_estimate": {"latency_ms": 500, "tokens": 100},
      "blocking": false
    },
    {
      "id": "ui-screenshot",
      "name": "mcp_Puppeteer_puppeteer_screenshot",
      "capability_tag": ["browser", "screenshot"],
      "args": {"name": "homepage", "width": 1280, "height": 800},
      "preconditions": ["已成功导航到页面"],
      "postconditions": ["生成截图资产"],
      "when": "需要UI可视验证或文档预览",
      "expect": "产出可视证据以供评审",
      "rollback": "退化为DOM抓取/文本快照",
      "compat": {"headless": true},
      "risk_level": "low",
      "cost_estimate": {"latency_ms": 800, "tokens": 20},
      "blocking": false
    }
  ],
  "auto_execute": false
}
```
要点：
- `capability_tag/preconditions/postconditions/compat/risk_level/cost_estimate/blocking` 承载增量信息，便于选择、门控与成本控制。
- `tool_registry_version` 与 `version` 支持合同演进与回放兼容。

## 4. 工具注册表（Tool Registry）
> 维护统一注册表，供模型上下文与执行管线共享。
- 建议文件：`schema/tool_registry.json` 与文档说明 `docs/tools/index.md`
- JSON结构示例：
```json
{
  "registry_version": "2025.11.01",
  "tools": [
    {
      "id": "code-search",
      "name": "search_codebase",
      "capabilities": ["search", "code-navigation"],
      "args_schema": {"information_request": "string", "target_directories": "string[]"},
      "compat": {"runtime": "nodejs@18"},
      "risk_level": "low",
      "examples": ["find usage of loadConfig in packages/cli/src"],
      "notes": "用于代码定位与候选列表生成"
    },
    {
      "id": "web-get",
      "name": "web_fetch",
      "capabilities": ["http", "fetch"],
      "args_schema": {"url": "string"},
      "compat": {"network": true},
      "risk_level": "medium",
      "examples": ["fetch external docs"],
      "notes": "用于获取外部依赖文档"
    },
    {
      "id": "ui-screenshot",
      "name": "mcp_Puppeteer_puppeteer_screenshot",
      "capabilities": ["browser", "screenshot"],
      "args_schema": {"name": "string", "width": "number", "height": "number"},
      "compat": {"headless": true},
      "risk_level": "low",
      "examples": ["take homepage screenshot for review"],
      "notes": "用于UI可视验证"
    }
  ]
}
```

## 5. 提示策略（纳入增量工具）
- 上下文注入：将 `tool_registry.json` 的简版摘要嵌入 `context_assets`，或提供工具索引清单（名称/能力/示例）。
- 模板要点：
```text
你是项目代码助手。先读取当前可用工具索引（名称/能力/风险）。
在 COT 的前半段先输出工具计划（tool-first）：
- 对每个步骤写明：目的/输入/成功判定/风险/回退；
- 依据工具能力与兼容约束选择合适工具；
- 输出使用统一合同 tool_plan_v2，auto_execute=false。
随后在 COT 中简述选择理由与预期结果，再展开详细推理。
```
- 风格与成本：原子化短句；限制 token；引用代码或日志需给出路径与行信息。

## 6. 处理流程（从COT到执行）
- 解析：校验 `tool_plan_v2` 与 Schema；合并注册表与能力信息。
- 门控：评估 `preconditions/when/compat/risk_level`；拒绝不合规执行。
- 执行：遵循步骤依赖；失败触发 `rollback`；记录变更与日志。
- 回放：产出执行报告，落盘补丁；可根据注册表版本重跑。

## 7. 数据集与训练（增量适配）
- 样本配额：工具相关场景≥30%，覆盖新工具；任务类型×领域×难度分层抽样。
- 正负样本：错误工具选择/顺序/门控作为负例，结合DPO偏好对齐。
- 奖励信号：执行成功率、编译/测试通过、合同合规率；融入RLHF。

## 8. 示例（新增UI验证工具）
```json
{
  "user_instruction": "为文档首页生成可视预览并附带截图",
  "context_assets": {"env": {"runtime": "nodejs@18"}, "tools_index": ["ui-screenshot", "web-get"]},
  "cot_thought": {
    "thought": true,
    "steps": [
      "计划工具：优先使用浏览器截图以获得可视证据",
      "导航：若页面地址未知，用 web_fetch 获取入口链接",
      "截图：puppeteer_screenshot 生成 1280x800 预览",
      "验证：检查截图生成成功并保存到 assets"
    ]
  },
  "tool_plan": {
    "version": "tool_plan_v2",
    "tool_registry_version": "2025.11.01",
    "tools": [
      {"id": "web-get", "name": "web_fetch", "args": {"url": "https://example.com/docs"}, "when": "入口链接未知", "expect": "获取HTML文档", "rollback": "改用内部README"},
      {"id": "ui-screenshot", "name": "mcp_Puppeteer_puppeteer_screenshot", "args": {"name": "homepage", "width": 1280, "height": 800}, "preconditions": ["已导航成功"], "when": "需要可视验证", "expect": "生成截图", "rollback": "改为DOM文本抓取", "risk_level": "low"}
    ],
    "auto_execute": false
  },
  "final_summary": "生成首页截图以供评审，方案包含链接发现与可视证据"
}
```

## 9. 评估与治理
- 合同合规：Schema通过率、字段完整度、门控正确率。
- 执行成功：工具成功率、回退触发率、端到端成功率。
- 安全幂等：无破坏性执行、权限合规、可重复回放。
- 成本控制：平均token、步骤数、工具耗时与失败占比。

## 10. 行动清单（落地）
- 在 `schema/` 目录落盘 `tool_plan_v2.schema.json` 与 `tool_registry.json`。
- 在 `docs/tools/index.md` 记录工具索引、能力、风险与示例。
- 更新提示模板，将“增量工具索引”注入上下文并强制 tool-first 输出。
- 在 CI 增加合同与门控静态校验步骤，产出执行报告到 `docs/CI/`。
- 迭代数据集：按五维配额补齐新工具场景，构造DPO正负对与RLHF奖励。

— 结合 `COT阶段工具指导与步骤规划.md` 与 `COT返回数据处理与工程实现.md`，本增量纳入体系提供架构、合同与模板三位一体的落地方案。