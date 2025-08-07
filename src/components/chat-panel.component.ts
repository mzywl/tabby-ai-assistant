import { Component, Injector, OnDestroy } from '@angular/core'
import { BaseTabComponent, NotificationsService } from 'tabby-core'
import { Subscription } from 'rxjs'
import { AIService } from '../services/ai.service'
import { ContextService, SelectedTextData, SelectionMode } from '../services/context.service'

// 聊天消息接口
interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

// AI 聊天面板组件
@Component({
  template: `
    <div class="ai-chat-panel">
      <div class="chat-header">
        <h5><i class="fas fa-robot"></i> AI 助手</h5>
        <button class="btn btn-sm btn-outline-secondary" (click)="clearHistory()">
          <i class="fas fa-trash"></i> 清除历史
        </button>
      </div>
      
      <div class="chat-messages" #messagesContainer>
        <div *ngFor="let message of messages" 
             [class]="message.isUser ? 'message user-message' : 'message ai-message'">
          <div class="message-content">
            <div class="message-text" [textContent]="message.content"></div>
            <div class="message-time" [textContent]="formatTime(message.timestamp)"></div>
          </div>
        </div>
        <div *ngIf="isLoading" class="message ai-message">
          <div class="message-content">
            <div class="message-text">
              <i class="fas fa-spinner fa-spin"></i> AI 正在思考中...
            </div>
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <!-- 选择模式控制 -->
        <div class="selection-mode-control">
          <div class="mode-buttons">
            <button 
              class="btn btn-sm" 
              [class.btn-primary]="selectionMode === 'current'"
              [class.btn-outline-secondary]="selectionMode !== 'current'"
              (click)="setSelectionMode('current')"
              title="只使用当前终端的选中内容">
              <i class="fas fa-terminal"></i> 当前终端
            </button>
            <button 
              class="btn btn-sm" 
              [class.btn-primary]="selectionMode === 'multiple'"
              [class.btn-outline-secondary]="selectionMode !== 'multiple'"
              (click)="setSelectionMode('multiple')"
              title="使用所有终端的选中内容">
              <i class="fas fa-layer-group"></i> 多终端
            </button>
            <button 
              class="btn btn-sm" 
              [class.btn-primary]="selectionMode === 'none'"
              [class.btn-outline-secondary]="selectionMode !== 'none'"
              (click)="setSelectionMode('none')"
              title="不使用任何选中内容">
              <i class="fas fa-ban"></i> 不选择
            </button>
          </div>
          <div class="selection-info" *ngIf="selectedTexts.length > 0 && selectionMode !== 'none'">
            <span class="text-muted">
              <i class="fas fa-info-circle"></i>
              {{ getSelectionInfo() }}
            </span>
          </div>
        </div>

        <!-- 选中文本显示区域 -->
        <div *ngIf="selectedTexts.length > 0 && selectionMode !== 'none'" class="selected-texts-container">
          <div *ngFor="let selectedText of selectedTexts; let i = index" 
               class="selected-text-item" 
               [class.collapsed]="selectedText.isCollapsed">
            <div class="selected-text-header" (click)="toggleSelectedTextCollapse(selectedText.terminalId)">
              <span class="selected-text-label">
                <i class="fas fa-quote-left"></i>
                {{ selectedText.source }} ({{ selectedText.text.length }} 字符)
              </span>
              <div class="selected-text-actions">
                <button class="btn btn-sm btn-icon" 
                        (click)="toggleSelectedTextCollapse(selectedText.terminalId); $event.stopPropagation()"
                        [title]="selectedText.isCollapsed ? '展开' : '折叠'">
                  <i [class]="selectedText.isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'"></i>
                </button>
                <button class="btn btn-sm btn-icon btn-close" 
                        (click)="clearSelectedText(selectedText.terminalId); $event.stopPropagation()"
                        title="移除此选中内容">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div class="selected-text-content" *ngIf="!selectedText.isCollapsed">
              <pre class="selected-text-preview">{{ selectedText.text }}</pre>
              <div class="selected-text-meta">
                时间: {{ formatTime(selectedText.timestamp) }}
              </div>
            </div>
          </div>
        </div>

        <div class="input-group">
          <textarea 
            class="form-control" 
            [(ngModel)]="currentMessage" 
            (keydown)="onKeyDown($event)"
            placeholder="输入您的问题..." 
            rows="2"
            [disabled]="isLoading"></textarea>
          <div class="input-group-append">
            <button 
              class="btn btn-primary" 
              (click)="sendMessage()" 
              [disabled]="!currentMessage.trim() || isLoading">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-chat-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--theme-bg-color);
    }
    
    .chat-header {
      padding: 10px 15px;
      border-bottom: 1px solid var(--theme-border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--theme-bg-color);
    }
    
    .chat-header h5 {
      margin: 0;
      color: var(--theme-text-color);
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      background: var(--theme-bg-color);
    }
    
    .message {
      margin-bottom: 15px;
      max-width: 80%;
    }
    
    .user-message {
      margin-left: auto;
    }
    
    .user-message .message-content {
      background: var(--theme-color-primary);
      color: white;
      border-radius: 18px 18px 5px 18px;
    }
    
    .ai-message .message-content {
      background: var(--theme-bg-secondary-color);
      color: var(--theme-text-color);
      border-radius: 18px 18px 18px 5px;
      border: 1px solid var(--theme-border-color);
    }
    
    .message-content {
      padding: 10px 15px;
      word-wrap: break-word;
    }
    
    .message-text {
      margin-bottom: 5px;
      line-height: 1.4;
    }
    
    .message-time {
      font-size: 11px;
      opacity: 0.7;
    }
    
    .chat-input {
      padding: 15px;
      border-top: 1px solid var(--theme-border-color);
      background: var(--theme-bg-color);
    }

    /* 选择模式控制样式 */
    .selection-mode-control {
      margin-bottom: 10px;
      padding: 8px;
      background: var(--theme-bg-secondary-color);
      border-radius: 6px;
      border: 1px solid var(--theme-border-color);
    }

    .mode-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    .mode-buttons .btn {
      flex: 1;
      font-size: 12px;
      padding: 4px 8px;
      transition: all 0.2s ease;
    }

    .selection-info {
      font-size: 11px;
      text-align: center;
    }

    /* 多终端选中文本容器样式 */
    .selected-texts-container {
      margin-bottom: 10px;
    }

    .selected-text-item {
      margin-bottom: 8px;
      border: 1px solid var(--theme-border-color);
      border-radius: 6px;
      background: var(--theme-bg-secondary-color);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .selected-text-item:last-child {
      margin-bottom: 0;
    }

    .selected-text-item.collapsed {
      background: var(--theme-bg-color);
    }

    .selected-text-header {
      padding: 6px 10px;
      background: var(--theme-bg-tertiary-color, var(--theme-bg-secondary-color));
      border-bottom: 1px solid var(--theme-border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
    }

    .selected-text-header:hover {
      background: var(--theme-bg-hover-color, rgba(255, 255, 255, 0.05));
    }

    .selected-text-label {
      color: var(--theme-text-color);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .selected-text-label i {
      color: var(--theme-color-primary);
    }

    .selected-text-actions {
      display: flex;
      gap: 4px;
    }

    .selected-text-content {
      padding: 10px;
      animation: slideDown 0.3s ease-out;
    }

    .selected-text-preview {
      background: var(--theme-bg-color);
      border: 1px solid var(--theme-border-color);
      border-radius: 4px;
      padding: 8px;
      margin: 0 0 6px 0;
      max-height: 120px;
      overflow-y: auto;
      font-family: var(--font-family-mono, 'Consolas', 'Monaco', monospace);
      font-size: 11px;
      line-height: 1.4;
      color: var(--theme-text-color);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .selected-text-meta {
      font-size: 10px;
      color: var(--theme-text-muted-color, rgba(255, 255, 255, 0.6));
      border-top: 1px solid var(--theme-border-color);
      padding-top: 6px;
    }

    /* 通用按钮样式 */
    .btn-icon {
      width: 20px;
      height: 20px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--theme-text-color);
      border-radius: 3px;
      transition: all 0.2s ease;
      font-size: 10px;
    }

    .btn-icon:hover {
      background: var(--theme-bg-hover-color, rgba(255, 255, 255, 0.1));
      color: var(--theme-color-primary);
    }

    .btn-close {
      color: var(--theme-color-danger, #dc3545);
    }

    .btn-close:hover {
      background: rgba(var(--theme-color-danger-rgb, 220, 53, 69), 0.1);
      color: var(--theme-color-danger, #dc3545);
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
      }
      to {
        opacity: 1;
        max-height: 200px;
        padding-top: 10px;
        padding-bottom: 10px;
      }
    }
    
    .chat-input textarea {
      resize: none;
      background: var(--theme-bg-secondary-color);
      border: 1px solid var(--theme-border-color);
      color: var(--theme-text-color);
    }
    
    .chat-input textarea:focus {
      border-color: var(--theme-color-primary);
      box-shadow: 0 0 0 0.2rem rgba(var(--theme-color-primary-rgb), 0.25);
    }
    
    .btn-primary {
      background-color: var(--theme-color-primary);
      border-color: var(--theme-color-primary);
    }
    
    .btn-primary:hover {
      background-color: var(--theme-color-primary);
      border-color: var(--theme-color-primary);
      opacity: 0.8;
    }
  `]
})
export class AIChatPanelComponent extends BaseTabComponent implements OnDestroy {
  messages: ChatMessage[] = []
  currentMessage = ''
  isLoading = false
  selectedTexts: SelectedTextData[] = []
  selectionMode: SelectionMode = 'current'

