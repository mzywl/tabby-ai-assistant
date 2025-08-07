# API 文档

本文档详细介绍 Tabby AI 助手插件的 API 接口和开发者指南。

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Tabby AI Assistant Plugin               │
├─────────────────────┬───────────────────┬───────────────────┤
│     Components      │     Services      │     Providers     │
├─────────────────────┼───────────────────┼───────────────────┤
│ AIChatPanelComponent│ AIService         │ ConfigProvider    │
│ SidebarChatComponent│ ContextService    │ ToolbarProvider   │
│ SettingsComponent   │ SidebarService    │ SettingsProvider  │
│ ContainerComponent  │ BootstrapService  │                   │
└─────────────────────┴───────────────────┴───────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    External AI Services                    │
├─────────────────────┬───────────────────┬───────────────────┤
│      OpenAI         │      Claude       │      Ollama       │
│   GPT-3.5/GPT-4     │  Claude-3 Series  │  Local Models     │
└─────────────────────┴───────────────────┴───────────────────┘
```

## 📚 核心服务 API

### AIService

AI 服务的核心类，负责与各种 AI 服务提供商的交互。

#### 类定义

```typescript
@Injectable()
export class AIService {
  private currentSession: ChatSession | null = null
  private sessions: ChatSession[] = []
}
```

#### 接口定义

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{type: string, text?: string, image_url?: {url: string}}>
  timestamp?: Date
}

interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: Date
  title: string
}
```

#### 主要方法

##### `isConfigured(): boolean`

检查 AI 服务是否已正确配置。

**返回值**：
- `boolean` - 配置状态

**示例**：
```typescript
if (this.aiService.isConfigured()) {
  // 执行 AI 相关操作
} else {
  // 提示用户配置
}
```

##### `sendQuery(query: string, contextData?: ContextData, attachments?: File[]): Promise<string>`

发送查询到 AI 服务。

**参数**：
- `query: string` - 用户查询内容
- `contextData?: ContextData` - 可选的上下文数据
- `attachments?: File[]` - 可选的文件附件（图片等）

**返回值**：
- `Promise<string>` - AI 的回复内容

**异常**：
- `Error` - API 请求失败、超时等

**示例**：
```typescript
try {
  const response = await this.aiService.sendQuery(
    "请解释这个错误", 
    contextData, 
    imageFiles
  )
  console.log('AI回复:', response)
} catch (error) {
  console.error('查询失败:', error.message)
}
```

##### `createNewSession(title?: string): ChatSession`

创建新的聊天会话。

**参数**：
- `title?: string` - 可选的会话标题

**返回值**：
- `ChatSession` - 新创建的会话对象

**示例**：
```typescript
const session = this.aiService.createNewSession("调试会话")
console.log('新会话ID:', session.id)
```

##### `getCurrentSession(): ChatSession | null`

获取当前活动的会话。

**返回值**：
- `ChatSession | null` - 当前会话或 null

##### `getAllSessions(): ChatSession[]`

获取所有会话列表。

**返回值**：
- `ChatSession[]` - 会话数组

##### `switchToSession(sessionId: string): boolean`

切换到指定会话。

**参数**：
- `sessionId: string` - 会话ID

**返回值**：
- `boolean` - 切换是否成功

##### `deleteSession(sessionId: string): boolean`

删除指定会话。

**参数**：
- `sessionId: string` - 会话ID

**返回值**：
- `boolean` - 删除是否成功

##### `testConnection(): Promise<void>`

测试与 AI 服务的连接。

**异常**：
- `Error` - 连接失败

**示例**：
```typescript
try {
  await this.aiService.testConnection()
  console.log('连接成功')
} catch (error) {
  console.error('连接失败:', error.message)
}
```

### ContextService

上下文管理服务，处理终端选中文本的捕获和管理。

#### 类定义

```typescript
@Injectable()
export class ContextService {
  private selectedTexts = new BehaviorSubject<SelectedTextData[]>([])
  private selectionMode = new BehaviorSubject<SelectionMode>('current')
}
```

#### 接口定义

