# HuggingFace 模型运维与微调系统化方案

## 1. 目标与范围
- 建立面向 Gemini CLI 的 HuggingFace 模型运维、更新与微调端到端流程。
- 明确场景分类、工具变更点、数据与训练、发布与回滚、监控与成本控制。
- 输出可直接执行的步骤与命令，避免概念化描述。

## 2. 场景建立（任务分类）
- 代码生成与补全：`code-generation`、`code-completion`（函数实现、单测生成、Bug修复意图）。
- 总结与改写：`summarization`（PR 摘要、变更说明、文档摘要）。
- 问答与解释：`question-answering`（项目架构、工具用法、错误定位）。
- 嵌入向量：`text-embedding`（RAG、向量检索、相似度计算）。
- 翻译与分类：`translation`、`classification`（文档多语言、日志分类）。

## 3. 工具与架构变更（落地）
- 适配器与路由
  - 新增 `HuggingFaceAdapter`：`packages/core/src/adapters/huggingface-adapter.ts`（文本生成、嵌入）。
  - 新增 `ModelManager`：`packages/core/src/core/model-manager.ts`（主备链路、降级重试）。
  - 在 `contentGenerator` 集成路由：`packages/core/src/core/contentGenerator.ts`（`selectOptimalModel`）。
- 配置扩展
  - 扩展 `models.ts`：`packages/core/src/config/models.ts` 增加 `ExtendedModelConfig` 与 `DEFAULT_EXTENDED_CONFIG`。
  - 支持环境变量：`HUGGINGFACE_API_KEY`、`HUGGINGFACE_ENABLED`、各模型名与参数。
- 工具命令
  - 模型管理工具：`packages/core/src/tools/huggingface-model-tool.ts`（list/switch/status/configure）。
  - 性能监控工具：`packages/core/src/tools/model-performance-tool.ts`（记录指标、生成报告、比较）。
- 监控与告警
  - 轻量监控模块：`packages/core/src/monitoring/model-monitor.ts`（平均时延、成功率、错误率）。

## 4. 问题清单与修复策略
- 错误处理与重试：对 `GeminiChat` 的捕获-分类-重试-降级流程保持一致；在 HF 适配器内补充 API 错误包装与日志。
- 配置一致性：确保 CLI、Core、环境变量三者对齐，避免解析差异导致路由失效。
- 资源消耗：生成任务设置 `max_new_tokens`、`temperature`、`top_p`；对大模型调用增加限流与并发配置。
- 兼容性：保证现有 Gemini 功能不受影响，所有新逻辑通过 `enabled` 开关控制。
- 可观测性：为每次模型调用记录耗时、token 数、成功/失败，汇总到监控工具与日志。

## 5. 模型更新与微调流程
### 路线 A：直接更新（替换模型）
1. 在 HuggingFace Hub 创建/更新模型仓库（如 `org/project-codegen`）。
2. 推送新权重与模型卡：`README.md`、`config.json`、`tokenizer.json`、`model.safetensors`。
3. 在本项目 `.env` 更新：
   - `HF_TEXT_MODEL`、`HF_CODE_MODEL`、`HF_SUMMARY_MODEL`、`HF_EMBEDDING_MODEL`。
4. 在 `models.ts` 的默认配置或 CLI `loadExtendedConfig()` 中读取新模型名并启用。

### 路线 B：轻量微调（LoRA/PEFT）
1. 数据：构建指令-响应格式 JSONL（见第 6 节）。
2. 训练（示例命令，需在 Python 环境执行）：
   ```bash
   pip install transformers datasets accelerate peft trl bitsandbytes
   accelerate config
   accelerate launch train_sft_lora.py \
     --base_model "meta-llama/Llama-3.1-8B-Instruct" \
     --dataset "/data/sft.jsonl" \
     --output_dir "./outputs/lora" \
     --lora_r 16 --lora_alpha 32 --lora_dropout 0.1 \
     --per_device_train_batch_size 2 --gradient_accumulation_steps 8 \
     --learning_rate 2e-4 --num_train_epochs 3
   ```
3. 产物：`adapter_model.bin` 或合并权重后的 `model.safetensors`。
4. 发布至 HF Hub 并在项目中替换模型名。

### 路线 C：指令微调（SFT）
1. 数据格式：`{"instruction": "...", "input": "...", "output": "..."}`。
2. 训练同上，去掉 LoRA 参数；必要时使用 4bit/8bit 量化降低显存。
3. 发布与集成同路线 A。

