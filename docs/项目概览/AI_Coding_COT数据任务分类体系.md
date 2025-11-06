# AI Coding 的 COT 数据任务分类体系（体系化/系统化/结构化/分层次）

本文件从 LLM 专家视角，针对 AI Coding 场景下的“思维链（Chain-of-Thought, COT）”数据任务进行系统化、结构化、分层次的分类与治理建议，覆盖任务维度、标注维度、质量与评估、采样与均衡、工程落地与隐私合规等关键环节。

## 一、执行摘要
- 分类目标：构建可用于训练、评估与工程落地的 COT 数据任务体系，让复杂编码任务的推理过程可解释、可控、可复现。
- 结构方法：按“任务类型/推理类型/粒度层级/工具耦合/风险等级/输入输出契约”等维度建立多轴分类；结合标准化标注 schema 与质量度量闭环。
- 项目落地：与本项目的意图识别、COT隔离、工具调度、结构化装配、历史维护与压缩策略相互映射，保障运行时与数据侧的一致协同。

## 二、分类维度总览（多轴）
- 任务类型维度
  - 修复缺陷（Bug Fixing）：快速定位、根因分析、最小修复补丁。
  - 新功能开发（Feature Implementation）：需求理解、API/接口设计、模块实现与集成。
  - 重构优化（Refactoring）：结构整序、性能优化、可维护性提升。
  - 测试与质量（Testing & QA）：单测编写、集成测试、静态检查与覆盖率提升。
  - 文档与注释（Documentation）：接口文档、使用示例、代码注释规范化。
  - 代码评审（Code Review）：风格一致性、复杂度与安全建议、变更风险识别。
- 推理类型维度
  - 规格/需求解释（Spec Reasoning）：从自然语言到技术要求的映射与约束抽取。
  - 设计与架构（Design Reasoning）：模块划分、依赖关系、模式选型与权衡。
  - 算法与数据结构（Algorithmic Reasoning）：正确性、复杂度、边界条件与测试用例。
  - 环境与依赖（Env Reasoning）：构建/运行环境、依赖版本、兼容性与迁移策略。
  - 工具与命令（Tool Reasoning）：脚本/CLI/MCP 工具使用规划与安全限制。
- 粒度层级维度
  - 行级/片段级（Line/Snippet）：小范围修复或增量；精细 COT。
  - 函数/类级（Function/Class）：完整单元实现或重构；中等 COT。
  - 模块/库级（Module/Library）：跨文件与依赖协调；较长 COT。
  - 仓库/系统级（Repo/System）：架构演进、广泛影响；长链 COT。
- 输入上下文维度
  - 纯文本指令、Issue/Ticket、失败测试日志、运行错误堆栈、性能剖析报告、架构图/接口文档等。
- 输出契约维度
  - 补丁（Patch/Diff）、PR 描述、命令序列（可重放）、结构化 JSON（工具/配置）与人类可读总结。
- 工具耦合维度（与 MCP/CLI 等集成）
  - 文件系统、Shell/Process、Web-Fetch、RAG/检索、构建/测试工具、包管理器等。
- 风险与安全维度
  - 安全敏感（权限/密钥/网络访问）、破坏性操作（删除/覆盖）、合规风险（许可证/数据主权）。

## 三、任务分类细目（示例集）
- Bug 修复
  - 语法/类型错误修复、边界条件修复、异步与竞态问题、资源泄漏与性能热点。
- 新功能
  - 端到端流程实现、接口扩展与兼容、跨模块集成、配置化与开关策略。
- 重构与优化
  - 结构整序（拆分/合并）、API 稳定性与契约一致性、性能与内存优化。
- 测试与质量
  - 单测场景设计、集成测试脚本、快照/契约测试、失败复现与修复回归。
- 文档与注释
  - README/开发者指南、API 说明、注释补全与一致性、示例与教程。
- 评审与治理
  - 风格/规范一致性、复杂度评估、依赖与安全扫描、变更风险分级建议。

