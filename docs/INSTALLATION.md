# 安装和配置指南

本指南将详细介绍如何安装和配置 Tabby AI 助手插件。

## 📋 系统要求

- **Tabby 终端** v1.0.0 或更高版本
- **Node.js** v14.0 或更高版本（仅用于从源码构建）
- **支持的操作系统**：Windows, macOS, Linux

## 🚀 安装方法

### 方法一：从 Release 安装（推荐）

1. **下载插件**
   - 访问 [GitHub Releases 页面](https://github.com/your-username/tabby-ai-assistant/releases)
   - 下载最新版本的 `tabby-ai-assistant.zip`

2. **找到 Tabby 插件目录**
   
   | 操作系统 | 插件目录路径 |
   |----------|-------------|
   | Windows | `%APPDATA%\tabby\plugins` |
   | macOS | `~/Library/Application Support/tabby/plugins` |
   | Linux | `~/.config/tabby/plugins` |

3. **安装插件**
   ```bash
   # 解压到插件目录
   cd /path/to/tabby/plugins
   unzip tabby-ai-assistant.zip
   ```

4. **重启 Tabby**
   - 完全关闭 Tabby
   - 重新启动 Tabby
   - 在工具栏看到 🤖 图标即表示安装成功

### 方法二：从源码构建

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
   ```bash
   # 方式 A：复制构建文件
   cp -r dist/ /path/to/tabby/plugins/tabby-ai-assistant/
   
   # 方式 B：创建软链接（开发模式）
   ln -s $(pwd)/dist /path/to/tabby/plugins/tabby-ai-assistant
   ```

### 方法三：开发模式安装

适用于插件开发者：

```bash
# 克隆并进入目录
git clone https://github.com/your-username/tabby-ai-assistant.git
cd tabby-ai-assistant

# 安装依赖
npm install

# 开发模式（自动重新构建）
npm run watch

# 在另一个终端创建软链接
ln -s $(pwd)/dist /path/to/tabby/plugins/tabby-ai-assistant
```

## ⚙️ 配置指南

### 1. 打开设置页面

安装完成后：

1. 打开 Tabby 设置 (Settings)
2. 找到 "AI 助手" 选项卡
3. 进行相应配置

### 2. OpenAI 配置

#### 获取 API Key

1. 访问 [OpenAI Platform](https://platform.openai.com)
2. 登录账户，进入 "API Keys" 页面
3. 点击 "Create new secret key" 创建新密钥
4. 复制密钥（请妥善保管，只显示一次）

#### 配置参数

```json
{
  "provider": "openai",
  "apiKey": "sk-proj-xxxxxxxxxxxxx",
  "model": "gpt-3.5-turbo",
  "baseUrl": "https://api.openai.com",
  "maxTokens": 4096,
  "temperature": 0.7,
  "timeout": 30,
  "systemPrompt": "你是一个专业的终端助手，擅长解决技术问题。"
}
```

**推荐模型**：
- `gpt-3.5-turbo` - 性价比高，速度快
- `gpt-4` - 能力更强，成本较高
- `gpt-4o` - 最新模型，平衡性能和成本

### 3. Claude 配置

#### 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com)
2. 创建账户并完成验证
3. 进入 "API Keys" 页面
4. 创建新的 API Key
5. 复制密钥

#### 配置参数

```json
{
  "provider": "claude",
  "apiKey": "sk-ant-api03-xxxxxxxxxxxxx",
  "model": "claude-3-5-sonnet-20241022",
  "maxTokens": 8192,
  "temperature": 0.7,
  "timeout": 30,
  "systemPrompt": "你是一个专业的终端助手。"
}
```

**推荐模型**：
- `claude-3-5-sonnet-20241022` - 最新版本，性能优秀
- `claude-3-opus-20240229` - 最强能力，成本最高
- `claude-3-haiku-20240307` - 速度快，成本低

### 4. Ollama 本地配置

#### 安装 Ollama

**Windows/macOS**：
1. 访问 [Ollama 官网](https://ollama.com)
2. 下载对应系统的安装包
3. 运行安装程序

**Linux**：
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### 下载模型

```bash
# 下载模型（首次使用需要下载）
ollama pull llama3.2:3b
ollama pull qwen2.5:7b
ollama pull deepseek-coder:6.7b
```

#### 启动 Ollama 服务

```bash
# 启动服务
ollama serve

# 验证服务运行
curl http://localhost:11434/api/tags
```

#### 配置参数

```json
{
  "provider": "ollama",
  "model": "llama3.2:3b",
  "baseUrl": "http://localhost:11434",
  "maxTokens": 8192,
  "temperature": 0.7,
  "timeout": 60,
  "systemPrompt": "你是一个专业的终端助手。"
}
```

**推荐模型**：
- `llama3.2:3b` - 轻量级，适合日常使用
- `qwen2.5:7b` - 中文能力强
- `deepseek-coder:6.7b` - 编程能力强

### 5. 腾讯元器配置

#### 获取配置信息

1. 访问 [腾讯元器](https://yuanqi.tencent.com)
2. 创建智能体
3. 获取 Assistant ID 和 Token

#### 配置参数

```json
{
  "provider": "hunyuan",
  "hunyuanAssistantId": "assistant-xxxxx",
  "hunyuanToken": "your-token-here",
  "timeout": 30
}
```

## 🧪 配置验证

### 连接测试

配置完成后，请进行连接测试：

1. 在设置页面点击 "测试连接" 按钮
2. 等待测试结果
3. 如果成功，会显示 ✅ "连接成功"
4. 如果失败，会显示具体错误信息

### 常见配置问题

#### OpenAI 相关

**问题：API Key 无效**
```
Error: API 请求失败: 401 Invalid API key
```
**解决方案**：
- 检查 API Key 是否正确复制
- 确认账户有可用额度
- 检查 API Key 是否过期

**问题：模型不存在**
```
Error: API 请求失败: 400 Model not found
```
**解决方案**：
- 使用正确的模型名称
- 确认账户有权限使用该模型

#### Claude 相关

**问题：认证失败**
```
Error: API 请求失败: 401 Authentication failed
```
**解决方案**：
- 检查 API Key 格式是否为 `sk-ant-api03-...`
- 确认账户状态正常

#### Ollama 相关

**问题：无法连接**
```
Error: fetch failed
```
**解决方案**：
- 确认 Ollama 服务正在运行
- 检查端口 11434 是否被占用
- 验证模型是否已下载

**问题：模型未找到**
```
Error: model not found
```
**解决方案**：
```bash
# 列出已安装的模型
ollama list

# 下载模型
ollama pull llama3.2:3b
```

## 🔧 高级配置

### 自定义 Base URL

如果使用代理或私有部署：

```json
{
  "provider": "openai",
  "apiKey": "your-key",
  "model": "gpt-3.5-turbo",
  "baseUrl": "https://your-proxy.com/v1",
  "timeout": 30
}
```

### 系统提示词定制

根据使用场景定制提示词：

**通用助手**：
```
你是一个专业的AI助手，擅长回答各种问题并提供有用的建议。
```

**编程助手**：
```
你是一个专业的编程助手，擅长代码调试、算法优化和技术问题解决。请提供清晰的代码示例和详细的解释。
```

**运维助手**：
```
你是一个专业的系统运维助手，擅长Linux系统管理、网络配置和故障排除。请提供具体的命令和操作步骤。
```

### 性能优化配置

**高性能配置**（适合本地 Ollama）：
```json
{
  "maxTokens": 8192,
  "temperature": 0.5,
  "timeout": 120
}
```

**节省资源配置**（适合API服务）：
```json
{
  "maxTokens": 2048,
  "temperature": 0.7,
  "timeout": 30
}
```

## 🔐 安全注意事项

### API Key 安全

1. **不要分享 API Key**
2. **定期轮换密钥**
3. **监控使用量和账单**
4. **使用环境变量**（高级用户）

### 数据隐私

- 聊天记录仅存储在本地
- 不会上传到第三方服务器
- 定期清理不需要的会话记录

## 📝 配置文件位置

插件配置存储在 Tabby 配置文件中：

| 操作系统 | 配置文件路径 |
|----------|-------------|
| Windows | `%APPDATA%\tabby\config.yaml` |
| macOS | `~/Library/Application Support/tabby/config.yaml` |
| Linux | `~/.config/tabby/config.yaml` |

## 🆘 故障排除

### 插件未加载

1. **检查插件目录**：确认文件在正确位置
2. **检查权限**：确保 Tabby 有读取权限
3. **重启 Tabby**：完全关闭后重新启动
4. **查看日志**：按 F12 打开开发者工具查看错误

### 功能异常

1. **清除缓存**：删除插件目录重新安装
2. **检查版本兼容性**：确认 Tabby 版本支持
3. **查看控制台**：按 F12 查看错误信息
4. **重置配置**：删除配置后重新配置

### 性能问题

1. **减少 maxTokens**：降低单次请求的最大令牌数
2. **增加超时时间**：网络较慢时增加 timeout
3. **清理会话历史**：删除不需要的旧会话
4. **关闭多终端模式**：在不需要时使用单终端模式

如果问题仍然存在，请在 [GitHub Issues](https://github.com/your-username/tabby-ai-assistant/issues) 中报告。