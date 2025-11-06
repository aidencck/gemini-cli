# COT数据集构建方法论（系统化・结构化・分层）

面向工程落地与模型训练，本文系统阐述如何构建高质量的 Chain-of-Thought（COT）数据集：是否需要“穷举所有数据”、如何体系化组织、结构化标注、分层覆盖与质量治理，并给出可直接复用的 Schema、示例与流水线建议。

## 0. 基本原则与核心结论
- 不需要穷举所有数据：追求“代表性与覆盖度”而非全量枚举。聚焦任务分层与多样性（任务类型×领域×技能×难度×风格），通过分层抽样达到充分覆盖。
- 系统化分层组织是关键：建议采用“任务类型→领域→技能维度→难度→风格”的五维分类体系，保障数据均衡。
- 统一结构化 Schema：强制统一 JSON 合同，隔离 `cot_thought`（`thought: true`），保证训练与推理一致性。
- 质量优先于规模：建立自动化审查与人审抽检闭环（正确性、可验证性、冗余与泄露治理）。
- 训练友好与工程可复用：面向 SFT/DPO/RLHF，兼顾推理风格一致、工具计划可执行、输出可评估。

## 1. 五维分类与分层覆盖
- 任务类型：Bug修复 / 新功能开发 / 重构优化 / 测试质量 / 文档注释 / 评审治理
- 领域：Web前端 / 后端服务 / 数据工程 / DevOps & 云 / 算法 & 数学 / 通用逻辑
- 技能维度：代码理解、问题定位、规划拆解、工具编排、可验证推理、风险控制
- 难度等级：L0（入门）～ L4（复杂长链路）
- 风格：直接指令 / 对话式 / 结构化需求 / 带上下文资产（代码片段、日志、配置）

建议采用分层抽样（stratified sampling）与课程式难度递进（curriculum），并针对长尾任务进行定向补齐。

## 2. 数据来源与合规
- 来源：开源仓库（真实Issue/PR/变更）、公开推理数据集、项目历史任务、LLM合成（人审）
- 许可：遵循数据集许可证；企业内数据需脱敏与授权；避免敏感信息泄露
- 去污染（decontamination）：与评测集、训练语料交叉比对，移除重叠或答案泄露样本

## 3. 标注 Schema（统一合同）
推荐统一 JSON 结构，隔离 COT 与执行计划，确保训练与推理一致：

```json
{
  "user_instruction": "string",
  "context_assets": {
    "files": [
      { "path": "string", "snippet": "string" }
    ],
    "env": { "runtime": "nodejs@18", "os": "linux" },
    "constraints": ["no_external_libs", "style_consistency"]
  },
  "cot_thought": {
    "thought": true,
    "steps": [
      "step_1: 问题判定与范围界定",
      "step_2: 关键线索提取与假设",
      "step_3: 验证与反例",
      "step_4: 方案选择与风险",
      "step_5: 输出结构组织"
    ]
  },
  "tool_plan": {
    "tools": [
      { "name": "search_codebase", "args": { "information_request": "find usage of X" } },
      { "name": "update_file", "args": { "file_path": "...", "old_str": "...", "new_str": "..." } }
    ],
    "auto_execute": false
  },
  "output_patch": {
    "changes": [
      { "file": "path/to/file", "diff": "- old\n+ new" }
    ]
  },
  "final_summary": "对变更与影响的结构化总结",
  "metadata": {
    "task_type": "bug_fixing",
    "domain": "web_frontend",
    "skills": ["code_understanding", "verification"],
    "difficulty": "L2",
    "style": "structured",
    "source": "curated_open_source"
  },
  "evaluation": {
    "checks": ["编译通过", "单测通过", "行为一致"],
    "expected_metrics": {"tests_passed": true}
  }
}
```

要点：
- 强制 `cot_thought.thought: true`，在训练中明确标记为思维链，推理时可选择隐藏或压缩。
- `tool_plan` 与 `output_patch` 面向工程复用，支持自动化执行与可回放性。
- `metadata` 提供分层索引维度，支撑抽样均衡与后续分析。