  private selectedTextsSubscription?: Subscription
  private selectionModeSubscription?: Subscription

  constructor(
    injector: Injector,
    private aiService: AIService,
    private contextService: ContextService,
    private notifications: NotificationsService
  ) {
    super(injector)
  }

  ngOnInit() {
    super.ngOnInit()
    this.setTitle('AI 助手')
    
    // 订阅选中文本变化
    this.selectedTextsSubscription = this.contextService.selectedTexts$.subscribe(
      selectedTexts => {
        this.selectedTexts = selectedTexts
      }
    )

    // 订阅选择模式变化
    this.selectionModeSubscription = this.contextService.selectionMode$.subscribe(
      mode => {
        this.selectionMode = mode
      }
    )
  }

  ngOnDestroy() {
    super.ngOnDestroy()
    if (this.selectedTextsSubscription) {
      this.selectedTextsSubscription.unsubscribe()
    }
    if (this.selectionModeSubscription) {
      this.selectionModeSubscription.unsubscribe()
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.sendMessage()
    }
  }

  clearHistory(): void {
    this.messages = []
  }

  // 选择模式相关方法
  setSelectionMode(mode: SelectionMode): void {
    this.contextService.setSelectionMode(mode)
  }

  getSelectionInfo(): string {
    if (this.selectionMode === 'current') {
      return this.selectedTexts.length > 0 ? `当前终端: ${this.selectedTexts[0].source}` : '当前终端: 无选中内容'
    } else if (this.selectionMode === 'multiple') {
      return `多终端: ${this.selectedTexts.length} 个终端有选中内容`
    }
    return ''
  }

