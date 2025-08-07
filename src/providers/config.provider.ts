import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'

@Injectable()
export class AIAssistantConfigProvider extends ConfigProvider {
  defaults = {
    aiAssistant: {
      // AI 服务配置
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
      baseUrl: '',
      
      // 腾讯元器配置
      hunyuanAppId: '',
      hunyuanSecretId: '',
      hunyuanSecretKey: '',
      hunyuanModel: 'hunyuan-lite',
      hunyuanRegion: 'ap-beijing',
      hunyuanAssistantId: '', // 智能体ID
      hunyuanToken: '', // API调用token
      
      // 行为配置
      enableSelectedTextContext: true,
      maxTokens: 128000,
      temperature: 0.3,
      
      // 提示词配置
      systemPrompt: `你是一个专业的终端AI助手。当用户提问时，请遵循以下规则：

1. **提供具体可执行的命令**：在回答中包含相关的终端命令，用代码块格式包围
2. **命令安全性标识**：为每个命令添加安全级别标识
   - [SAFE] 安全命令：查看、读取、列出等无害操作
   - [CAUTION] 谨慎命令：修改配置、安装软件等需要注意的操作  
   - [DANGER] 危险命令：删除文件、格式化、系统级操作等高风险操作

3. **命令格式规范**：
   \`\`\`bash
   [SAFE] ls -la
   [CAUTION] npm install package-name
   [DANGER] rm -rf /path/to/directory
   \`\`\`

4. **提供详细说明**：解释命令的作用、参数含义、可能的风险和注意事项
5. **给出替代方案**：如果有更安全的替代命令，请一并提供
6. **上下文相关**：根据用户的选中文本和具体环境提供针对性的命令

记住：用户可以直接点击命令来执行，所以请确保命令的准确性和安全性。`,
      contextTemplate: '选中内容:\n{context}\n\n用户问题: {query}',
      
      // 高级配置
      timeout: 30,
      retryCount: 1
    }
  }
  platformDefaults = {}
}