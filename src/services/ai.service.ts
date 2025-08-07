import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { ContextService, ContextData } from './context.service'

// 消息接口
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{type: string, text?: string, image_url?: {url: string}}>
  timestamp?: Date
}

// 会话接口
interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: Date
  title: string
}

@Injectable()
export class AIService {
  private currentSession: ChatSession | null = null
  private sessions: ChatSession[] = []

  constructor(
    private config: ConfigService,
    private contextService: ContextService
  ) {
    // 创建默认会话
    this.createNewSession()
  }

  isConfigured(): boolean {
    const config = this.config.store.aiAssistant
    if (!config) return false
    
    // Ollama 不需要 API Key
    if (config.provider === 'ollama') {
      return !!config.model
    }
    
    // 腾讯元器需要 智能体ID 和 token
    if (config.provider === 'hunyuan') {
      return !!(config.hunyuanAssistantId && config.hunyuanToken)
    }
    
    // 其他提供商需要 API Key
    return !!(config.apiKey && config.model)
  }

  // 会话管理方法
  createNewSession(title?: string): ChatSession {
    const session: ChatSession = {
      id: Date.now().toString(),
      messages: [],
      createdAt: new Date(),
      title: title || `新会话 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    }
    
    this.sessions.push(session)
    this.currentSession = session
    
    // 限制会话数量，最多保留10个会话
    if (this.sessions.length > 10) {
      this.sessions = this.sessions.slice(-10)
    }
    
    console.log('[AI助手] 创建新会话:', session.title)
    return session
  }

  getCurrentSession(): ChatSession | null {
    return this.currentSession
  }

  getAllSessions(): ChatSession[] {
    return this.sessions
  }

  switchToSession(sessionId: string): boolean {
    const session = this.sessions.find(s => s.id === sessionId)
    if (session) {
      this.currentSession = session
      console.log('[AI助手] 切换到会话:', session.title)
      return true
    }
    return false
  }

  deleteSession(sessionId: string): boolean {
    const index = this.sessions.findIndex(s => s.id === sessionId)
    if (index >= 0) {
      const deletedSession = this.sessions.splice(index, 1)[0]
      
      // 如果删除的是当前会话，切换到最新的会话或创建新会话
      if (this.currentSession?.id === sessionId) {
        if (this.sessions.length > 0) {
          this.currentSession = this.sessions[this.sessions.length - 1]
        } else {
          this.createNewSession()
        }
      }
      
      console.log('[AI助手] 删除会话:', deletedSession.title)
      return true
    }
    return false
  }

  clearAllSessions(): void {
    this.sessions = []
    this.createNewSession()
    console.log('[AI助手] 清除所有会话')
  }

  async sendQuery(query: string, contextData?: ContextData, attachments?: File[]): Promise<string> {
    const config = this.config.store.aiAssistant
    if (!config) {
      throw new Error('AI助手未配置')
    }

    if (!this.currentSession) {
      this.createNewSession()
    }

    // 如果没有传入上下文数据，则智能分析上下文
    if (!contextData) {
      contextData = await this.contextService.analyzeContext(query)
    }
    
    // 构建用户消息内容
    let userContent: string | Array<{type: string, text?: string, image_url?: {url: string}}> = query
    
    // 如果有上下文数据，添加到查询中
    if (contextData.selectedText) {
      const contextQuery = this.contextService.buildQueryWithContext(query, contextData)
      userContent = contextQuery
    }
    
    // 如果有图片附件，构建多模态内容
    if (attachments && attachments.length > 0) {
      const contentArray: Array<{type: string, text?: string, image_url?: {url: string}}> = [
        { type: 'text', text: typeof userContent === 'string' ? userContent : query }
      ]
      
      // 添加图片附件
      for (const file of attachments) {
        if (file.type.startsWith('image/')) {
          const imageUrl = await this.fileToDataUrl(file)
          contentArray.push({
            type: 'image_url',
            image_url: { url: imageUrl }
          })
        }
      }
      
      userContent = contentArray
    }

    // 添加用户消息到当前会话
    const userMessage: ChatMessage = {
      role: 'user',
      content: userContent,
      timestamp: new Date()
    }
    this.currentSession!.messages.push(userMessage)

    // 构建请求
    const requestBody = this.buildRequestWithHistory(config)
    const url = this.getApiUrl(config)
    const headers = this.getHeaders(config)

    try {
      // 创建带超时的请求
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout * 1000)
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 请求失败: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const aiResponse = this.extractResponse(data, config.provider)
      
      // 添加AI回复到当前会话
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }
      this.currentSession!.messages.push(assistantMessage)
      
      // 自动更新会话标题（使用第一个用户消息的前20个字符）
      if (this.currentSession!.messages.filter(m => m.role === 'user').length === 1) {
        const firstUserMessage = typeof userContent === 'string' ? userContent : query
        this.currentSession!.title = firstUserMessage.length > 20 
          ? firstUserMessage.substring(0, 20) + '...' 
          : firstUserMessage
      }
      
      return aiResponse
    } catch (error) {
      // 移除失败的用户消息
      if (this.currentSession!.messages.length > 0 && 
          this.currentSession!.messages[this.currentSession!.messages.length - 1].role === 'user') {
        this.currentSession!.messages.pop()
      }
      
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接或增加超时时间')
      }
      throw error
    }
  }

  // 将文件转换为Data URL
  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async testConnection(): Promise<void> {
    // 发送一个简单的测试请求
    await this.sendQuery('测试连接')
  }

  private buildRequestWithHistory(config: any): any {
    const systemPrompt = config.systemPrompt || '你是一个专业的AI助手。'
    
    if (!this.currentSession) {
      throw new Error('没有当前会话')
    }

    // 构建消息历史，保留最近的消息以控制上下文长度
    const maxMessages = Math.floor((config.maxTokens || 128000) * 0.8 / 100) // 估算消息数量
    const recentMessages = this.currentSession.messages.slice(-maxMessages)
    
    switch (config.provider) {
      case 'openai':
        const openaiMessages = [
          { role: 'system', content: systemPrompt }
        ]
        
        // 添加历史消息
        for (const msg of recentMessages) {
          if (msg.role !== 'system') {
            openaiMessages.push({
              role: msg.role,
              content: msg.content
            })
          }
        }
        
        return {
          model: config.model,
          messages: openaiMessages,
          max_tokens: config.maxTokens || 128000,
          temperature: config.temperature || 0.7
        }
      
      case 'claude':
        const claudeMessages = []
        
        // 添加历史消息
        for (const msg of recentMessages) {
          if (msg.role !== 'system') {
            claudeMessages.push({
              role: msg.role,
              content: msg.content
            })
          }
        }
        
        return {
          model: config.model,
          system: systemPrompt,
          messages: claudeMessages,
          max_tokens: config.maxTokens || 128000,
          temperature: config.temperature || 0.7
        }
      
      case 'ollama':
        // Ollama 处理对话历史的方式
        let conversationText = systemPrompt + '\n\n'
        
        for (const msg of recentMessages) {
          const role = msg.role === 'user' ? '用户' : '助手'
          const content = typeof msg.content === 'string' ? msg.content : 
            Array.isArray(msg.content) ? msg.content.find(c => c.type === 'text')?.text || '' : ''
          conversationText += `${role}: ${content}\n\n`
        }
        
        conversationText += '助手:'
        
        return {
          model: config.model,
          prompt: conversationText,
          stream: false,
          options: {
            temperature: config.temperature || 0.7,
            num_predict: config.maxTokens || 8192
          }
        }
      
      case 'hunyuan':
        const hunyuanMessages = []
        
        // 添加历史消息 - 使用腾讯元器要求的格式
        for (const msg of recentMessages) {
          const content = typeof msg.content === 'string' ? msg.content : 
            Array.isArray(msg.content) ? msg.content.find(c => c.type === 'text')?.text || '' : ''
          
          hunyuanMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: [
              {
                type: 'text',
                text: content
              }
            ]
          })
        }
        
        return {
          assistant_id: config.hunyuanAssistantId,
          user_id: 'tabby_user',
          stream: false,
          messages: hunyuanMessages
        }
      
      default:
        throw new Error(`不支持的AI提供商: ${config.provider}`)
    }
  }

  private buildRequest(query: string, config: any): any {
    const systemPrompt = config.systemPrompt || '你是一个专业的AI助手。'
    
    switch (config.provider) {
      case 'openai':
        return {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature
        }
      
      case 'claude':
        return {
          model: config.model,
          system: systemPrompt,
          messages: [
            { role: 'user', content: query }
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature
        }
      
      case 'ollama':
        return {
          model: config.model,
          prompt: `${systemPrompt}\n\n用户: ${query}\n\n助手:`,
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens
          }
        }
      
      case 'hunyuan':
        return {
          assistant_id: config.hunyuanAssistantId,
          user_id: 'tabby_user',
          stream: false,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: query
                }
              ]
            }
          ]
        }
      
      default:
        throw new Error(`不支持的AI提供商: ${config.provider}`)
    }
  }

  private getApiUrl(config: any): string {
    if (config.baseUrl) {
      return config.baseUrl + this.getEndpoint(config.provider)
    }

    switch (config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions'
      case 'claude':
        return 'https://api.anthropic.com/v1/messages'
      case 'ollama':
        return 'http://localhost:11434/api/generate'
      case 'hunyuan':
        return 'https://yuanqi.tencent.com/openapi/v1/agent/chat/completions'
      default:
        throw new Error(`不支持的AI提供商: ${config.provider}`)
    }
  }

  private getEndpoint(provider: string): string {
    switch (provider) {
      case 'openai':
        return '/chat/completions'
      case 'claude':
        return '/v1/messages'
      case 'ollama':
        return '/api/generate'
      case 'hunyuan':
        return '/'
      default:
        return ''
    }
  }

  private getHeaders(config: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    switch (config.provider) {
      case 'openai':
        if (config.apiKey) {
          headers['Authorization'] = `Bearer ${config.apiKey}`
        }
        break
      
      case 'claude':
        if (config.apiKey) {
          headers['x-api-key'] = config.apiKey
          headers['anthropic-version'] = '2023-06-01'
        }
        break
      
      case 'ollama':
        // Ollama 本地不需要认证头
        break
      
      case 'hunyuan':
        // 腾讯元器使用Bearer token认证
        if (config.hunyuanToken) {
          headers['X-Source'] = 'openapi'
          headers['Authorization'] = `Bearer ${config.hunyuanToken}`
        }
        break
    }

    return headers
  }

  private extractResponse(data: any, provider: string): string {
    switch (provider) {
      case 'openai':
        return data.choices?.[0]?.message?.content || '无回复'
      
      case 'claude':
        return data.content?.[0]?.text || '无回复'
      
      case 'ollama':
        return data.response || '无回复'
      
      case 'hunyuan':
        // 根据文档，响应格式为 choices[0].message.content
        return data.choices?.[0]?.message?.content || '无回复'
      
      default:
        throw new Error(`不支持的AI提供商: ${provider}`)
    }
  }
}