### JSON Schema 简版（用于校验）
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["user_instruction", "cot_thought", "final_summary", "metadata"],
  "properties": {
    "user_instruction": {"type": "string", "minLength": 1},
    "context_assets": {"type": "object"},
    "cot_thought": {
      "type": "object",
      "required": ["thought", "steps"],
      "properties": {
        "thought": {"type": "boolean"},
        "steps": {"type": "array", "items": {"type": "string"}, "minItems": 2}
      }
    },
    "tool_plan": {"type": "object"},
    "output_patch": {"type": "object"},
    "final_summary": {"type": "string"},
    "metadata": {"type": "object"},
    "evaluation": {"type": "object"}
  }
}
```

## 4. 采样与覆盖策略
- 分层抽样：按任务类型/领域/难度配额采样，保证均衡
- 课程式递进：L0→L4逐级扩容，训练稳定性与推理可控
- 长尾补齐：针对稀有模式（复杂日志、跨文件变更、工具编排）定向生成与人审
- 风格多样化：指令式、对话式、结构化表格、带上下文资产，提升鲁棒性
- 去重与语义聚类：MinHash/SimHash/向量相似度，控制近重复与模板化风险

## 5. COT风格与质量控制
- 原子化思维步：短句、单步单义，便于对齐与压缩
- 可验证性：每步包含“依据/验证/风险”；引入反例思考
- 溯源与引用：显式标注引用的代码片段或日志来源
- 自一致性与剪枝：多路生成投票（self-consistency），保留最一致思路；删除无效冗余
- 安全与合规：脱敏、许可检查、输出过滤

## 6. 数据清洗与压缩
- 正规化：统一编码、空白、标点与语言风格
- 去噪：移除无依据的瞎猜、无用长段解释
- Token预算：控制 `cot_thought` 长度；过长则摘要化为关键步骤
- 结构对齐：字段完整性、Schema校验、链接有效性

## 7. 数据集切分与版本治理
- 切分：train/dev/test 按任务维度分层切分，避免泄露
- 版本：语义化版本（如 `cot-v1.3.0`），维护 Dataset Card（来源、规模、覆盖、限制）
- 追踪：样本ID与来源路径、生成/审查者、修改历史

## 8. 规模化生成与审查流水线
- 引导生成：Few-shot模板 + 风格约束 + 统一Schema输出
- 验证：JSON Schema校验、自动编译/单测、自定义静态检查
- 抽检：按批次与维度配额人审（≥5%）
- 迭代：基于错误分布与评测反馈做定向增补

### 验证脚本伪代码
```python
# validate_cot_sample.py
import jsonschema, json
from checks import run_build, run_tests, semantic_dedup

SCHEMA = json.load(open('schema/cot_dataset.schema.json'))

def validate(sample):
    jsonschema.validate(sample, SCHEMA)
    assert sample['cot_thought']['thought'] is True
    semantic_dedup(sample)
    if 'output_patch' in sample:
        run_build(sample)
        run_tests(sample)

