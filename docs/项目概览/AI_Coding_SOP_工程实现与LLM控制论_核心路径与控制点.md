# AI Coding SOP 工程实现与 LLM 控制论：核心路径与控制点

## 目标与适用范围
- 系统化、分层次阐述 AI Coding SOP 在工程侧的实现方式，以及在 LLM 中实现 COT（Chain-of-Thought）、推理与可控执行的机制。
- 以控制论为框架，提炼端到端业务变化的核心路径与控制点，指导架构落地与质量门控。

## 闭环总体模型（控制论视角）
- 期望（Setpoint）：需求目标、质量标准、成本/时延约束（来源：`AI_Coding_任务分解SOP体系_技术规范.md` 第1章/第5章）。
- 过程（Plant）：LLM + ToolChain + 代码库 + CI/CD + 运行环境。
- 传感器（Sensors）：遥测、日志、执行状态、测试结果、质量指标（`docs/telemetry.md`、`integration-tests.md`、CI 报告）。
- 控制器（Controller）：
  - 意图/规划控制器：需求解析、任务分解、依赖建模（`AI_Coding_任务分解SOP体系_技术规范.md` 第3.1）。
  - 模型/工具调度控制器：模型选择、降级链、工具编排（`implementation-guide.md`、`docs/core/tools-api.md`）。
  - 质量门控控制器：静态分析、测试、性能/安全门禁（`.github/workflows/ci.yml`、第5章门控）。
- 执行器（Actuators）：工具执行（文件、Web、Shell、MCP）、模型推理与生成（`docs/tools/*`、`docs/model/*`）。
- 反馈（Feedback）：执行结果结构化、错误格式化、度量回写、历史压缩与知识沉淀（`LLM返回数据处理逻辑.md`、`历史对话维护体系.md`）。
- 干扰（Disturbances）：幻觉、参数漂移、上下文丢失、外部接口异常、资源限制。

## 分层体系到工程实现的映射
- 战略层（标准/规范/目标）
  - 质量标准与门控阈值：在 CI 设置覆盖率、复杂度、重复率、安全阈值（`.github/workflows/ci.yml`）。
  - 规范入口与索引：`AI_Coding_任务分解SOP体系_技术规范.md`、`docs/index.md`、`项目概览/00.00_项目架构深度综述.md`。
- 战术层（计划/编排/策略）
  - 模型管理与降级：`implementation-guide.md` 中的模型管理器、降级链、环境变量（如 `MODEL_STRATEGY`）。
  - 工具注册与编排：`docs/core/tools-api.md`、各工具说明（`docs/tools/*.md`）。
  - 会话/流控与压缩：`会话闭环与工具调度体系.md`、`历史对话维护体系.md`（隔离 COT、压缩历史）。
- 操作层（生成/修改/测试/部署）
  - 生成/修改：`packages/core` 与 `packages/cli` 中的集成与命令入口；具体执行结果走工具契约。
  - 测试/验证：`integration-tests.md`、`vitest.config.ts`；在流水线触发质量门禁。
  - 部署/发布：`Dockerfile`、`docs/deployment.md`，结合门控通过后发布。
- 支撑层（历史/安全/异常/文档）
  - 历史维护与压缩：上下文重要信息优先保留、摘要替换、滑动窗口（`历史对话维护体系.md`）。
  - 错误/取消/确认：执行异常、用户取消、审批点（`会话闭环与工具调度体系.md`）。
  - 文档与知识：`docs/项目概览/*` 专题与索引；知识沉淀与模板复用。

## LLM 中的 COT/推理/控制实现
- COT 隔离与最小暴露原则
  - 结构化提示：区分“策略/COT域”“可见输出域”，将 COT 作为内部推理上下文，输出只暴露结论与步骤摘要（参考：`prompt核心分析框架.md`、`LLM提示词与工具调用深度分析.md`）。
  - 历史隔离：对 COT 内容进行分段存储与摘要压缩，避免上下文污染与泄露（`历史对话维护体系.md`）。
- 推理与工具耦合的受控执行
  - 工具契约与审批：工具参数 JSON Schema/类型契约，关键工具走审批模式（`docs/core/tools-api.md`、`工具参数结构化文档.md`）。
  - 结果结构化：统一 `Part/PartListUnion` 风格或统一响应结构，便于验证与二次处理（`LLM返回数据处理逻辑.md`）。
- 流式与资源控制
  - Token 预算控制与上下文压缩：限额→压缩→再生成；在长链路中动态截断不重要历史（`历史对话维护体系.md`）。
  - 流式输出：在 CLI/IDE 中展示进度，控制超时与重试策略（`docs/cli/index.md`、`docs/tools/troubleshooting.md`）。
