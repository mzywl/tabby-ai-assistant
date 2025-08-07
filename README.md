# Tabby AI 助手插件

<div align="center">

![AI Assistant](https://img.shields.io/badge/AI-Assistant-blue?style=for-the-badge&logo=robot)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tabby](https://img.shields.io/badge/Tabby-Terminal-green?style=for-the-badge)

**为 Tabby 终端带来智能 AI 助手功能，支持多种 AI 服务提供商，提供便捷的终端 AI 交互体验**

[功能特点](#-功能特点) •
[安装说明](#-安装说明) •
[使用指南](#-使用指南) •
[配置说明](#-配置说明) •
[开发文档](#-开发文档)

</div>

## 🚀 功能特点

### 🤖 多AI服务支持
- **OpenAI GPT 系列** - GPT-3.5, GPT-4, GPT-4o 等
- **Claude 系列** - Claude-3.5-Sonnet, Claude-3-Opus 等  
- **本地 Ollama** - 支持各种开源大语言模型
- **腾讯元器** - 国内AI服务支持

### 💬 智能聊天功能
- **对话历史管理** - 自动保存会话记录，支持多会话切换
- **会话标题自动生成** - 根据首条消息智能命名
- **上下文理解** - 支持连续对话，保持上下文语境
- **消息时间戳** - 完整的消息时间记录

### 🎯 智能上下文集成
- **终端内容选择** - 选中终端文本自动作为上下文
- **多终端支持** - 支持同时使用多个终端的选中内容
- **选择模式切换** - 当前终端/多终端/无选择 三种模式
- **上下文预览** - 可视化显示当前选中的上下文内容

### 🎨 现代化界面
- **深色主题适配** - 完美融入 Tabby 主题系统
- **响应式设计** - 适配不同屏幕尺寸
- **实时状态反馈** - 加载动画、错误提示等
- **键盘快捷键** - Enter 发送，Shift+Enter 换行

### 🔧 灵活配置
- **多种部署方式** - 云端API / 本地部署
- **参数自定义** - 温度、最大令牌数、超时时间等
- **自定义提示词** - 可设置系统提示词
- **连接测试** - 配置验证和连接测试功能

## 📦 安装说明

### 方式一：从源码安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/tabby-ai-assistant.git
   cd tabby-ai-assistant
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建插件**
   ```bash
   npm run build
   ```

4. **安装到 Tabby**
   - 将 `dist` 文件夹复制到 Tabby 插件目录
   - 或者在 Tabby 设置中选择本地插件目录

### 方式二：下载发布版本

1. 从 [Releases 页面](https://github.com/your-username/tabby-ai-assistant/releases) 下载最新版本
2. 解压文件到 Tabby 插件目录
3. 重启 Tabby

### Tabby 插件目录位置

- **Windows**: `%APPDATA%\tabby\plugins`
- **macOS**: `~/Library/Application Support/tabby/plugins`
- **Linux**: `~/.config/tabby/plugins`

## 🎯 使用指南

### 基础使用

1. **打开 AI 助手**
   - 点击工具栏的机器人图标 🤖
   - 或使用侧边栏中的 AI 助手面板

2. **基础对话**
   ```
   用户：请帮我解释一下这个错误信息
   AI：我很乐意帮您分析错误信息。请将错误信息发送给我...
   ```

3. **使用选中文本作为上下文**
   - 在终端中选择相关文本
   - 在 AI 助手中输入问题
   - AI 会自动结合选中内容进行回答

### 高级功能

#### 1. 多终端上下文

**场景**：需要在多个终端窗口间分析相关内容

1. 在不同终端窗口中选择相关文本
2. 切换到 "多终端" 模式
3. AI 助手会综合所有选中内容进行分析

```
选择模式：
🖥️ 当前终端 - 只使用当前活动终端的选中内容
📱 多终端 - 使用所有终端的选中内容  
🚫 不选择 - 不使用任何选中内容
```

#### 2. 会话管理

- **新建会话**：每个独立话题使用新会话
- **切换会话**：在不同会话间快速切换
- **删除会话**：清理不需要的会话记录
- **会话重命名**：自动根据首条消息命名

#### 3. 上下文预览

选中文本时，AI 助手会显示：
- 📄 **来源终端**：显示文本来源
- 📏 **内容长度**：显示字符数量
- 👁️ **内容预览**：可展开查看完整内容
- ⏰ **时间戳**：显示选择时间

## ⚙️ 配置说明

### OpenAI 配置

```json
{
  "provider": "openai",
  "apiKey": "sk-xxx",
  "model": "gpt-3.5-turbo",
  "baseUrl": "https://api.openai.com",
  "maxTokens": 4096,
  "temperature": 0.7,
  "timeout": 30
}
```

### Claude 配置

```json
{
  "provider": "claude",
  "apiKey": "sk-ant-xxx",
  "model": "claude-3-5-sonnet-20241022",
  "baseUrl": "https://api.anthropic.com",
  "maxTokens": 8192,
  "temperature": 0.7,
  "timeout": 30
}
```

### Ollama 本地配置

```json
{
  "provider": "ollama",
  "model": "llama3.2:3b",
  "baseUrl": "http://localhost:11434",
  "maxTokens": 8192,
  "temperature": 0.7,
  "timeout": 60
}
```

### 腾讯元器配置

```json
{
  "provider": "hunyuan",
  "hunyuanAssistantId": "your-assistant-id",
  "hunyuanToken": "your-token",
  "timeout": 30
}
```

### 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `provider` | AI 服务提供商 | - |
| `apiKey` | API 密钥 | - |
| `model` | 模型名称 | - |
| `baseUrl` | API 基础 URL | 各服务商默认 |
| `maxTokens` | 最大令牌数 | 4096 |
| `temperature` | 随机性参数 (0-1) | 0.7 |
| `timeout` | 超时时间(秒) | 30 |
| `systemPrompt` | 系统提示词 | "你是一个专业的AI助手" |

## 🔧 开发文档

### 项目结构

```
tabby-ai-assistant/
├── 📁 src/
│   ├── 📁 components/          # Angular 组件
│   │   ├── chat-panel.component.ts      # 聊天面板主组件
│   │   ├── sidebar-chat.component.ts    # 侧边栏聊天组件
│   │   ├── settings.component.ts        # 设置页面组件
│   │   └── container.component.ts       # 容器组件
│   ├── 📁 services/           # 核心服务
│   │   ├── ai.service.ts      # AI 服务核心逻辑
│   │   ├── context.service.ts # 上下文管理服务
│   │   ├── sidebar.service.ts # 侧边栏管理服务
│   │   └── bootstrap.service.ts # 插件启动服务
│   ├── 📁 providers/          # 服务提供者
│   │   ├── config.provider.ts        # 配置提供者
│   │   ├── toolbar-button.provider.ts # 工具栏按钮
│   │   └── settings-tab.provider.ts   # 设置页面标签
│   ├── 📁 icons/              # 图标资源
│   │   └── robot.svg          # AI 助手图标
│   └── index.ts               # 插件入口文件
├── 📄 package.json            # 项目配置
├── 📄 tsconfig.json          # TypeScript 配置
├── 📄 webpack.config.js      # 构建配置
└── 📄 README.md              # 项目文档
```

### 核心架构

#### 1. AI 服务 (AIService)

**功能职责**：
- 🔌 多 AI 服务提供商适配
- 💬 对话历史管理
- 🔄 请求/响应处理
- ⚙️ 配置验证

**核心方法**：
```typescript
class AIService {
  // 发送查询请求
  async sendQuery(query: string, contextData?: ContextData): Promise<string>
  
  // 会话管理
  createNewSession(title?: string): ChatSession
  switchToSession(sessionId: string): boolean
  
  // 配置管理
  isConfigured(): boolean
  async testConnection(): Promise<void>
}
```

#### 2. 上下文服务 (ContextService)

**功能职责**：
- 📝 终端文本选择监听
- 🔄 多终端内容管理
- 🎯 选择模式控制
- 📊 上下文数据构建

**核心方法**：
```typescript
class ContextService {
  // 智能上下文分析
  async analyzeContext(query: string): Promise<ContextData>
  
  // 选择模式管理
  setSelectionMode(mode: SelectionMode): void
  
  // 选中文本管理
  updateSelectedText(terminalId: string, text: string): void
  clearSelectedText(terminalId?: string): void
}
```

#### 3. 组件架构

**聊天面板组件** (`AIChatPanelComponent`)：
- 💬 主要聊天界面
- 📱 响应式设计
- ⌨️ 键盘交互
- 🎨 主题适配

**侧边栏组件** (`AISidebarChatComponent`)：
- 🔧 紧凑型聊天界面
- 🎛️ 快速访问功能
- 📋 会话列表管理

### 开发指南

#### 1. 环境设置

```bash
# 克隆项目
git clone https://github.com/your-username/tabby-ai-assistant.git
cd tabby-ai-assistant

# 安装依赖
npm install

# 开发模式（自动重新构建）
npm run watch

# 生产构建
npm run build
```

#### 2. 调试方法

**启用开发者工具**：
- 在 Tabby 中按 `F12` 打开开发者工具
- 在 Console 中查看日志输出：`[AI助手] ...`

**日志级别**：
```typescript
console.log('[AI助手] 普通信息')
console.warn('[AI助手] 警告信息') 
console.error('[AI助手] 错误信息')
```

#### 3. 添加新 AI 服务商

1. **在 `AIService` 中添加配置处理**：
```typescript
case 'newProvider':
  return {
    // 构建请求体
  }
```

2. **添加 URL 和头部处理**：
```typescript
private getApiUrl(config: any): string {
  switch (config.provider) {
    case 'newProvider':
      return 'https://api.newprovider.com/v1/chat'
  }
}
```

3. **添加响应解析**：
```typescript
private extractResponse(data: any, provider: string): string {
  switch (provider) {
    case 'newProvider':
      return data.choices?.[0]?.message?.content || '无回复'
  }
}
```

### API 参考

#### AIService API

**配置检查**
```typescript
isConfigured(): boolean
```

**发送查询**
```typescript
async sendQuery(
  query: string, 
  contextData?: ContextData, 
  attachments?: File[]
): Promise<string>
```

**会话管理**
```typescript
createNewSession(title?: string): ChatSession
getCurrentSession(): ChatSession | null
getAllSessions(): ChatSession[]
switchToSession(sessionId: string): boolean
deleteSession(sessionId: string): boolean
```

#### ContextService API

**上下文分析**
```typescript
async analyzeContext(query: string): Promise<ContextData>
```

**选择模式**
```typescript
setSelectionMode(mode: SelectionMode): void
// 模式类型：'current' | 'multiple' | 'none'
```

**文本管理**
```typescript
updateSelectedText(terminalId: string, text: string): void
clearSelectedText(terminalId?: string): void
getSelectedTextPreview(maxLength?: number): string
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork 本仓库**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **打开 Pull Request**

### 开发规范

- 🎨 遵循 Angular 编码规范
- 📝 添加适当的注释和文档
- 🧪 确保新功能有对应的测试
- 🔍 运行 `npm run build` 确保构建成功

### 报告问题

发现 Bug？有功能建议？

- 📝 [创建 Issue](https://github.com/your-username/tabby-ai-assistant/issues)
- 🐛 Bug 报告请包含：
  - 操作系统和 Tabby 版本
  - 重现步骤
  - 预期行为和实际行为
  - 错误日志（如有）

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Tabby](https://tabby.sh/) - 优秀的终端应用
- [Angular](https://angular.io/) - 前端框架
- [OpenAI](https://openai.com/) - AI 服务支持
- [Anthropic](https://anthropic.com/) - Claude AI 服务

---

<div align="center">

**如果这个项目对您有帮助，请给个 ⭐ Star 支持一下！**

Made with ❤️ by AI Assistant Plugin Team

</div>