```typescript
interface SelectedTextData {
  terminalId: string
  text: string
  source: string
  timestamp: Date
  isCollapsed?: boolean
}

interface ContextData {
  selectedText?: string
  terminalInfo?: string
  timestamp: Date
}

type SelectionMode = 'current' | 'multiple' | 'none'
```

#### 主要方法

##### `analyzeContext(query: string): Promise<ContextData>`

智能分析当前上下文，生成上下文数据。

**参数**：
- `query: string` - 用户查询

**返回值**：
- `Promise<ContextData>` - 上下文数据

##### `setSelectionMode(mode: SelectionMode): void`

设置选择模式。

**参数**：
- `mode: SelectionMode` - 选择模式

**示例**：
```typescript
this.contextService.setSelectionMode('multiple')
```

##### `updateSelectedText(terminalId: string, text: string): void`

更新指定终端的选中文本。

**参数**：
- `terminalId: string` - 终端ID
- `text: string` - 选中的文本

##### `clearSelectedText(terminalId?: string): void`

清除选中文本。

**参数**：
- `terminalId?: string` - 可选的终端ID，如果不提供则清除所有

##### `getSelectedTextPreview(maxLength?: number): string`

获取选中文本的预览。

**参数**：
- `maxLength?: number` - 最大长度，默认100

**返回值**：
- `string` - 文本预览

#### Observable 属性

##### `selectedTexts$: Observable<SelectedTextData[]>`

选中文本的观察者模式流。

**示例**：
```typescript
this.contextService.selectedTexts$.subscribe(texts => {
  console.log('选中文本更新:', texts)
})
```

##### `selectionMode$: Observable<SelectionMode>`

选择模式的观察者模式流。

## 🎨 组件 API

### AIChatPanelComponent

主聊天面板组件。

#### 继承关系

```typescript
export class AIChatPanelComponent extends BaseTabComponent implements OnDestroy
```

#### 属性

```typescript
interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

// 组件属性
messages: ChatMessage[] = []
currentMessage: string = ''
isLoading: boolean = false
selectedTexts: SelectedTextData[] = []
selectionMode: SelectionMode = 'current'
```

#### 主要方法

##### `sendMessage(): Promise<void>`

发送消息到 AI 服务。

##### `clearHistory(): void`

清除聊天历史。

##### `setSelectionMode(mode: SelectionMode): void`

设置选择模式。

##### `formatTime(date: Date): string`

格式化时间显示。

### AISidebarChatComponent

侧边栏聊天组件，功能与主面板类似但界面更紧凑。

## 🔌 提供者 API

### AIAssistantConfigProvider

配置提供者，管理插件配置。

```typescript
@Injectable()
export class AIAssistantConfigProvider extends ConfigProvider {
  defaults = {
    aiAssistant: {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30,
      systemPrompt: '你是一个专业的AI助手。'
    }
  }
}
```

### AIAssistantToolbarButton

工具栏按钮提供者。

```typescript
@Injectable()
export class AIAssistantToolbarButton extends ToolbarButtonProvider {
  provide(): ToolbarButton[] {
    return [{
      icon: 'robot',
      title: 'AI 助手',
      click: () => this.openAIAssistant()
    }]
  }
}
```

## 🔧 扩展开发

### 添加新的 AI 服务提供商

1. **扩展配置接口**：

```typescript
interface AIConfig {
  provider: 'openai' | 'claude' | 'ollama' | 'hunyuan' | 'newProvider'
  // 新提供商的配置字段
  newProviderApiKey?: string
  newProviderModel?: string
}
```

2. **在 AIService 中添加支持**：

```typescript
private buildRequest(query: string, config: any): any {
  switch (config.provider) {
    case 'newProvider':
      return {
        model: config.newProviderModel,
        messages: [{ role: 'user', content: query }]
      }
    // ... 其他 case
  }
}

private getApiUrl(config: any): string {
  switch (config.provider) {
    case 'newProvider':
      return 'https://api.newprovider.com/v1/chat'
    // ... 其他 case
  }
}

private extractResponse(data: any, provider: string): string {
  switch (provider) {
    case 'newProvider':
      return data.response?.text || '无回复'
    // ... 其他 case
  }
}
```

### 自定义组件

