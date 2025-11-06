# Gemini CLI - HuggingFace 集成实施指南

## 🎯 实施概览

本指南提供了将 HuggingFace 模型集成到 Gemini CLI 项目中的详细步骤和代码实现。

## 📋 前置条件

### 环境要求
- Node.js >= 18.0.0
- TypeScript >= 4.9.0
- 足够的磁盘空间用于模型缓存 (建议 10GB+)

### 依赖安装
```bash
# 核心 HuggingFace 依赖
npm install @huggingface/inference @huggingface/hub
npm install @xenova/transformers  # 浏览器端 transformers

# 可选：本地推理依赖
npm install onnxruntime-node
npm install sharp  # 图像处理

# 开发依赖
npm install --save-dev @types/node
```

## 🏗️ 第一阶段：核心适配器实现

### 1.1 创建 HuggingFace 适配器基础结构

```typescript
// packages/core/src/adapters/huggingface-adapter.ts
import { HfInference } from '@huggingface/inference';
import { ModelAdapter, ContentRequest, ContentResponse, EmbeddingRequest } from '../types/model-types.js';

export interface HuggingFaceConfig {
  apiKey?: string;
  endpoint?: string;
  models: {
    textGeneration: string;
    codeGeneration: string;
    embedding: string;
    summarization: string;
  };
  parameters: {
    maxTokens: number;
    temperature: number;
    topP: number;
    repetitionPenalty: number;
  };
}

export class HuggingFaceAdapter implements ModelAdapter {
  readonly name = 'huggingface';
  readonly type = 'huggingface' as const;
  
  private client: HfInference;
  private config: HuggingFaceConfig;
  
  constructor(config: HuggingFaceConfig) {
    this.config = config;
    this.client = new HfInference(config.apiKey);
  }

  get capabilities(): string[] {
    return [
      'text-generation',
      'code-generation', 
      'text-embedding',
      'summarization',
      'question-answering'
    ];
  }

  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    try {
      const modelName = this.selectModelForTask(request.task);
      const startTime = Date.now();
      
      const response = await this.client.textGeneration({
        model: modelName,
        inputs: request.prompt,
        parameters: {
          max_new_tokens: request.maxTokens || this.config.parameters.maxTokens,
          temperature: request.temperature || this.config.parameters.temperature,
          top_p: request.topP || this.config.parameters.topP,
          repetition_penalty: this.config.parameters.repetitionPenalty,
          return_full_text: false,
        },
      });

      const duration = Date.now() - startTime;
      
      return {
        content: response.generated_text,
        usage: {
          inputTokens: this.estimateTokens(request.prompt),
          outputTokens: this.estimateTokens(response.generated_text),
          totalTokens: this.estimateTokens(request.prompt + response.generated_text),
        },
        model: modelName,
        duration,
        success: true,
      };
    } catch (error) {
      return this.handleError(error, request);
    }
  }

  async embedContent(request: EmbeddingRequest): Promise<number[]> {
    try {
      const response = await this.client.featureExtraction({
        model: this.config.models.embedding,
        inputs: request.text,
      });
      
      // HuggingFace 返回的可能是多维数组，需要处理
      return Array.isArray(response[0]) ? response[0] : response;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  async countTokens(text: string): Promise<number> {
    // 简单的 token 估算，实际项目中应使用对应模型的 tokenizer
    return Math.ceil(text.length / 4);
  }

  private selectModelForTask(task?: string): string {
    switch (task) {
      case 'code-generation':
      case 'code-completion':
        return this.config.models.codeGeneration;
      case 'summarization':
        return this.config.models.summarization;
      default:
        return this.config.models.textGeneration;
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private handleError(error: any, request: ContentRequest): ContentResponse {
    console.error('HuggingFace API Error:', error);
    
    return {
      content: '',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'error',
      duration: 0,
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        type: error.name || 'HuggingFaceError',
        code: error.status || 500,
      },
    };
  }
}
```

### 1.2 扩展类型定义

