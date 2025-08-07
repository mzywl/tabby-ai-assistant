import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { AIService } from '../services/ai.service'

@Component({
  template: `
    <div class="form-line">
      <div class="header">
        <div class="title">AI 助手配置</div>
        <div *ngIf="showSaveStatus" class="save-status">
          <span *ngIf="saveStatus === 'saved'" class="text-success">✅ 已保存</span>
          <span *ngIf="saveStatus === 'error'" class="text-danger">❌ 保存失败</span>
        </div>
      </div>
      <div class="body">
        <!-- AI 服务配置 -->
        <div class="form-group">
          <h5>AI 服务配置</h5>
        </div>
        
        <div class="form-group">
          <label>AI 提供商</label>
          <select class="form-control" [(ngModel)]="config.store.aiAssistant.provider" (ngModelChange)="onProviderChange(); saveConfig()">
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="ollama">Ollama (本地)</option>
            <option value="hunyuan">腾讯元器 (Hunyuan)</option>
          </select>
        </div>

        <!-- 通用配置 -->
        <div class="form-group" *ngIf="config.store.aiAssistant.provider !== 'hunyuan'">
          <label>API Key</label>
          <input type="password" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.apiKey" 
                 (ngModelChange)="saveConfig()"
                 [placeholder]="getApiKeyPlaceholder()">
          <small class="form-text text-muted" *ngIf="config.store.aiAssistant.provider === 'ollama'">
            Ollama 本地运行无需 API Key
          </small>
        </div>

        <!-- 腾讯元器专用配置 -->
        <ng-container *ngIf="config.store.aiAssistant.provider === 'hunyuan'">
          <div class="form-group">
            <label>智能体ID (Assistant ID)</label>
            <input type="text" class="form-control" 
                   [(ngModel)]="config.store.aiAssistant.hunyuanAssistantId" 
                   (ngModelChange)="saveConfig()"
                   placeholder="请输入智能体ID，如：x9IcxKPbGcUt">
            <small class="form-text text-muted">在腾讯元器中创建智能体后获得的ID</small>
          </div>

          <div class="form-group">
            <label>API Token</label>
            <input type="password" class="form-control" 
                   [(ngModel)]="config.store.aiAssistant.hunyuanToken" 
                   (ngModelChange)="saveConfig()"
                   placeholder="请输入API调用Token">
            <small class="form-text text-muted">在智能体设置中点击"调用API"获取Token</small>
          </div>
        </ng-container>

        <div class="form-group">
          <label>模型</label>
          <select class="form-control" [(ngModel)]="config.store.aiAssistant.model" (ngModelChange)="saveConfig()">
            <ng-container *ngIf="config.store.aiAssistant.provider === 'openai'">
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="chatgpt-4o-latest">ChatGPT-4o-latest</option>
              <option value="gpt-4-turbo-preview">GPT-4-Turbo-Preview</option>
              <option value="gpt-4o-mini">GPT-4o-Mini</option>
              <option value="gpt-4-turbo">GPT-4-Turbo</option>
            </ng-container>
            <ng-container *ngIf="config.store.aiAssistant.provider === 'claude'">
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              <option value="claude-3-opus-20240229">Claude 3 Opus</option>
            </ng-container>
            <ng-container *ngIf="config.store.aiAssistant.provider === 'ollama'">
              <option value="llama3.2">Llama 3.2</option>
              <option value="llama3.1">Llama 3.1</option>
              <option value="qwen2.5">Qwen 2.5</option>
              <option value="gemma2">Gemma 2</option>
              <option value="phi3">Phi 3</option>
            </ng-container>
            <ng-container *ngIf="config.store.aiAssistant.provider === 'hunyuan'">
              <option value="hunyuan-lite">混元-Lite</option>
              <option value="hunyuan-standard">混元-Standard</option>
              <option value="hunyuan-pro">混元-Pro</option>
              <option value="hunyuan-turbo">混元-Turbo</option>
            </ng-container>
          </select>
        </div>

        <div class="form-group">
          <label>API 地址 / 代理</label>
          <input type="text" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.baseUrl" 
                 (ngModelChange)="saveConfig()"
                 [placeholder]="getBaseUrlPlaceholder()">
          <small class="form-text text-muted">
            留空使用默认地址，可设置代理服务器或 Ollama 本地地址
          </small>
        </div>

        <hr>

        <!-- 行为配置 -->
        <div class="form-group">
          <h5>行为配置</h5>
        </div>

        <div class="form-group">
          <div class="form-check">
            <input type="checkbox" class="form-check-input" 
                   [(ngModel)]="config.store.aiAssistant.enableSelectedTextContext"
                   (ngModelChange)="saveConfig()"
                   id="enableSelectedTextContext">
            <label class="form-check-label" for="enableSelectedTextContext">
              启用选中文本上下文
            </label>
          </div>
          <small class="form-text text-muted">自动检测选中文本并作为上下文发送给AI</small>
        </div>

        <div class="form-group">
          <label>最大令牌数: <span [textContent]="config.store.aiAssistant.maxTokens"></span></label>
          <input type="range" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.maxTokens"
                 (ngModelChange)="saveConfig()"
                 min="1000" max="200000" step="1000">
          <small class="form-text text-muted">控制 AI 回复的最大长度，默认128K适合大多数场景</small>
        </div>

        <div class="form-group">
          <label>创造性: <span [textContent]="config.store.aiAssistant.temperature"></span></label>
          <input type="range" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.temperature"
                 (ngModelChange)="saveConfig()"
                 min="0" max="1" step="0.1">
          <small class="form-text text-muted">0.0 = 保守准确，1.0 = 创造性</small>
        </div>

        <hr>

        <!-- 提示词配置 -->
        <div class="form-group">
          <h5>提示词配置</h5>
        </div>

        <div class="form-group">
          <label>系统提示词</label>
          <textarea class="form-control" rows="3"
                    [(ngModel)]="config.store.aiAssistant.systemPrompt"
                    (ngModelChange)="saveConfig()"
                    placeholder="定义 AI 助手的角色和行为..."></textarea>
          <small class="form-text text-muted">定义 AI 助手的角色、专业领域和回答风格</small>
        </div>

        <div class="form-group">
          <label>上下文模板</label>
          <textarea class="form-control" rows="2"
                    [(ngModel)]="config.store.aiAssistant.contextTemplate"
                    (ngModelChange)="saveConfig()"
                    placeholder="使用 {{ '{' }}context{{ '}' }} 和 {{ '{' }}query{{ '}' }} 占位符..."></textarea>
          <small class="form-text text-muted">
            使用 {{ '{' }}context{{ '}' }} 和 {{ '{' }}query{{ '}' }} 作为占位符，控制选中内容和用户问题的组合方式
          </small>
        </div>

        <hr>

        <!-- 高级配置 -->
        <div class="form-group">
          <h5>高级配置</h5>
        </div>

        <div class="form-group">
          <label>请求超时 (秒): <span [textContent]="config.store.aiAssistant.timeout"></span></label>
          <input type="range" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.timeout"
                 (ngModelChange)="saveConfig()"
                 min="10" max="120" step="5">
        </div>

        <div class="form-group">
          <label>重试次数: <span [textContent]="config.store.aiAssistant.retryCount"></span></label>
          <input type="range" class="form-control" 
                 [(ngModel)]="config.store.aiAssistant.retryCount"
                 (ngModelChange)="saveConfig()"
                 min="0" max="3" step="1">
        </div>

        <!-- 测试连接 -->
        <div class="form-group">
          <button class="btn btn-primary" (click)="testConnection()" [disabled]="testing">
            <span [textContent]="testing ? '测试中...' : '测试连接'"></span>
          </button>
          <span class="ml-2" *ngIf="testResult" [textContent]="testResult"></span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .save-status {
      font-size: 14px;
      margin-left: 10px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `]
})
export class AIAssistantSettingsComponent {
  testing = false
  testResult = ''
  showSaveStatus = false
  saveStatus: 'saved' | 'error' | '' = ''