- 模型选择与降级链
  - 策略维度：任务类型、复杂度、成本敏感、时延要求（`implementation-guide.md` 的策略映射）。
  - 容错：失败→降级到次优模型→记录事件并回写度量（同文档的 ModelManager/降级链）。

## 核心路径（从需求到收敛）
- 输入→意图识别→约束抽取→目标设定（Setpoint）
- 任务分解→DAG 依赖→质量检查点定义（Controllers 初始化）
- 模型选择→工具编排→执行计划（Actuators 配置）
- 执行→流式监控→结构化结果→错误格式化（Sensors 收集）
- 质量门控→自动化检查→评审→审计（闭环校正与门禁）
- 沉淀→历史摘要→指标回写→策略迭代（反馈与自适应）

## 控制点清单（工程与提示协同）
- 意图与任务分解控制点
  - 5W1H 强约束：What/Why/Who/When/Where/How 显式化，形成任务与验收标准（`AI_Coding_任务分解SOP体系_技术规范.md` 3.1）。
  - 依赖图与关键路径：DAG 检测循环/瓶颈；并行机会识别。
- 模型与推理控制点
  - 模型策略选择：`MODEL_STRATEGY` + 任务映射；复杂度/成本/时延三角权衡（`implementation-guide.md`）。
  - COT 隔离：提示域分层；输出域仅暴露“结论/摘要/必要证据”。
- 工具执行控制点
  - 参数契约校验：类型/范围/必填；审批模式（关键写操作先审后执行）。
  - 影响范围与回滚：副作用评估、原子提交、回滚计划绑定步骤。
- 质量门控控制点
  - 静态分析/测试/性能/安全四类门禁为强制条件；阈值从 CI 配置读取。
- 反馈与度量控制点
  - 指标采集：成功率、延迟、Token 使用、错误率；按模型/工具/任务维度汇总（`docs/telemetry.md`）。
  - 异常闭环：错误分类→根因分析→模板修订→策略更新。

## 门控与配置示例
```yaml
quality_gates:
  code_quality:
    coverage_threshold: 80%
    complexity_limit: 10
    duplication_limit: 3%
  security:
    high_severity_issues: 0
    medium_severity_issues: 5
  performance:
    regression_threshold: 5%
    response_time_limit: 200ms
  compliance:
    sop_adherence_rate: 95%
    documentation_completeness: 90%
```

```json
{
  "modelStrategy": {
    "primary": "auto",
    "taskMapping": {
      "code-generation": "cost-optimized",
      "complex-reasoning": "quality-optimized"
    },
    "fallbackChain": ["quality-optimized", "cost-optimized"]
  },
  "toolApproval": {
    "writeFile": "require-approval",
    "webFetch": "auto-with-scope",
    "shell": "restricted"
  },
  "retryPolicy": {
    "maxRetries": 2,
    "backoff": "exponential",
    "timeout": "60s"
  }
}
```

## 异常与恢复（控制环路）
- 幻觉/不一致：
  - 校验契约失败→触发缩小上下文的再生成；必要时切换到更稳健模型。
  - 证据要求：输出必须附带可验证来源或结构化引用。
- 工具失败/环境异常：
  - 重试与回退：指数退避；降级到替代工具或手动路径。
  - 回滚与审计：关键写入绑定回滚计划；操作留痕便于复盘。
- 上下文漂移/Token 超限：
  - 历史压缩与关键消息保留；动态阈值与摘要替换。

## 指标与优化旋钮（Knobs）
- 指标：成功率、平均延迟、总 Token、错误数、覆盖率、安全漏洞、性能回归、合规率。
- 旋钮：温度/TopP、MaxTokens、模型选择、任务并行度、重试与超时、审批级别、历史窗口大小。

## 落地步骤与检查清单
- 环境与策略：配置 `MODEL_STRATEGY`、API Keys、CI 门禁阈值。
- 提示与模板：应用 COT 隔离模板；为高风险工具定义审批点。
- 工具与契约：核对工具参数契约与范围；开启审计与影响评估。
- 测试与门控：接通静态分析、测试套件、性能与安全扫描；设定强制门禁。
- 遥测与回写：部署指标采集与告警；将度量回写至策略与模板。

## 索引与引用
- 闭环与落地：`AI_Coding_SOP闭环落地体系_架构与实施说明.md`
- 体系规范：`AI_Coding_任务分解SOP体系_技术规范.md`
- 模型与实现：`implementation-guide.md`
- 工具与接口：`docs/core/tools-api.md`、`docs/tools/index.md`
- 会话与历史：`会话闭环与工具调度体系.md`、`历史对话维护体系.md`
- 返回数据与结构：`LLM返回数据处理逻辑.md`、`工具参数结构化文档.md`
- 度量与CI：`docs/telemetry.md`、`.github/workflows/ci.yml`