```typescript
// packages/core/src/types/model-types.ts
export interface ModelAdapter {
  readonly name: string;
  readonly type: 'gemini' | 'huggingface' | 'openai' | 'local';
  readonly capabilities: string[];
  
  generateContent(request: ContentRequest): Promise<ContentResponse>;
  embedContent(request: EmbeddingRequest): Promise<number[]>;
  countTokens(text: string): Promise<number>;
}

export interface ContentRequest {
  prompt: string;
  task?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  context?: string[];
  systemPrompt?: string;
}

export interface ContentResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  duration: number;
  success: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type TaskType = 
  | 'text-generation'
  | 'code-generation'
  | 'code-completion'
  | 'summarization'
  | 'question-answering'
  | 'translation'
  | 'classification';
```

### 1.3 模型管理器实现

```typescript
// packages/core/src/core/model-manager.ts
import { ModelAdapter, ContentRequest, ContentResponse } from '../types/model-types.js';
import { HuggingFaceAdapter, HuggingFaceConfig } from '../adapters/huggingface-adapter.js';
import { GeminiAdapter } from '../adapters/gemini-adapter.js';

export interface ModelManagerConfig {
  defaultModel: string;
  fallbackChain: string[];
  huggingface?: HuggingFaceConfig;
  gemini?: {
    apiKey: string;
    models: {
      primary: string;
      flash: string;
      embedding: string;
    };
  };
}

export class ModelManager {
  private adapters: Map<string, ModelAdapter> = new Map();
  private config: ModelManagerConfig;
  private activeModel: string;

  constructor(config: ModelManagerConfig) {
    this.config = config;
    this.activeModel = config.defaultModel;
    this.initializeAdapters();
  }

  private async initializeAdapters(): Promise<void> {
    // 初始化 HuggingFace 适配器
    if (this.config.huggingface) {
      const hfAdapter = new HuggingFaceAdapter(this.config.huggingface);
      this.adapters.set('huggingface', hfAdapter);
    }

    // 初始化 Gemini 适配器 (保持现有功能)
    if (this.config.gemini) {
      const geminiAdapter = new GeminiAdapter(this.config.gemini);
      this.adapters.set('gemini', geminiAdapter);
    }
  }

  async generateContent(request: ContentRequest): Promise<ContentResponse> {
    const adapter = this.getAdapter(this.activeModel);
    
    try {
      return await adapter.generateContent(request);
    } catch (error) {
      // 尝试降级到备用模型
      return await this.tryFallback(request, error);
    }
  }

  async switchModel(modelName: string): Promise<boolean> {
    if (this.adapters.has(modelName)) {
      this.activeModel = modelName;
      return true;
    }
    return false;
  }

  getAvailableModels(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAdapter(modelName: string): ModelAdapter {
    const adapter = this.adapters.get(modelName);
    if (!adapter) {
      throw new Error(`Model adapter '${modelName}' not found`);
    }
    return adapter;
  }

  private async tryFallback(request: ContentRequest, originalError: any): Promise<ContentResponse> {
    for (const fallbackModel of this.config.fallbackChain) {
      if (fallbackModel === this.activeModel) continue;
      
      try {
        const adapter = this.getAdapter(fallbackModel);
        const response = await adapter.generateContent(request);
        
        // 记录降级事件
        console.warn(`Fallback to ${fallbackModel} due to error:`, originalError.message);
        
        return response;
      } catch (fallbackError) {
        console.warn(`Fallback model ${fallbackModel} also failed:`, fallbackError.message);
        continue;
      }
    }
    
    // 所有模型都失败了
    throw new Error(`All models failed. Original error: ${originalError.message}`);
  }
}
```

## 🔧 第二阶段：配置系统集成

### 2.1 扩展现有配置