  constructor(public config: ConfigService, private aiService: AIService) {}

  getApiKeyPlaceholder(): string {
    switch (this.config.store.aiAssistant.provider) {
      case 'openai': return '请输入 OpenAI API Key (sk-...)'
      case 'claude': return '请输入 Claude API Key'
      case 'ollama': return 'Ollama 本地运行无需 API Key'
      case 'hunyuan': return '腾讯元器使用专用配置'
      default: return '请输入 API Key'
    }
  }

  getBaseUrlPlaceholder(): string {
    switch (this.config.store.aiAssistant.provider) {
      case 'openai': return '留空或设置代理地址 (如: https://api.openai.com/v1)'
      case 'claude': return '留空或设置代理地址 (如: https://api.anthropic.com)'
      case 'ollama': return 'Ollama 地址 (如: http://localhost:11434)'
      case 'hunyuan': return '留空使用默认腾讯云地址'
      default: return '留空使用默认地址'
    }
  }

  onProviderChange(): void {
    // 切换提供商时重置模型到默认值
    const provider = this.config.store.aiAssistant.provider
    if (provider === 'openai') {
      this.config.store.aiAssistant.model = 'gpt-4o'
    } else if (provider === 'claude') {
      this.config.store.aiAssistant.model = 'claude-3-5-sonnet-20241022'
    } else if (provider === 'ollama') {
      this.config.store.aiAssistant.model = 'llama3.2'
    } else if (provider === 'hunyuan') {
      this.config.store.aiAssistant.model = 'hunyuan-lite'
      // 初始化腾讯元器配置的默认值
      if (!this.config.store.aiAssistant.hunyuanAssistantId) {
        this.config.store.aiAssistant.hunyuanAssistantId = ''
      }
      if (!this.config.store.aiAssistant.hunyuanToken) {
        this.config.store.aiAssistant.hunyuanToken = ''
      }
    }
  }

  saveConfig(): void {
    try {
      // 保存配置到 Tabby 的配置系统
      this.config.save()
      this.showSaveStatus = true
      this.saveStatus = 'saved'
      
      // 3秒后隐藏状态
      setTimeout(() => {
        this.showSaveStatus = false
        this.saveStatus = ''
      }, 3000)
      
      console.log('AI助手配置已保存:', this.config.store.aiAssistant)
    } catch (error) {
      console.error('保存配置失败:', error)
      this.showSaveStatus = true
      this.saveStatus = 'error'
      
      setTimeout(() => {
        this.showSaveStatus = false
        this.saveStatus = ''
      }, 5000)
    }
  }

  async testConnection(): Promise<void> {
    this.testing = true
    this.testResult = ''
    
    try {
      await this.aiService.testConnection()
      this.testResult = '✅ 连接成功'
    } catch (error) {
      this.testResult = `❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}`
    } finally {
      this.testing = false
    }
  }
}