# COT阶段工具指导与步骤规划（Prompt策略・流程架构・示例）

目标：让LLM在思维链（Chain-of-Thought, COT）阶段即明确“用什么工具、以什么顺序、在何种条件下执行”，从而提升端到端任务成功率与工程可复用性。

## 0. 总体原则
- 早期计划：在COT前半段就输出工具清单与步骤（tool-first planning）。
- 可执行合同：统一 `tool_plan` JSON 结构，具备可回放与失败回退。
- 门控与安全：工具调用必须满足条件门控（gating）与幂等要求，避免破坏性操作。
- 成本控制：根据任务复杂度动态启停COT与工具链，优先低成本查询类工具。

## 1. Prompt策略（让模型在COT中规划工具）
- 指令要点：
  - 明确要求在 `cot_thought` 中先列出“工具与步骤”，再给出推理细节。
  - 约束输出统一合同：`cot_thought`（`thought: true`）与 `tool_plan` 并置；禁止直接执行。
  - 强化可验证性：每一步写明“目的/输入/预期输出/成功判定/失败回退”。
- Few-shot模板片段：
```text
你是代码助手。先给出工具计划，再进行思维链。输出JSON：
- cot_thought.thought=true，列出 step_1..n（含目的/输入/成功判定）
- tool_plan.tools=[{name,args,when,expect,rollback}],auto_execute=false
- final_summary 概述影响
```
- 风格控制：原子化短句、避免夸饰；禁止无依据猜测；引用代码片段需给出路径与行信息。

## 2. 统一合同（tool_plan）
```json
{
  "tool_plan": {
    "tools": [
      {
        "name": "search_codebase",
        "args": {"information_request": "find usage of X", "target_directories": ["/root/gemini-cli/packages/core/src"]},
        "when": "未找到明确入口或调用栈时",
        "expect": "返回含路径/行的候选列表",
        "rollback": "若为空则放宽目录或改用正则搜索"
      },
      {
        "name": "update_file",
        "args": {"file_path": "...", "old_str": "...", "new_str": "..."},
        "when": "已定位唯一变更点且可安全替换",
        "expect": "首次匹配成功替换，不影响其他逻辑",
        "rollback": "若失败，改用 edit_file_fast_apply 并人工校对"
      }
    ],
    "auto_execute": false
  }
}
```

## 3. 流程架构（从COT到工具调度）
- 阶段划分：
  1) 解析响应：收集 `cot_thought` + `tool_plan`，校验 JSON Schema。
  2) 门控评估：检查 `when` 条件、幂等性与安全策略；仅执行通过项。
  3) 执行序列：按步骤依赖顺序执行，失败则根据 `rollback` 回退与重试。
  4) 记录与回放：写入执行日志与补丁，便于审计与重跑。
- 失败策略：
  - 软失败回退（扩大搜索范围、改工具参数）；
  - 硬失败中止（权限/安全违规），输出原因并请求人审。

## 4. 示例（Bug修复）
```json
{
  "user_instruction": "修复CLI启动时配置未加载的问题",
  "context_assets": {"env": {"runtime": "nodejs@18"}},
  "cot_thought": {
    "thought": true,
    "steps": [
      "计划工具：先搜索配置加载函数，再查看调用时序",
      "搜索：在 packages/cli/src 中查找 loadConfig",
      "验证：阅读入口 index.ts，确认是否在启动前调用",
      "修改：若缺失，插入调用并处理错误",
      "测试：运行本地启动脚本，验证加载成功"
    ]
  },
  "tool_plan": {
    "tools": [
      {"name": "search_codebase", "args": {"information_request": "loadConfig definition and usage", "target_directories": ["/root/gemini-cli/packages/cli/src"]}, "when": "未定位配置加载入口", "expect": "找到定义与调用", "rollback": "扩大到 packages/core/src"},
      {"name": "view_files", "args": {"files": [{"file_path": "/root/gemini-cli/packages/cli/src/index.ts", "start_line_one_indexed": 1, "end_line_one_indexed_inclusive": 200}]} , "when": "入口文件已定位", "expect": "确认调用时序", "rollback": "扩大行范围至400"},
      {"name": "edit_file_fast_apply", "args": {"file_path": "/root/gemini-cli/packages/cli/src/index.ts", "content": "// ... existing code ...\nawait loadConfig();\n// ... existing code ..."}, "when": "缺失调用且可安全插入", "expect": "编译通过", "rollback": "改为在初始化函数中调用"}
    ],
    "auto_execute": false
  },
  "final_summary": "在 CLI 入口补充 loadConfig 调用并通过本地测试"
}
```

## 5. 评估与治理
- 合同合规率：`JSON Schema` 校验、字段完整性与条件门控正确率。
- 执行成功率：工具执行成功比、回退触发次数、最终任务达成率。
- 安全与幂等：无破坏性改动、权限合规、可重复回放。
- 成本控制：平均token与步骤数、工具调用时间与失败占比。

## 6. 集成建议
- 在 `ci.yml` 增加合同校验与工具计划静态检查。
- 结合 `docs/项目概览/COT返回数据处理与工程实现.md` 的处理管线实施自动执行与回退。
- 提供 Few-shot 模板与输出示例，作为提示工程基线。

## 7. 行动清单
- 定义并落盘统一 `tool_plan` Schema 与校验。
- 将模板纳入提示工程，强制“先计划工具再思维链”。
- 执行日志与补丁回放机制上线，闭环评估工具指导效果。