## 四、COT 结构化模板（推荐）
- 步进推理（Step-by-Step）：问题拆解 → 方案对比 → 选择依据 → 实施步骤 → 验证与回退。
- 证据链（Hypothesis-Evidence）：假设 → 证据收集 → 验证/反例 → 结论与风险。
- 决策树（Decision Tree）：条件分支 → 行动策略 → 预期结果 → 异常处理。
- 计划-执行-评估（Plan-Execute-Evaluate）：初始计划 → 执行细节 → 评估与调整。
- 工具协同（Tool-Plan）：工具选择 → 参数与约束 → 安全确认 → 重试与兜底。
- 在工程侧，对 COT 的“思考”与“可展示/可执行”分段，用 `thought: true` 标识思维链段，确保隔离与解析。

## 五、标注 Schema（统一规范）
- 角色与分段
  - `user_instruction`：用户/需求输入（原始或规范化）。
  - `context_assets`：相关代码/日志/文档片段引用（带路径与行号）。
  - `cot_thought`：思维链分段（结构化模板之一）。
  - `tool_plan`：工具/命令计划（含安全约束与参数）。
  - `tool_call`：实际调用记录（名称/参数/返回摘要）。
  - `output_patch`：最终补丁/代码片段（带位置元信息）。
  - `final_summary`：人类可读结论与后续建议。
- 元数据与标签
  - 任务类型/推理类型/粒度层级/风险等级/工具类型/输入来源/输出契约/评估结果。
- 质量字段
  - 充分性（信息覆盖）、正确性（逻辑/实现）、一致性（契约/风格）、安全性（权限/隐私）、可复现性（命令/环境）。

## 六、质量与评估（可度量）
- 指标
  - 任务成功率、COT 完整度与可解释性、工具成功率与重试次数、装配错误率、流式/非流式一致性、时延与成本。
- 评测方法
  - 单元与集成评测、契约/快照测试、基于任务模板的自动验证、风险场景对抗测试（安全/破坏性操作）。
- 数据治理
  - 去重与泄露检测、来源合法性与许可证、隐私脱敏与权限控制、审计与可追踪性。

## 七、采样与均衡（数据集构建）
- 分层采样：按任务类型、推理类型与粒度层级进行比例控制与均衡。
- 难度分级：构建从简单到复杂的任务金字塔，支持自一致性采样与多样性增强。
- 领域覆盖：常见语言/框架/工具与企业级场景（CI/CD、容器、云环境）。
- 负面与反例：包含典型错误与异常路径，提升鲁棒性与安全性。

## 八、工程落地映射（与本项目协同）
- 意图与门控：精选历史 + 判定提示，返回标准 JSON 决策（下一说话人与工具意图）。
- COT 隔离：识别 `thought: true` 的思维链分段；避免泄露至用户显示或工具输入。
- 工具调度与转译：模型 `functionCall` → 调度执行 → 标准化 `functionResponse` 写回历史。
- 结构化装配：统一“文本 + JSON”；保障 CLI/文档/API 的一致消费。
- 历史维护与压缩：综合/精选双轨；令牌阈值触发压缩与上下文重建。

## 九、隐私与合规
- 最小披露与脱敏：路径/参数/日志中敏感字段处理；仅保留必要上下文。
- 权限与审计：敏感工具操作需确认与记录；分级告警与回溯。
- 许可证与来源：外部片段引用需许可证合规与来源登记。

## 十、路线图与扩展
- 策略引擎：按场景切换（本地优先/模型优先、COT显示/隔离、工具自动执行）。
- 训练协同：引入带 COT 的 SFT/自一致性成果，建立评估与灰度上线机制。
- RAG 集成：检索结果纳入精选历史，提升复杂任务推理质量。
- 可视化与治理：时序/状态图、策略控制台、指标看板与 AB 实验。