```typescript
// packages/core/src/config/models.ts (扩展现有文件)

// 在现有导出后添加
export interface ExtendedModelConfig {
  // 保持现有 Gemini 配置
  gemini: {
    primary: string;
    flash: string;
    embedding: string;
  };
  
  // 新增 HuggingFace 配置
  huggingface: {
    enabled: boolean;
    apiKey?: string;
    models: {
      textGeneration: string;
      codeGeneration: string;
      embedding: string;
      summarization: string;
    };
    parameters: {
      maxTokens: number;
      temperature: number;
      topP: number;
      repetitionPenalty: number;
    };
  };
  
  // 模型选择策略
  strategy: {
    primary: string;  // 'gemini' | 'huggingface'
    fallback: string[];
    taskMapping: Record<string, string>;
  };
}

export const DEFAULT_EXTENDED_CONFIG: ExtendedModelConfig = {
  gemini: {
    primary: DEFAULT_GEMINI_MODEL,
    flash: DEFAULT_GEMINI_FLASH_MODEL,
    embedding: DEFAULT_GEMINI_EMBEDDING_MODEL,
  },
  
  huggingface: {
    enabled: false,
    models: {
      textGeneration: 'microsoft/DialoGPT-medium',
      codeGeneration: 'codellama/CodeLlama-7b-Instruct-hf',
      embedding: 'sentence-transformers/all-MiniLM-L6-v2',
      summarization: 'facebook/bart-large-cnn',
    },
    parameters: {
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
    },
  },
  
  strategy: {
    primary: 'gemini',
    fallback: ['gemini', 'huggingface'],
    taskMapping: {
      'code-generation': 'huggingface',
      'summarization': 'huggingface',
      'complex-reasoning': 'gemini',
      'simple-qa': 'gemini',
    },
  },
};

/**
 * 智能模型选择函数
 */
export function selectOptimalModel(
  task: string, 
  config: ExtendedModelConfig,
  context?: {
    complexity?: 'low' | 'medium' | 'high';
    costSensitive?: boolean;
    speedRequired?: boolean;
  }
): string {
  
  // 检查任务特定映射
  if (config.strategy.taskMapping[task]) {
    return config.strategy.taskMapping[task];
  }
  
  // 基于上下文选择
  if (context) {
    if (context.speedRequired && config.huggingface.enabled) {
      return 'huggingface';
    }
    
    if (context.complexity === 'high') {
      return 'gemini';
    }
    
    if (context.costSensitive && config.huggingface.enabled) {
      return 'huggingface';
    }
  }
  
  return config.strategy.primary;
}
```

### 2.2 更新内容生成器

```typescript
// packages/core/src/core/contentGenerator.ts (修改现有文件)

// 在现有导入后添加
import { ModelManager, ModelManagerConfig } from './model-manager.js';
import { ExtendedModelConfig, selectOptimalModel } from '../config/models.js';

export class ContentGenerator {
  // 保持现有属性...
  private modelManager: ModelManager;
  private extendedConfig: ExtendedModelConfig;

  constructor(config: ContentGeneratorConfig) {
    // 保持现有初始化...
    
    // 初始化扩展配置
    this.extendedConfig = this.loadExtendedConfig();
    
    // 初始化模型管理器
    this.modelManager = new ModelManager({
      defaultModel: this.extendedConfig.strategy.primary,
      fallbackChain: this.extendedConfig.strategy.fallback,
      huggingface: this.extendedConfig.huggingface.enabled 
        ? this.extendedConfig.huggingface 
        : undefined,
      gemini: {
        apiKey: this.apiKey,
        models: this.extendedConfig.gemini,
      },
    });
  }

  async generateContent(
    request: GenerateContentRequest,
    context?: {
      task?: string;
      complexity?: 'low' | 'medium' | 'high';
      costSensitive?: boolean;
      speedRequired?: boolean;
    }
  ): Promise<GenerateContentResponse> {
    
    // 选择最优模型
    const selectedModel = selectOptimalModel(
      context?.task || 'text-generation',
      this.extendedConfig,
      context
    );
    
    // 切换到选定的模型
    await this.modelManager.switchModel(selectedModel);
    
    // 转换请求格式
    const modelRequest = this.convertToModelRequest(request, context);
    
    try {
      // 使用模型管理器生成内容
      const response = await this.modelManager.generateContent(modelRequest);
      
      // 转换响应格式以保持兼容性
      return this.convertToGenerateContentResponse(response);
      
    } catch (error) {
      // 记录错误并尝试原有的 Gemini 方式作为最后的降级
      console.error('Model generation failed, falling back to original Gemini:', error);
      return await this.generateContentOriginal(request);
    }
  }

  private convertToModelRequest(
    request: GenerateContentRequest,
    context?: any
  ): ContentRequest {
    // 将现有的 GenerateContentRequest 转换为新的 ContentRequest 格式
    return {
      prompt: this.extractPromptFromRequest(request),
      task: context?.task,
      maxTokens: request.generationConfig?.maxOutputTokens,
      temperature: request.generationConfig?.temperature,
      topP: request.generationConfig?.topP,
      systemPrompt: this.extractSystemPrompt(request),
    };
  }

  private convertToGenerateContentResponse(
    response: ContentResponse
  ): GenerateContentResponse {
    // 将新的 ContentResponse 转换回现有的 GenerateContentResponse 格式
    return {
      response: {
        candidates: [{
          content: {
            parts: [{ text: response.content }],
            role: 'model',
          },
          finishReason: response.success ? 'STOP' : 'ERROR',
        }],
        usageMetadata: {
          promptTokenCount: response.usage.inputTokens,
          candidatesTokenCount: response.usage.outputTokens,
          totalTokenCount: response.usage.totalTokens,
        },
      },
    };
  }

  // 保持原有方法作为降级选项
  private async generateContentOriginal(
    request: GenerateContentRequest
  ): Promise<GenerateContentResponse> {
    // 调用原有的 generateContent 实现
    // ... 现有代码 ...
  }

  private loadExtendedConfig(): ExtendedModelConfig {
    // 从环境变量或配置文件加载扩展配置
    const config = { ...DEFAULT_EXTENDED_CONFIG };
    
    // 从环境变量覆盖配置
    if (process.env.HUGGINGFACE_API_KEY) {
      config.huggingface.apiKey = process.env.HUGGINGFACE_API_KEY;
      config.huggingface.enabled = true;
    }
    
    if (process.env.MODEL_STRATEGY) {
      config.strategy.primary = process.env.MODEL_STRATEGY as any;
    }
    
    return config;
  }
}
```