## 6. 数据集准备（来源与清洗）
- 来源
  - 项目文档与工具计划：`docs/项目概览/*.md` 的 `cot_thought`、`tool_plan` 片段。
  - Bug 修复历史：`scripts/git/github-analyzer.sh` 导出 commit diff，构造“指令→修复”样本。
  - 交互日志：若有 CLI/扩展交互记录，提取问答对用于 QA 与 Summarization。
- 清洗规范
  - 去除敏感信息（凭据、访问令牌、内网域名）。
  - 统一 JSONL，每行一个样本；字段：`instruction/input/output/tags/source`。
  - 去重、截断超长样本（>8k tokens），标注任务类型标签。
- 切分与版本
  - `train/valid/test = 8/1/1`；为每次训练打 `dataset_vX.Y` 标签与快照。

## 7. 训练执行（度量与产物）
- 必要硬件：单机 24GB+ 显存或多卡；或使用 HF Spaces/Inference Endpoints。
- 关键超参：`lr/epochs/batch_size/max_seq_len/weight_decay/gradient_accumulation`。
- 监控指标：训练损失、验证集 Rouge/BLEU/CodeBLEU、推理耗时。
- 产物：权重、`config.json`、`tokenizer.json`、`model_card`。

## 8. 模型发布与版本管理
- 命名规范：`org/gemini-cli-{task}-{size}`，例如 `org/gemini-cli-codegen-7b`。
- 模型卡：包含用途、限制、训练数据来源、评测指标、变更日志。
- 版本号：`MAJOR.MINOR.PATCH` 对齐项目发布节奏；记录 LoRA 合并与量化配置。
- 回滚策略：保留上一个稳定版本，配置中支持 `fallbackChain` 自动降级。

## 9. 推理集成与路由策略
- 环境变量
  ```bash
  HUGGINGFACE_ENABLED=true
  HUGGINGFACE_API_KEY=hf_xxx
  HF_TEXT_MODEL=org/gemini-cli-textgen-7b
  HF_CODE_MODEL=org/gemini-cli-codegen-7b
  HF_SUMMARY_MODEL=facebook/bart-large-cnn
  HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
  ```
- 路由与降级
  - `selectOptimalModel(task, config, context)`：复杂推理走 Gemini；代码生成/摘要优先 HF。
  - `fallbackChain=['gemini','huggingface']`：主模型失败自动降级并记录告警。

## 10. 监控、告警与成本控制
- 监控维度：时延、成功率、错误分布、token 用量（近 1h/24h/7d）。
- 告警门限：`latency>5s`、`successRate<95%`、`errorRate>5%`。
- 成本优化：
  - 优先使用小体积/量化模型；对长文档启用摘要/分块。
  - 缓存高频请求；并发控制与退避重试。

## 11. 安全与合规
- 访问凭据：使用环境变量与 CI Secrets；禁止明文写入仓库。
- 数据治理：数据脱敏、用途限定、训练数据授权审查。
- 沙箱与权限：保持 CLI 工具的沙箱模式与权限控制（文件、网络、shell）。

## 12. 验收标准
- 功能：模型切换正常、降级生效、生成与嵌入可用、错误处理一致。
- 性能：P95 时延 < 5s，成功率 > 95%，内存增长 < 100MB。
- 兼容：现有 Gemini 能力不受影响，配置与 API 保持兼容。
- 文档：模型卡、训练报告、评测结果齐备，可复现实验。

## 13. 实施里程碑
- W1：适配器与路由、配置加载、工具命令落地。
- W2：数据集准备与首轮轻量微调，集成与评测。
- W3：监控与告警完善、成本优化、模型卡与发布规范完善。

## 14. 执行清单（关键命令）
- 安装依赖
  ```bash
  npm install @huggingface/inference @huggingface/hub
  export HUGGINGFACE_API_KEY=hf_xxx
  ```
- 本地验证（伪）
  ```ts
  // 使用 ModelManager 生成内容
  await modelManager.switchModel('huggingface');
  const res = await modelManager.generateContent({ prompt: 'Write a JS function' });
  ```
- 训练发布（Python 环境）
  ```bash
  # 训练
  accelerate launch train_sft_lora.py ...
  # 推送到 Hub
  huggingface-cli login
  huggingface-cli repo create org/gemini-cli-codegen-7b
  git lfs track "*.safetensors"
  git push
  ```

—— 以上方案覆盖场景分类、工具与配置变更、数据与训练、发布与监控全流程，可按章节逐步执行落地。