## 十一、参考资料（拓展阅读）
- Chain-of-Thought 定义与 Zero/Few-shot 应用综述：https://www.cnblogs.com/ting1/p/17568291.html
- CoT 提升复杂推理能力的实践综述：https://www.cnblogs.com/ting1/p/18247259
- 布局化 CoT 在文档理解中的应用案例（概念延伸）：https://www.53ai.com/news/LargeLanguageModel/2024072393706.html

## 十二、关联文档索引
- COT 端到端闭环：`docs/项目概览/COT端到端闭环体系.md`
- LLM 产生 COT 与优化使用闭环：`docs/项目概览/LLM产生COT与优化使用闭环体系.md`
- 意图识别与 COT 处理：`docs/项目概览/意图识别与COT处理体系.md`
- 判定机制综述：`docs/项目概览/意图识别判定机制综述.md`
- 项目架构深度综述：`docs/项目概览/项目架构深度综述.md`

——
如需继续：
- 我可为该文档增加目录锚点、分类图谱与示例样本 schema；
- 提供标注指南与质量检查清单（Checklist），并保存到同目录。

## 十三、任务级 COT 训练数据示例（每任务一条）

说明：以下示例采用文档中的“标注 Schema”字段结构，`cot_thought` 段落使用 `thought: true` 隔离，仅供训练与评估；示例上下文与补丁为可复现的典型场景模板，需按实际项目调整。

### A. Bug 修复

- 语法/类型错误修复（Syntax/Type Fix）
```json
{
  "task_id": "BUG_FIX_SyntaxType",
  "user_instruction": "修复 TypeScript 编译错误：Cannot find name 'RequestInit'",
  "context_assets": [
    {"path": "packages/cli/tsconfig.json", "hint": "缺少 DOM 类型"},
    {"path": "packages/cli/src/index.ts", "hint": "使用 fetch/RequestInit"}
  ],
  "cot_thought": {
    "thought": true,
    "template": "Step-by-Step",
    "steps": [
      "定位报错文件与符号，确认为 TS Lib 未包含 DOM",
      "检查 tsconfig 的 lib 配置",
      "在最小变更下加入 DOM，触发增量构建验证",
      "评估影响范围（仅 CLI 构建阶段）"
    ]
  },
  "tool_plan": {
    "commands": [
      "npm run build",
      "grep -R 'RequestInit' packages/cli/src"
    ],
    "safety": "仅修改 tsconfig，不触发破坏性操作"
  },
  "output_patch": {
    "path": "packages/cli/tsconfig.json",
    "diff": "+\"lib\": [\"ES2020\", \"DOM\"]"
  },
  "final_summary": "通过在 tsconfig 中加入 DOM lib 修复类型缺失，构建通过。",
  "metadata": {
    "task_type": "Bug Fixing",
    "reasoning_type": "Env/Tooling",
    "granularity": "Module",
    "risk": "Low",
    "tools": ["shell", "file-system"]
  },
  "evaluation": {
    "checks": ["build_success", "no_new_lints"],
    "expected": "TypeScript 编译无错误"
  }
}
```

- 边界条件修复（Boundary Condition）
```json
{
  "task_id": "BUG_FIX_Boundary",
  "user_instruction": "当输入为空数组时，命令解析器抛出异常，需修复",
  "context_assets": [
    {"path": "packages/cli/src/commands.ts", "hint": "迭代参数未做长度判断"}
  ],
  "cot_thought": {
    "thought": true,
    "template": "Decision Tree",
    "steps": [
      "识别空输入场景",
      "决策：返回帮助/提示或空结果",
      "实现：在入口处加 guard",
      "验证：单测覆盖空数组与单元素"
    ]
  },
  "tool_plan": {"commands": ["npm run test -w packages/cli"], "safety": "仅小范围代码变更"},
  "output_patch": {"path": "packages/cli/src/commands.ts", "snippet": "if (!args || args.length === 0) return showHelp();"},
  "final_summary": "为解析器增加空输入保护，确保健壮性。",
  "metadata": {"task_type": "Bug Fixing", "reasoning_type": "Algorithmic", "granularity": "Function", "risk": "Low"}
}
```