## 🛠️ 第三阶段：工具系统集成

### 3.1 HuggingFace 模型管理工具

```typescript
// packages/core/src/tools/huggingface-model-tool.ts
import { Tool, ToolResult } from './tool.js';
import { ModelManager } from '../core/model-manager.js';

export interface HuggingFaceModelToolParams {
  action: 'list' | 'switch' | 'status' | 'configure';
  model?: string;
  parameters?: Record<string, any>;
}

export class HuggingFaceModelTool implements Tool {
  name = 'huggingface_model';
  description = 'Manage HuggingFace models - list available models, switch active model, check status, or configure parameters';
  
  constructor(private modelManager: ModelManager) {}

  async execute(params: HuggingFaceModelToolParams): Promise<ToolResult> {
    try {
      switch (params.action) {
        case 'list':
          return await this.listModels();
        case 'switch':
          return await this.switchModel(params.model!);
        case 'status':
          return await this.getStatus();
        case 'configure':
          return await this.configureModel(params.model!, params.parameters!);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      return {
        success: false,
        content: `Error: ${error.message}`,
      };
    }
  }

  private async listModels(): Promise<ToolResult> {
    const models = this.modelManager.getAvailableModels();
    const modelInfo = await Promise.all(
      models.map(async (name) => {
        const adapter = this.modelManager.getAdapter(name);
        return {
          name,
          type: adapter.type,
          capabilities: adapter.capabilities,
        };
      })
    );

    return {
      success: true,
      content: `Available models:\n${modelInfo
        .map(m => `- ${m.name} (${m.type}): ${m.capabilities.join(', ')}`)
        .join('\n')}`,
      metadata: { models: modelInfo },
    };
  }

  private async switchModel(modelName: string): Promise<ToolResult> {
    const success = await this.modelManager.switchModel(modelName);
    
    if (success) {
      return {
        success: true,
        content: `Successfully switched to model: ${modelName}`,
      };
    } else {
      return {
        success: false,
        content: `Failed to switch to model: ${modelName}. Model not available.`,
      };
    }
  }

  private async getStatus(): Promise<ToolResult> {
    const models = this.modelManager.getAvailableModels();
    // 这里需要扩展 ModelManager 来跟踪当前活动模型
    
    return {
      success: true,
      content: `Model Status:\n- Available models: ${models.length}\n- Models: ${models.join(', ')}`,
      metadata: { availableModels: models },
    };
  }

  private async configureModel(modelName: string, parameters: Record<string, any>): Promise<ToolResult> {
    // 这里需要实现模型参数配置功能
    return {
      success: true,
      content: `Model ${modelName} configured with parameters: ${JSON.stringify(parameters, null, 2)}`,
    };
  }
}
```