  // 选中文本相关方法
  getSelectedTextPreview(): string {
    return this.contextService.getSelectedTextPreview(100)
  }

  toggleSelectedTextCollapse(terminalId: string): void {
    this.contextService.toggleSelectedTextCollapse(terminalId)
  }

  clearSelectedText(terminalId?: string): void {
    this.contextService.clearSelectedText(terminalId)
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || this.isLoading) return

    if (!this.aiService.isConfigured()) {
      this.notifications.error('请先在设置中配置AI助手')
      return
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: this.currentMessage.trim(),
      isUser: true,
      timestamp: new Date()
    }
    this.messages.push(userMessage)

    const query = this.currentMessage.trim()
    this.currentMessage = ''
    this.isLoading = true

    try {
      // 滚动到底部
      setTimeout(() => this.scrollToBottom(), 100)

      // 使用包含选中文本上下文的查询
      const response = await this.aiService.sendQuery(query)

      // 添加AI回复
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      }
      this.messages.push(aiMessage)

      // 发送成功后根据模式清除选中文本
      if (this.selectionMode === 'current' && this.selectedTexts.length > 0) {
        // 清除当前终端的选中文本
        this.clearSelectedText(this.selectedTexts[0].terminalId)
      } else if (this.selectionMode === 'multiple') {
        // 清除所有选中文本
        this.clearSelectedText()
      }

    } catch (error) {
      // 添加错误消息
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        isUser: false,
        timestamp: new Date()
      }
      this.messages.push(errorMessage)
      
      this.notifications.error('AI查询失败，请检查配置')
    } finally {
      this.isLoading = false
      setTimeout(() => this.scrollToBottom(), 100)
    }
  }

  private scrollToBottom(): void {
    const container = document.querySelector('.chat-messages')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }
}