- 异步与竞态问题（Async/Race）
```json
{
  "task_id": "BUG_FIX_Race",
  "user_instruction": "并发写文件偶发覆盖，需要串行化或使用原子写入",
  "context_assets": [{"path": "packages/core/src/fs.ts", "hint": "多处并发 writeFile 调用"}],
  "cot_thought": {"thought": true, "template": "Hypothesis-Evidence", "steps": ["假设：Promise.all 并发导致覆盖", "证据：日志序列中存在交错", "修复：引入队列/原子写临时文件再 rename", "验证：压力测试 1k 次无覆盖"]},
  "tool_plan": {"commands": ["node scripts/sandbox.js --stress-write"], "safety": "不触发删除操作"},
  "output_patch": {"path": "packages/core/src/fs.ts", "snippet": "await writeAtomic(path, data);"},
  "final_summary": "采用原子写方案消除并发覆盖。",
  "metadata": {"task_type": "Bug Fixing", "reasoning_type": "Env/Concurrency", "granularity": "Function", "risk": "Medium"}
}
```

- 资源泄漏与性能热点（Leak/Hotspot）
```json
{
  "task_id": "BUG_FIX_LeakHotspot",
  "user_instruction": "CLI 进程退出未释放文件句柄，长期运行占用过高",
  "context_assets": [{"path": "packages/cli/src/index.ts", "hint": "未关闭流/watcher"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["盘点所有资源创建点", "添加 finally/cleanup 钩子", "压力运行 10min 观测句柄数", "评估：CPU/内存回落"]},
  "tool_plan": {"commands": ["npm run sandbox", "lsof -p $PID | wc -l"], "safety": "只读观测与小改"},
  "output_patch": {"path": "packages/cli/src/index.ts", "snippet": "process.on('exit', cleanup);"},
  "final_summary": "统一清理钩子消除泄漏并降低资源占用。",
  "metadata": {"task_type": "Bug Fixing", "reasoning_type": "Env/Runtime", "granularity": "Module", "risk": "Medium"}
}
```

### B. 新功能开发

- 端到端流程实现（End-to-End Flow）
```json
{
  "task_id": "FEAT_E2EFlow",
  "user_instruction": "新增命令 `gemini init`，生成项目最小模板",
  "context_assets": [{"path": "packages/cli/src/commands.ts", "hint": "命令注册点"}],
  "cot_thought": {"thought": true, "template": "Step-by-Step", "steps": ["定义命令契约与参数", "创建模板文件集合", "实现写入与冲突检测", "集成帮助与文档"]},
  "tool_plan": {"commands": ["npm run build", "npm run e2e"], "safety": "写入仅限工作目录"},
  "output_patch": {"path": "packages/cli/src/commands.ts", "snippet": "register('init', initHandler);"},
  "final_summary": "完成 `init` 端到端流程并进入 e2e 测试。",
  "metadata": {"task_type": "Feature", "reasoning_type": "Design/Tool", "granularity": "Module", "risk": "Low"}
}
```

- 接口扩展与兼容（API Extension）
```json
{
  "task_id": "FEAT_APIExtension",
  "user_instruction": "为核心模块暴露选项 `--theme` 并向后兼容",
  "context_assets": [{"path": "packages/core/src/index.ts", "hint": "入口配置解析"}],
  "cot_thought": {"thought": true, "template": "Decision Tree", "steps": ["兼容策略：默认主题=default", "CLI 参数解析与校验", "传递到渲染层", "回退方案：无效值提示"]},
  "tool_plan": {"commands": ["npm run build", "npm run integration-tests"], "safety": "不移除旧选项"},
  "output_patch": {"path": "packages/core/src/index.ts", "snippet": "const theme = opts.theme ?? 'default';"},
  "final_summary": "新增主题选项，保持旧行为不变。",
  "metadata": {"task_type": "Feature", "reasoning_type": "Spec/Design", "granularity": "Function", "risk": "Low"}
}
```