### 3.2 模型性能监控工具

```typescript
// packages/core/src/tools/model-performance-tool.ts
import { Tool, ToolResult } from './tool.js';

export interface ModelMetrics {
  modelName: string;
  requestCount: number;
  averageLatency: number;
  successRate: number;
  totalTokens: number;
  errorCount: number;
  lastUsed: Date;
}

export class ModelPerformanceTool implements Tool {
  name = 'model_performance';
  description = 'Monitor and analyze model performance metrics';
  
  private metrics: Map<string, ModelMetrics> = new Map();

  async execute(params: {
    action: 'report' | 'reset' | 'compare';
    models?: string[];
    timeRange?: string;
  }): Promise<ToolResult> {
    
    switch (params.action) {
      case 'report':
        return this.generateReport(params.models);
      case 'reset':
        return this.resetMetrics(params.models);
      case 'compare':
        return this.compareModels(params.models || []);
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  recordRequest(modelName: string, latency: number, tokens: number, success: boolean): void {
    const current = this.metrics.get(modelName) || {
      modelName,
      requestCount: 0,
      averageLatency: 0,
      successRate: 0,
      totalTokens: 0,
      errorCount: 0,
      lastUsed: new Date(),
    };

    current.requestCount++;
    current.averageLatency = (current.averageLatency * (current.requestCount - 1) + latency) / current.requestCount;
    current.totalTokens += tokens;
    current.lastUsed = new Date();
    
    if (success) {
      current.successRate = (current.successRate * (current.requestCount - 1) + 1) / current.requestCount;
    } else {
      current.errorCount++;
      current.successRate = (current.successRate * (current.requestCount - 1)) / current.requestCount;
    }

    this.metrics.set(modelName, current);
  }

  private async generateReport(models?: string[]): Promise<ToolResult> {
    const targetModels = models || Array.from(this.metrics.keys());
    const report = targetModels
      .map(name => this.metrics.get(name))
      .filter(Boolean)
      .map(metrics => this.formatMetrics(metrics!))
      .join('\n\n');

    return {
      success: true,
      content: `Model Performance Report:\n\n${report}`,
      metadata: { 
        metrics: Object.fromEntries(
          targetModels.map(name => [name, this.metrics.get(name)])
        )
      },
    };
  }

  private formatMetrics(metrics: ModelMetrics): string {
    return `${metrics.modelName}:
  - Requests: ${metrics.requestCount}
  - Avg Latency: ${metrics.averageLatency.toFixed(2)}ms
  - Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
  - Total Tokens: ${metrics.totalTokens.toLocaleString()}
  - Errors: ${metrics.errorCount}
  - Last Used: ${metrics.lastUsed.toLocaleString()}`;
  }

  private async resetMetrics(models?: string[]): Promise<ToolResult> {
    if (models) {
      models.forEach(name => this.metrics.delete(name));
      return {
        success: true,
        content: `Reset metrics for models: ${models.join(', ')}`,
      };
    } else {
      this.metrics.clear();
      return {
        success: true,
        content: 'Reset all model metrics',
      };
    }
  }

  private async compareModels(models: string[]): Promise<ToolResult> {
    if (models.length < 2) {
      return {
        success: false,
        content: 'Need at least 2 models to compare',
      };
    }

    const comparison = models
      .map(name => this.metrics.get(name))
      .filter(Boolean)
      .sort((a, b) => a!.averageLatency - b!.averageLatency);

    const report = `Model Comparison (sorted by latency):
${comparison.map((m, i) => `${i + 1}. ${this.formatMetrics(m!)}`).join('\n\n')}`;

    return {
      success: true,
      content: report,
      metadata: { comparison },
    };
  }
}
```

