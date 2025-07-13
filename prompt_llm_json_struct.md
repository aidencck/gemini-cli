# LLM Prompt JSON结构与组装流程

## 1. 组装流程概览

1. **用户输入处理**（含@命令文件内容注入）
2. **历史消息拼接**（多轮对话上下文）
3. **系统Prompt注入**（规则/流程/风格/工具/环境/示例/记忆）
4. **工具声明注入**（所有可用工具的schema）
5. **最终组装为LLM API请求JSON**

---

## 2. LLM请求JSON结构

### 2.1 顶层结构（以Gemini/Vertex为例）

```json
{
  "model": "gemini-1.5-pro",
  "contents": [ ... ],                // 多轮历史+本轮输入，结构化
  "config": {
    "systemInstruction": "...",       // 系统Prompt（长文本，含规则/流程/示例/环境/记忆）
    "tools": [ ... ],                 // 工具声明（函数签名/参数/描述等）
    "generationConfig": { ... },      // 采样参数（温度、topK、maxTokens等）
    "abortSignal": "...",             // 控制流/取消信号
    // 其他可选参数
  }
}
```

### 2.2 contents字段（对话历史+本轮输入）

每一项为一轮对话，结构如下：

```json
{
  "role": "user" | "model",
  "parts": [
    { "text": "..." },                // 普通文本
    { "text": "..." },                // 结构化插入的文件内容（如@file）
    // 也可能有工具调用、thought等特殊part
  ]
}
```

- **历史消息**：完整保留多轮对话（含工具调用结果、文件内容等）
- **本轮输入**：用户query + @命令注入的文件内容，均以结构化part插入

### 2.3 config字段

- **systemInstruction**：系统Prompt，详见下节
- **tools**：所有可用工具的JSON schema声明（函数名、参数、描述、类型等）
- **generationConfig**：采样参数（如temperature、topK、maxOutputTokens、stopSequences等）
- **abortSignal**：用于流式/取消控制
- **其他**：如labels、safetySettings、toolConfig等（可选）

---

## 3. 系统Prompt（systemInstruction）内容

- **分层结构**：基础指令、工作流、操作指南、安全规则、工具用法、环境适配、示例演示
- **动态注入**：工具名、环境变量、用户记忆、git/sandbox环境说明
- **示例**（见`getCoreSystemPrompt`实际生成内容）

---

## 4. 工具声明（tools）

- **结构**：每个工具为一个JSON对象，包含
  - `name`：工具名
  - `description`：用途说明
  - `parameters`：参数schema（类型、必填、描述、正则等）
  - `returns`：返回值schema
- **用途**：LLM可根据声明主动发起工具调用，参数校验由schema约束

---

## 5. 典型请求JSON示例

```json
{
  "model": "gemini-1.5-pro",
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "请分析src/auth.py的登录逻辑" },
        { "text": "\nContent from @src/auth.py:\n<文件内容...>" }
      ]
    },
    {
      "role": "model",
      "parts": [
        { "text": "好的，我将分析src/auth.py..." }
      ]
    }
    // ...历史多轮
  ],
  "config": {
    "systemInstruction": "<完整系统Prompt文本>",
    "tools": [
      {
        "name": "ReadFileTool",
        "description": "读取文件内容",
        "parameters": {
          "absolute_path": { "type": "string", "pattern": "^/", "description": "绝对路径" }
        },
        "returns": { "type": "string" }
      },
      // ...更多工具
    ],
    "generationConfig": {
      "temperature": 0.8,
      "topK": 40,
      "maxOutputTokens": 2048
    }
  }
}
```

---

## 6. 结构化要点总结

- **所有上下文（历史/输入/文件内容）均结构化分块注入，role/part分明**
- **系统Prompt为长文本，动态拼装，注入config.systemInstruction**
- **工具声明为JSON schema，支持LLM主动函数调用**
- **采样/安全/流控参数均在config下统一管理**
- **最终请求为标准JSON，便于审计、回溯和扩展**

---

## 7. 参考核心代码位置

- Prompt组装：`packages/core/src/core/client.ts`、`core/geminiChat.ts`
- 系统Prompt生成：`core/prompts.ts`
- 工具声明：`tools/tool-registry.ts`
- JSON结构转换：`code_assist/converter.ts`（`toGenerateContentRequest`）

---

如需更详细字段说明或示例，可补充。此结构已覆盖prompt组装、历史注入、工具声明、参数控制等所有核心要素。 