- 跨模块集成（Cross-Module Integration）
```json
{
  "task_id": "FEAT_CrossModule",
  "user_instruction": "CLI 新命令需要调用 Core 的工具 API 并输出 JSON",
  "context_assets": [{"path": "packages/cli/src/index.ts", "hint": "调用点"}, {"path": "packages/core/src/tools-api.ts", "hint": "被调用 API"}],
  "cot_thought": {"thought": true, "template": "Tool-Plan", "steps": ["定义输出契约 JSON Schema", "封装调用并处理错误", "统一日志与返回码", "集成到历史维护"]},
  "tool_plan": {"commands": ["npm run build", "node packages/cli/dist/index.js cmd --json"], "safety": "只读调用"},
  "output_patch": {"path": "packages/cli/src/index.ts", "snippet": "const result = await coreTools.run(plan); console.log(JSON.stringify(result));"},
  "final_summary": "完成跨模块集成并统一结构化输出。",
  "metadata": {"task_type": "Feature", "reasoning_type": "Design/Tool", "granularity": "Module", "risk": "Low"}
}
```

- 配置化与开关策略（Config/Flag）
```json
{
  "task_id": "FEAT_ConfigFlag",
  "user_instruction": "增加环境变量 `GEMINI_CLI_STRICT` 控制严格模式",
  "context_assets": [{"path": "packages/cli/src/config.ts", "hint": "读取 env 与默认值"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["选择 env 优先级 > CLI 参数 > 默认值", "实现布尔解析", "评估：对错误处理路径的影响", "文档更新"]},
  "tool_plan": {"commands": ["GEMINI_CLI_STRICT=1 npm run build"], "safety": "不写入磁盘"},
  "output_patch": {"path": "packages/cli/src/config.ts", "snippet": "strict: process.env.GEMINI_CLI_STRICT === '1'"},
  "final_summary": "新增严格模式开关，默认关闭，向后兼容。",
  "metadata": {"task_type": "Feature", "reasoning_type": "Spec/Env", "granularity": "Function", "risk": "Low"}
}
```

### C. 重构与优化

- 结构整序（拆分/合并）
```json
{
  "task_id": "REFACTOR_Structure",
  "user_instruction": "将大型函数拆分为可复用的小函数并降低复杂度",
  "context_assets": [{"path": "packages/core/src/index.ts", "hint": "200+ 行函数"}],
  "cot_thought": {"thought": true, "template": "Step-by-Step", "steps": ["识别逻辑块与副作用边界", "抽取纯函数", "保留外部契约不变", "补充分支测试"]},
  "tool_plan": {"commands": ["npm run test -w packages/core"], "safety": "不改外部 API"},
  "output_patch": {"path": "packages/core/src/index.ts", "snippet": "function parsePlan(...) { /* small */ }"},
  "final_summary": "拆分复杂函数为小单元，提升可维护性。",
  "metadata": {"task_type": "Refactoring", "reasoning_type": "Design/Algorithmic", "granularity": "Function", "risk": "Low"}
}
```

- API 稳定性与契约一致性
```json
{
  "task_id": "REFACTOR_APIContract",
  "user_instruction": "统一返回对象字段命名风格为 camelCase",
  "context_assets": [{"path": "packages/core/src/tools-api.ts", "hint": "部分字段为 snake_case"}],
  "cot_thought": {"thought": true, "template": "Decision Tree", "steps": ["制定映射表", "保留旧字段但标记 deprecated", "在 CLI 层做兼容转换", "文档同步"]},
  "tool_plan": {"commands": ["npm run integration-tests"], "safety": "向后兼容，无破坏"},
  "output_patch": {"path": "packages/core/src/tools-api.ts", "snippet": "result.toolStatus -> result.toolStatus"},
  "final_summary": "统一命名风格并保留兼容层，减少破坏。",
  "metadata": {"task_type": "Refactoring", "reasoning_type": "Spec/Design", "granularity": "Module", "risk": "Medium"}
}
```