## 🧪 第四阶段：测试和验证

### 4.1 单元测试

```typescript
// packages/core/src/adapters/huggingface-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HuggingFaceAdapter } from './huggingface-adapter.js';

describe('HuggingFaceAdapter', () => {
  let adapter: HuggingFaceAdapter;
  let mockHfClient: any;

  beforeEach(() => {
    mockHfClient = {
      textGeneration: vi.fn(),
      featureExtraction: vi.fn(),
    };

    adapter = new HuggingFaceAdapter({
      models: {
        textGeneration: 'test-model',
        codeGeneration: 'test-code-model',
        embedding: 'test-embedding-model',
        summarization: 'test-summary-model',
      },
      parameters: {
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
        repetitionPenalty: 1.1,
      },
    });

    // Mock the HfInference client
    (adapter as any).client = mockHfClient;
  });

  describe('generateContent', () => {
    it('should generate text successfully', async () => {
      const mockResponse = {
        generated_text: 'Generated response text',
      };
      mockHfClient.textGeneration.mockResolvedValue(mockResponse);

      const request = {
        prompt: 'Test prompt',
        maxTokens: 50,
      };

      const result = await adapter.generateContent(request);

      expect(result.success).toBe(true);
      expect(result.content).toBe('Generated response text');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
      expect(mockHfClient.textGeneration).toHaveBeenCalledWith({
        model: 'test-model',
        inputs: 'Test prompt',
        parameters: expect.objectContaining({
          max_new_tokens: 50,
          temperature: 0.7,
        }),
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockHfClient.textGeneration.mockRejectedValue(error);

      const request = { prompt: 'Test prompt' };
      const result = await adapter.generateContent(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('API Error');
    });

    it('should select correct model for code generation', async () => {
      mockHfClient.textGeneration.mockResolvedValue({
        generated_text: 'Generated code',
      });

      const request = {
        prompt: 'Write a function',
        task: 'code-generation',
      };

      await adapter.generateContent(request);

      expect(mockHfClient.textGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'test-code-model',
        })
      );
    });
  });

  describe('embedContent', () => {
    it('should generate embeddings successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockHfClient.featureExtraction.mockResolvedValue(mockEmbedding);

      const result = await adapter.embedContent({ text: 'Test text' });

      expect(result).toEqual(mockEmbedding);
      expect(mockHfClient.featureExtraction).toHaveBeenCalledWith({
        model: 'test-embedding-model',
        inputs: 'Test text',
      });
    });

    it('should handle nested array responses', async () => {
      const mockEmbedding = [[0.1, 0.2, 0.3, 0.4]];
      mockHfClient.featureExtraction.mockResolvedValue(mockEmbedding);

      const result = await adapter.embedContent({ text: 'Test text' });

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
    });
  });

  describe('countTokens', () => {
    it('should estimate token count', async () => {
      const text = 'This is a test sentence with multiple words';
      const result = await adapter.countTokens(text);

      expect(result).toBeGreaterThan(0);
      expect(result).toBe(Math.ceil(text.length / 4));
    });
  });
});
```

### 4.2 集成测试

```typescript
// packages/core/src/core/model-manager.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ModelManager } from './model-manager.js';

describe('ModelManager Integration', () => {
  let modelManager: ModelManager;

  beforeEach(() => {
    modelManager = new ModelManager({
      defaultModel: 'gemini',
      fallbackChain: ['gemini', 'huggingface'],
      huggingface: {
        models: {
          textGeneration: 'microsoft/DialoGPT-medium',
          codeGeneration: 'codellama/CodeLlama-7b-Instruct-hf',
          embedding: 'sentence-transformers/all-MiniLM-L6-v2',
          summarization: 'facebook/bart-large-cnn',
        },
        parameters: {
          maxTokens: 100,
          temperature: 0.7,
          topP: 0.9,
          repetitionPenalty: 1.1,
        },
      },
    });
  });

  it('should initialize with available models', () => {
    const models = modelManager.getAvailableModels();
    expect(models).toContain('huggingface');
    expect(models.length).toBeGreaterThan(0);
  });

  it('should switch models successfully', async () => {
    const success = await modelManager.switchModel('huggingface');
    expect(success).toBe(true);
  });

  it('should handle model switching to non-existent model', async () => {
    const success = await modelManager.switchModel('non-existent');
    expect(success).toBe(false);
  });

  // 注意：这些测试需要实际的 API 密钥，在 CI/CD 中应该跳过或使用 mock
  it.skip('should generate content with HuggingFace model', async () => {
    await modelManager.switchModel('huggingface');
    
    const response = await modelManager.generateContent({
      prompt: 'Hello, how are you?',
      maxTokens: 50,
    });

    expect(response.success).toBe(true);
    expect(response.content).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });
});
```