创建自定义聊天组件：

```typescript
@Component({
  selector: 'custom-chat',
  template: `
    <div class="custom-chat">
      <!-- 自定义UI -->
    </div>
  `
})
export class CustomChatComponent {
  constructor(private aiService: AIService) {}

  async sendCustomQuery(query: string) {
    try {
      const response = await this.aiService.sendQuery(query)
      // 处理响应
    } catch (error) {
      // 错误处理
    }
  }
}
```

### 扩展上下文处理

自定义上下文提取器：

```typescript
export class CustomContextExtractor {
  extractContext(terminal: any): ContextData {
    return {
      selectedText: terminal.getSelection(),
      terminalInfo: terminal.getInfo(),
      timestamp: new Date()
    }
  }
}
```

## 🎯 事件系统

### 可监听事件

```typescript
// AI 服务事件
aiService.on('messageReceived', (message: ChatMessage) => {
  console.log('收到消息:', message)
})

aiService.on('sessionCreated', (session: ChatSession) => {
  console.log('新会话:', session)
})

// 上下文服务事件
contextService.selectedTexts$.subscribe(texts => {
  console.log('选中文本变化:', texts)
})
```

## 🚀 性能优化

### 消息历史管理

```typescript
// 限制消息数量以控制内存使用
private trimMessages(messages: ChatMessage[], maxCount: number = 50): ChatMessage[] {
  return messages.slice(-maxCount)
}

// 估算 token 使用量
private estimateTokens(message: string): number {
  return Math.ceil(message.length / 4) // 粗略估算
}
```

### 请求优化

```typescript
// 防抖处理连续请求
private debounceQuery = debounce(this.sendQuery.bind(this), 300)

// 缓存相似查询结果
private queryCache = new Map<string, string>()
```

## 🛡️ 错误处理

### 标准错误类型

```typescript
export enum AIErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR'
}

export class AIError extends Error {
  constructor(
    public type: AIErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message)
  }
}
```

### 错误处理最佳实践

```typescript
try {
  const response = await this.aiService.sendQuery(query)
  return response
} catch (error) {
  if (error instanceof AIError) {
    switch (error.type) {
      case AIErrorType.CONFIGURATION_ERROR:
        this.notifications.error('请检查AI配置')
        break
      case AIErrorType.RATE_LIMIT_ERROR:
        this.notifications.warn('请求频率过高，请稍后再试')
        break
      default:
        this.notifications.error('AI服务异常')
    }
  } else {
    console.error('未知错误:', error)
  }
}
```

## 🧪 测试

### 单元测试示例

```typescript
describe('AIService', () => {
  let service: AIService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(AIService)
  })

  it('应该创建新会话', () => {
    const session = service.createNewSession('测试会话')
    expect(session.title).toBe('测试会话')
    expect(session.messages).toEqual([])
  })

  it('应该检查配置状态', () => {
    // 模拟配置
    spyOn(service['config'].store, 'aiAssistant').and.returnValue({
      provider: 'openai',
      apiKey: 'sk-test'
    })
    
    expect(service.isConfigured()).toBeTruthy()
  })
})
```

## 📖 使用示例

### 基础使用

```typescript
// 在组件中注入服务
constructor(private aiService: AIService) {}

// 发送简单查询
async sendQuery() {
  try {
    const response = await this.aiService.sendQuery('Hello AI')
    console.log(response)
  } catch (error) {
    console.error(error)
  }
}
```

### 高级使用

```typescript
// 带上下文的查询
async sendQueryWithContext() {
  const contextData = await this.contextService.analyzeContext('解释这段代码')
  
  const response = await this.aiService.sendQuery(
    '请解释这段代码的功能',
    contextData
  )
  
  return response
}

// 会话管理
manageSession() {
  // 创建新会话
  const session = this.aiService.createNewSession('代码审查')
  
  // 发送消息
  await this.aiService.sendQuery('开始代码审查')
  
  // 切换会话
  this.aiService.switchToSession('previous-session-id')
}
```

这个 API 文档提供了完整的接口说明和使用示例，开发者可以基于这些接口扩展插件功能或集成到其他项目中。