- 性能与内存优化
```json
{
  "task_id": "REFACTOR_Perf",
  "user_instruction": "优化大列表渲染/处理，减少内存峰值与耗时",
  "context_assets": [{"path": "packages/core/src/index.ts", "hint": "一次性加载全部项"}],
  "cot_thought": {"thought": true, "template": "Hypothesis-Evidence", "steps": ["假设：同步处理导致阻塞", "证据：性能剖析显示主线程占用高", "修复：批处理/流式 + 背压控制", "验证：耗时下降>30%"]},
  "tool_plan": {"commands": ["node --prof packages/core/dist/index.js"], "safety": "只读测试"},
  "output_patch": {"path": "packages/core/src/index.ts", "snippet": "for await (const batch of streamBatches(items)) { ... }"},
  "final_summary": "引入流式批处理与背压，显著优化性能。",
  "metadata": {"task_type": "Refactoring", "reasoning_type": "Algorithmic/Env", "granularity": "Module", "risk": "Low"}
}
```

### D. 测试与质量

- 单测场景设计
```json
{
  "task_id": "TEST_UnitDesign",
  "user_instruction": "为 tools-api 的错误分支补充单元测试",
  "context_assets": [{"path": "packages/core/src/tools-api.ts", "hint": "错误分支未覆盖"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["枚举错误类型", "构造模拟返回", "断言结构化错误输出", "评估覆盖率提升"]},
  "tool_plan": {"commands": ["npm run test -w packages/core", "npx vitest --coverage"], "safety": "仅新增测试"},
  "output_patch": {"path": "packages/core/src/__tests__/tools-api.spec.ts", "snippet": "it('handles tool error', ...)"},
  "final_summary": "补齐错误分支单测，提升覆盖率与稳健性。",
  "metadata": {"task_type": "Testing", "reasoning_type": "Spec/Algorithmic", "granularity": "Module", "risk": "Low"}
}
```

- 集成测试脚本
```json
{
  "task_id": "TEST_Integration",
  "user_instruction": "新增 CLI 与 Core 的端到端集成测试",
  "context_assets": [{"path": "integration-tests/run-tests.js", "hint": "测试入口"}],
  "cot_thought": {"thought": true, "template": "Step-by-Step", "steps": ["准备测试数据与环境", "执行 CLI 命令并捕获输出", "断言 JSON 契约与状态码", "清理与报告"]},
  "tool_plan": {"commands": ["node integration-tests/run-tests.js"], "safety": "只读与临时文件"},
  "output_patch": {"path": "integration-tests/run-tests.js", "snippet": "assert.equal(result.status, 'ok');"},
  "final_summary": "完成端到端集成测试，保障契约一致性。",
  "metadata": {"task_type": "Testing", "reasoning_type": "Spec/Design", "granularity": "Repo", "risk": "Low"}
}
```

- 快照/契约测试
```json
{
  "task_id": "TEST_Contract",
  "user_instruction": "为结构化输出添加快照测试，防止破坏",
  "context_assets": [{"path": "packages/cli/src/index.ts", "hint": "JSON 输出"}],
  "cot_thought": {"thought": true, "template": "Decision Tree", "steps": ["选择关键字段作为契约", "生成初始快照", "集成到 CI", "变更时显式更新"]},
  "tool_plan": {"commands": ["npm run test", "git diff -- snapshots"], "safety": "非破坏性"},
  "output_patch": {"path": "packages/cli/__tests__/output.spec.ts", "snippet": "expect(json).toMatchSnapshot();"},
  "final_summary": "快照测试锁定输出契约，降低回归风险。",
  "metadata": {"task_type": "Testing", "reasoning_type": "Spec", "granularity": "Module", "risk": "Low"}
}
```