## 📊 第五阶段：监控和优化

### 5.1 性能监控集成

```typescript
// packages/core/src/monitoring/model-monitor.ts
export class ModelMonitor {
  private metrics: Map<string, ModelMetrics[]> = new Map();
  private alertThresholds = {
    maxLatency: 5000, // 5 seconds
    minSuccessRate: 0.95, // 95%
    maxErrorRate: 0.05, // 5%
  };

  recordMetric(modelName: string, metric: ModelMetric): void {
    const modelMetrics = this.metrics.get(modelName) || [];
    modelMetrics.push(metric);
    
    // 保持最近 1000 条记录
    if (modelMetrics.length > 1000) {
      modelMetrics.shift();
    }
    
    this.metrics.set(modelName, modelMetrics);
    
    // 检查是否需要告警
    this.checkAlerts(modelName, metric);
  }

  private checkAlerts(modelName: string, metric: ModelMetric): void {
    if (metric.latency > this.alertThresholds.maxLatency) {
      this.sendAlert(`High latency detected for ${modelName}: ${metric.latency}ms`);
    }
    
    const recentMetrics = this.getRecentMetrics(modelName, 10);
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    
    if (successRate < this.alertThresholds.minSuccessRate) {
      this.sendAlert(`Low success rate for ${modelName}: ${(successRate * 100).toFixed(1)}%`);
    }
  }

  private sendAlert(message: string): void {
    console.warn(`[MODEL ALERT] ${message}`);
    // 这里可以集成实际的告警系统
  }

  getRecentMetrics(modelName: string, count: number = 100): ModelMetric[] {
    const metrics = this.metrics.get(modelName) || [];
    return metrics.slice(-count);
  }

  generateReport(modelName: string): ModelReport {
    const metrics = this.metrics.get(modelName) || [];
    
    if (metrics.length === 0) {
      return {
        modelName,
        totalRequests: 0,
        averageLatency: 0,
        successRate: 0,
        errorRate: 0,
      };
    }

    const totalRequests = metrics.length;
    const averageLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / totalRequests;
    const successCount = metrics.filter(m => m.success).length;
    const successRate = successCount / totalRequests;
    const errorRate = 1 - successRate;

    return {
      modelName,
      totalRequests,
      averageLatency,
      successRate,
      errorRate,
    };
  }
}

interface ModelMetric {
  timestamp: number;
  latency: number;
  success: boolean;
  tokenCount: number;
  error?: string;
}

interface ModelReport {
  modelName: string;
  totalRequests: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
}
```

### 5.2 自动优化建议

```typescript
// packages/core/src/optimization/model-optimizer.ts
export class ModelOptimizer {
  constructor(private monitor: ModelMonitor) {}

  generateOptimizationSuggestions(modelName: string): OptimizationSuggestion[] {
    const report = this.monitor.generateReport(modelName);
    const suggestions: OptimizationSuggestion[] = [];

    // 延迟优化建议
    if (report.averageLatency > 3000) {
      suggestions.push({
        type: 'performance',
        priority: 'high',
        message: `High average latency (${report.averageLatency.toFixed(0)}ms). Consider switching to a faster model or implementing caching.`,
        actions: [
          'Switch to a smaller/faster model variant',
          'Implement response caching',
          'Use model quantization',
        ],
      });
    }

    // 成功率优化建议
    if (report.successRate < 0.95) {
      suggestions.push({
        type: 'reliability',
        priority: 'high',
        message: `Low success rate (${(report.successRate * 100).toFixed(1)}%). Check model configuration and error patterns.`,
        actions: [
          'Review error logs for common failure patterns',
          'Adjust model parameters (temperature, max_tokens)',
          'Implement better error handling and retries',
        ],
      });
    }

    // 使用量建议
    if (report.totalRequests < 10) {
      suggestions.push({
        type: 'usage',
        priority: 'low',
        message: 'Low usage detected. Consider if this model is necessary or if it should be the default for certain tasks.',
        actions: [
          'Review task-to-model mapping',
          'Consider removing unused models',
          'Promote model for suitable tasks',
        ],
      });
    }

    return suggestions;
  }
}

interface OptimizationSuggestion {
  type: 'performance' | 'reliability' | 'cost' | 'usage';
  priority: 'high' | 'medium' | 'low';
  message: string;
  actions: string[];
}
```