```

## 9. 训练适配建议
- SFT：以高质量COT样本为主，保持风格一致与可验证
- DPO：构造正/负样本对（正确链 vs 错误链/不充分链）
- RLHF：将“可验证性/工具成功率/测试通过率”作为奖励信号
- 推理策略：任务复杂时启用 COT；对易任务禁用或压缩 COT 以控成本

## 10. 目录结构与集成建议
- `datasets/cot/`：原始样本（JSONL）与切分集（train/dev/test）
- `schema/cot_dataset.schema.json`：合同校验文件
- `scripts/validate_cot_sample.py`：批量校验与抽检脚本
- `docs/项目概览/`：方法论与治理规范

## 11. 示例样本（三类任务）

### A. Bug Fixing（L2, Web前端）
```json
{
  "user_instruction": "修复按钮点击无效，期望触发 onSubmit()",
  "context_assets": {
    "files": [{"path": "src/components/Form.tsx", "snippet": "<button onClick={handleClick}>Submit</button>"}],
    "env": {"runtime": "nodejs@18"}
  },
  "cot_thought": {
    "thought": true,
    "steps": [
      "定位：按钮调用的是 handleClick 而非 onSubmit",
      "假设：handleClick 未调用 onSubmit，或阻止了默认行为",
      "验证：查看 handleClick 实现，确认缺少 onSubmit() 调用",
      "方案：将 onClick 指向 onSubmit，或在 handleClick 内显式调用",
      "风险：需确认表单校验与事件传播一致"
    ]
  },
  "tool_plan": {"tools": [{"name": "update_file", "args": {"file_path": "src/components/Form.tsx", "old_str": "onClick={handleClick}", "new_str": "onClick={onSubmit}"}}]},
  "output_patch": {"changes": [{"file": "src/components/Form.tsx", "diff": "- onClick={handleClick}\n+ onClick={onSubmit}"}]},
  "final_summary": "将按钮 onClick 改为调用 onSubmit，行为与预期对齐",
  "metadata": {"task_type": "bug_fixing", "domain": "web_frontend", "difficulty": "L2"},
  "evaluation": {"checks": ["交互可用", "无控制台错误"]}
}
```

### B. New Feature（L2, 后端）
```json
{
  "user_instruction": "为订单接口增加分页参数 page/size，并返回总数",
  "context_assets": {"files": [{"path": "src/api/orders.ts", "snippet": "export async function listOrders() { /* ... */ }"}]},
  "cot_thought": {
    "thought": true,
    "steps": [
      "需求拆解：新增输入参数 page/size，响应含 total",
      "接口改造：函数签名与查询语句支持分页",
      "返回结构：{items, total, page, size}",
      "测试：边界值与默认值覆盖"
    ]
  },
  "tool_plan": {"tools": [{"name": "update_file", "args": {"file_path": "src/api/orders.ts", "old_str": "listOrders()", "new_str": "listOrders(page:number=1,size:number=20)"}}]},
  "output_patch": {"changes": [{"file": "src/api/orders.ts", "diff": "+ export async function listOrders(page=1,size=20){ /* with LIMIT/OFFSET */ }"}]},
  "final_summary": "订单查询支持分页与总数返回，接口契约明确",
  "metadata": {"task_type": "new_feature", "domain": "backend", "difficulty": "L2"}
}
```

### C. Testing（L1, 单测）
```json
{
  "user_instruction": "为 utils/sum.ts 编写单测，覆盖负数与边界",
  "context_assets": {"files": [{"path": "src/utils/sum.ts", "snippet": "export const sum=(a,b)=>a+b"}]},
  "cot_thought": {
    "thought": true,
    "steps": [
      "识别函数行为与边界：负数、零、大数",
      "编写断言：结果类型与值正确",
      "运行测试：通过且无副作用"
    ]
  },
  "tool_plan": {"tools": [{"name": "update_file", "args": {"file_path": "test/sum.test.ts", "old_str": "", "new_str": "import {sum} from '../src/utils/sum';\n test('sum negatives',()=>{expect(sum(-1,-2)).toBe(-3)})"}}]},
  "final_summary": "单测覆盖负数与基本场景，提升行为稳定性",
  "metadata": {"task_type": "testing", "domain": "general", "difficulty": "L1"}
}
```

## 12. 是否需要“穷举所有数据”？
- 不需要。应采用“代表性 + 系统覆盖 + 长尾补齐”的策略：
  - 代表性：高频真实任务模式（类型/领域/技能/难度）
  - 系统覆盖：分层配额，确保均衡与泛化
  - 长尾补齐：针对稀有/复杂模式定向生成与人审
- 成本与效益：在 70–85% 覆盖度下即可显著提升推理；余下通过迭代增补与在线反馈闭环优化。

## 13. 行动清单（落地）
- 建立五维分类与分层配额表，明确目标分布
- 定义统一 JSON Schema 与校验脚本，接入 CI
- 启动小规模试产（每维至少 50–100 样本），人审抽检≥5%
- 评测驱动迭代：基于错误类型定向增补与清洗
- 建立版本治理与 Dataset Card，持续更新

—— 以上方法可直接在项目中落地，配合 `docs/项目概览/` 既有文档（如 COT返回数据处理与工程实现.md）实现工程化闭环。