- 失败复现与修复回归
```json
{
  "task_id": "TEST_FailRepro",
  "user_instruction": "用户反馈在特定输入下崩溃，需复现与回归测试",
  "context_assets": [{"path": "integration-tests/test-helper.js", "hint": "可注入错误用例"}],
  "cot_thought": {"thought": true, "template": "Hypothesis-Evidence", "steps": ["收集最小复现场景", "构建回归用例", "修复并验证", "将用例纳入长期集成"]},
  "tool_plan": {"commands": ["node integration-tests/run-tests.js -c crash-case"], "safety": "隔离测试环境"},
  "output_patch": {"path": "integration-tests/test-helper.js", "snippet": "export const cases = [..., 'crash-case'];"},
  "final_summary": "复现并修复崩溃案例，加入回归测试集。",
  "metadata": {"task_type": "Testing", "reasoning_type": "Algorithmic/Env", "granularity": "Repo", "risk": "Medium"}
}
```

### E. 文档与注释

- README/开发者指南
```json
{
  "task_id": "DOC_Readme",
  "user_instruction": "更新 README，增加快速开始与常见问题",
  "context_assets": [{"path": "README.md", "hint": "顶层用法说明"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["盘点用户旅程与关键命令", "补充配置与环境依赖", "校对一致性与链接", "评估：降低上手成本"]},
  "tool_plan": {"commands": ["npm run build"], "safety": "文档变更"},
  "output_patch": {"path": "README.md", "snippet": "## Quick Start\n..."},
  "final_summary": "完善 README 提升可用性与可发现性。",
  "metadata": {"task_type": "Documentation", "reasoning_type": "Spec/Design", "granularity": "Repo", "risk": "Low"}
}
```

- API 说明
```json
{
  "task_id": "DOC_API",
  "user_instruction": "补充 tools-api 的参数与返回示例",
  "context_assets": [{"path": "docs/core/tools-api.md", "hint": "API 文档位置"}],
  "cot_thought": {"thought": true, "template": "Step-by-Step", "steps": ["收敛契约字段", "提供示例与错误码", "关联版本变更", "添加交叉引用"]},
  "tool_plan": {"commands": ["npm run build"], "safety": "文档变更"},
  "output_patch": {"path": "docs/core/tools-api.md", "snippet": "### Parameters\n..."},
  "final_summary": "补齐 API 文档，提升集成效率。",
  "metadata": {"task_type": "Documentation", "reasoning_type": "Spec", "granularity": "Module", "risk": "Low"}
}
```

- 注释补全与一致性
```json
{
  "task_id": "DOC_Comments",
  "user_instruction": "为核心函数补全 JSDoc 注释并统一风格",
  "context_assets": [{"path": "packages/core/src/index.ts", "hint": "缺少注释"}],
  "cot_thought": {"thought": true, "template": "Decision Tree", "steps": ["确定注释标准", "补齐参数与返回说明", "添加示例", "在 CI 中开启注释检查"]},
  "tool_plan": {"commands": ["npm run lint"], "safety": "非代码逻辑变更"},
  "output_patch": {"path": "packages/core/src/index.ts", "snippet": "/** Parse plan */"},
  "final_summary": "统一注释风格与覆盖，提升可读性。",
  "metadata": {"task_type": "Documentation", "reasoning_type": "Spec", "granularity": "Function", "risk": "Low"}
}
```

- 示例与教程
```json
{
  "task_id": "DOC_Tutorials",
  "user_instruction": "新增 CLI 教程，演示常见工作流",
  "context_assets": [{"path": "docs/cli/tutorials.md", "hint": "教程文档"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["选择两条高频工作流", "编写分步说明与代码片段", "加入故障排除", "链接至 README"]},
  "tool_plan": {"commands": ["npm run build"], "safety": "文档新增"},
  "output_patch": {"path": "docs/cli/tutorials.md", "snippet": "## Workflow A\n..."},
  "final_summary": "新增教程，降低学习曲线。",
  "metadata": {"task_type": "Documentation", "reasoning_type": "Spec/Design", "granularity": "Repo", "risk": "Low"}
}
```