## 🚀 部署和配置

### 6.1 环境变量配置

```bash
# .env.example
# HuggingFace Configuration
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HUGGINGFACE_ENABLED=true

# Model Selection Strategy
MODEL_STRATEGY=balanced  # options: gemini, huggingface, balanced
MODEL_FALLBACK_CHAIN=gemini,huggingface

# HuggingFace Model Configuration
HF_TEXT_MODEL=microsoft/DialoGPT-medium
HF_CODE_MODEL=codellama/CodeLlama-7b-Instruct-hf
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_SUMMARY_MODEL=facebook/bart-large-cnn

# Performance Tuning
HF_MAX_TOKENS=2048
HF_TEMPERATURE=0.7
HF_TOP_P=0.9
HF_REPETITION_PENALTY=1.1

# Monitoring
ENABLE_MODEL_MONITORING=true
ALERT_LATENCY_THRESHOLD=5000
ALERT_SUCCESS_RATE_THRESHOLD=0.95
```

### 6.2 CLI 配置扩展

```typescript
// packages/cli/src/config/config.ts (扩展现有配置)

// 在现有配置接口中添加
export interface ExtendedCliConfig extends CliConfig {
  huggingface?: {
    enabled: boolean;
    apiKey?: string;
    preferredModels?: {
      text?: string;
      code?: string;
      embedding?: string;
    };
  };
  
  modelStrategy?: {
    primary: 'gemini' | 'huggingface' | 'auto';
    fallback: string[];
    taskMapping?: Record<string, string>;
  };
}

// 扩展配置加载函数
export function loadExtendedConfig(): ExtendedCliConfig {
  const baseConfig = loadConfig(); // 现有函数
  
  return {
    ...baseConfig,
    huggingface: {
      enabled: process.env.HUGGINGFACE_ENABLED === 'true',
      apiKey: process.env.HUGGINGFACE_API_KEY,
      preferredModels: {
        text: process.env.HF_TEXT_MODEL,
        code: process.env.HF_CODE_MODEL,
        embedding: process.env.HF_EMBEDDING_MODEL,
      },
    },
    modelStrategy: {
      primary: (process.env.MODEL_STRATEGY as any) || 'gemini',
      fallback: process.env.MODEL_FALLBACK_CHAIN?.split(',') || ['gemini'],
      taskMapping: {
        'code-generation': process.env.CODE_MODEL_PREFERENCE || 'huggingface',
        'summarization': process.env.SUMMARY_MODEL_PREFERENCE || 'huggingface',
      },
    },
  };
}
```

## 📋 验收标准

### 功能验收
- [ ] HuggingFace 适配器正常工作
- [ ] 模型切换功能正常
- [ ] 降级机制正常工作
- [ ] 工具集成完成
- [ ] 配置系统扩展完成

### 性能验收
- [ ] HuggingFace 模型响应时间 < 5秒
- [ ] 模型切换时间 < 1秒
- [ ] 内存使用增长 < 100MB
- [ ] 成功率 > 95%

### 兼容性验收
- [ ] 现有 Gemini 功能不受影响
- [ ] 现有配置继续有效
- [ ] 现有工具正常工作
- [ ] API 接口保持兼容

---

*本实施指南提供了完整的代码实现和部署步骤，确保 HuggingFace 集成的成功实施。*