### F. 评审与治理

- 风格/规范一致性
```json
{
  "task_id": "REVIEW_Style",
  "user_instruction": "统一 ESLint 配置并修复当前违规项",
  "context_assets": [{"path": "eslint.config.js", "hint": "规则定义"}],
  "cot_thought": {"thought": true, "template": "Step-by-Step", "steps": ["确认项目规则", "批量修复可自动修复项", "对复杂项给出建议", "集成到 CI"]},
  "tool_plan": {"commands": ["npm run lint:fix"], "safety": "自动化修复可回滚"},
  "output_patch": {"path": "eslint.config.js", "snippet": "rules: { ... }"},
  "final_summary": "统一代码风格并在 CI 扫描，减少偏差。",
  "metadata": {"task_type": "Code Review", "reasoning_type": "Spec", "granularity": "Repo", "risk": "Low"}
}
```

- 复杂度评估
```json
{
  "task_id": "REVIEW_Complexity",
  "user_instruction": "识别复杂度过高的函数并提出重构建议",
  "context_assets": [{"path": "packages/core/src/index.ts", "hint": "圈复杂度过高"}],
  "cot_thought": {"thought": true, "template": "Hypothesis-Evidence", "steps": ["度量复杂度", "列出高风险点", "提出拆分策略", "评估收益与风险"]},
  "tool_plan": {"commands": ["npx complexity-report packages/core/src/index.ts"], "safety": "只读分析"},
  "output_patch": {"path": "docs/架构/架构分析.md", "snippet": "建议拆分函数 X 为三段"},
  "final_summary": "完成复杂度报告并给出可执行重构建议。",
  "metadata": {"task_type": "Code Review", "reasoning_type": "Design/Algorithmic", "granularity": "Module", "risk": "Low"}
}
```

- 依赖与安全扫描
```json
{
  "task_id": "REVIEW_DependencySecurity",
  "user_instruction": "扫描第三方依赖安全风险并制定升级方案",
  "context_assets": [{"path": "package.json", "hint": "依赖列表"}],
  "cot_thought": {"thought": true, "template": "Decision Tree", "steps": ["识别高危依赖", "查阅修复版本", "评估破坏性变更", "制定分步升级计划"]},
  "tool_plan": {"commands": ["npm audit", "npx depcheck"], "safety": "不立即变更，先出报告"},
  "output_patch": {"path": "docs/工程化/工程化.md", "snippet": "依赖升级计划与风险说明"},
  "final_summary": "输出安全与依赖治理报告，指导后续升级。",
  "metadata": {"task_type": "Code Review", "reasoning_type": "Env/Security", "granularity": "Repo", "risk": "Medium"}
}
```

- 变更风险分级建议
```json
{
  "task_id": "REVIEW_ChangeRisk",
  "user_instruction": "为拟合并的 PR 进行风险分级并提出验证清单",
  "context_assets": [{"path": "docs/项目概览/代码合并与写入逻辑.md", "hint": "合并机制"}],
  "cot_thought": {"thought": true, "template": "Plan-Execute-Evaluate", "steps": ["按影响范围与复杂度分级", "制定验证清单", "必要的回滚策略", "验收标准与指标"]},
  "tool_plan": {"commands": ["git diff --stat"], "safety": "只读"},
  "output_patch": {"path": "docs/项目概览/GitHub提交快速开始指南.md", "snippet": "PR 风险分级与验证清单"},
  "final_summary": "形成风险分级与验收清单，规范合并流程。",
  "metadata": {"task_type": "Code Review", "reasoning_type": "Spec/Design", "granularity": "Repo", "risk": "Low"}
}
```

——
以上示例为可落地的最小训练单元，可用于：
- 作为 SFT/评测数据模板，校验 `cot_thought` 完整与可解释性；
- 驱动集成测试与契约测试，保障工程侧的一致消费；
- 在数据治理中作为采样与均衡的参考，覆盖多任务/多粒度维度。