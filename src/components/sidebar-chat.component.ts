import { Component, Injectable, OnDestroy } from '@angular/core'
import { NotificationsService, ConfigService } from 'tabby-core'
import { Subscription } from 'rxjs'
import { AIService } from '../services/ai.service'
import { ContextService, ContextData, SelectedTextData, SelectionMode } from '../services/context.service'
import { CommandExecutorService, CommandSafety, ParsedCommand } from '../services/command-executor.service'

// 聊天消息接口
interface ChatMessage {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  hasContext?: boolean
  contextType?: 'selected'
  contextContent?: string // 添加上下文内容字段，用于导出
  contextSummary?: string // 添加上下文摘要字段，用于显示
  parsedCommands?: ParsedCommand[] // 缓存解析后的命令
}

// AI 侧边栏聊天组件
@Component({
  selector: 'ai-sidebar-chat',
  template: `
    <div class="ai-sidebar-chat" [class.visible]="isVisible">
      <div class="chat-header">
        <h6><i class="fas fa-robot"></i> AI 助手</h6>
        <div class="header-buttons">
          <button class="btn btn-sm btn-outline-light" (click)="createNewSession()" title="新建会话">
            <i class="fas fa-plus"></i>
          </button>
          <button class="btn btn-sm btn-outline-light" (click)="debugCurrentState()" title="调试状态">
            <i class="fas fa-bug"></i>
          </button>
          <button class="btn btn-sm btn-outline-light" (click)="testCommandParsing()" title="测试命令解析">
            <i class="fas fa-code"></i>
          </button>
          <button class="btn btn-sm btn-outline-light" (click)="exportHistory()" title="导出聊天记录">
            <i class="fas fa-download"></i>
          </button>
          <button class="btn btn-sm btn-outline-light" (click)="clearAllSessions()" title="清除所有会话">
            <i class="fas fa-trash"></i>
          </button>
          <button class="btn btn-sm btn-outline-light" (click)="hide()" title="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 会话管理区域 -->
      <div class="session-manager" *ngIf="sessions.length > 1">
        <div class="session-header">
          <span class="session-title">会话列表</span>
          <span class="session-count">{{ sessions.length }} 个会话</span>
        </div>
        <div class="session-tabs">
          <div *ngFor="let session of sessions" 
               class="session-tab"
               [class.active]="currentSession?.id === session.id"
               (click)="switchSession(session.id)">
            <span class="session-name">{{ session.title }}</span>
            <button class="btn-close-session" 
                    (click)="deleteSession(session.id, $event)"
                    title="删除会话">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
      
      <div class="chat-messages" #messagesContainer>
        <div *ngFor="let message of messages" 
             [class]="message.isUser ? 'message user-message' : 'message ai-message'">
          <div class="message-content">
            <div *ngIf="message.hasContext && message.isUser" class="context-indicator">
              <i class="fas fa-link"></i>
              <span>包含选中文本</span>
            </div>
            <div *ngIf="message.contextSummary && message.isUser" class="context-summary">
              <div class="context-header">
                <i class="fas fa-terminal"></i>
                <span>{{ message.contextSummary }}</span>
                <button class="btn btn-sm context-toggle" 
                        (click)="toggleContextContent(message.id)"
                        [title]="isContextExpanded(message.id) ? '折叠内容' : '展开内容'">
                  <i [class]="isContextExpanded(message.id) ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
                </button>
              </div>
              <div *ngIf="isContextExpanded(message.id)" class="context-content">
                <pre class="context-text">{{ message.contextContent }}</pre>
              </div>
            </div>
            <div class="message-text" [innerHTML]="formatMessage(message.content)"></div>
            <div *ngIf="!message.isUser" class="command-blocks">
              <div *ngFor="let command of getMessageCommands(message)" 
                   class="command-block"
                   [style.border-color]="commandExecutor.getSafetyColor(command.safety)">
                <div class="command-header">
                  <span class="safety-badge" 
                        [style.background-color]="commandExecutor.getSafetyColor(command.safety)"
                        [style.color]="command.safety === 'CAUTION' ? '#000' : '#fff'">
                    {{ commandExecutor.getSafetyDescription(command.safety) }}
                  </span>
                  <span class="command-language">{{ command.language || 'bash' }}</span>
                </div>
                <pre class="command-content">{{ command.command }}</pre>
                <div class="command-actions">
                  <button class="btn btn-sm copy-btn" 
                          (click)="copyCommand(command.command)"
                          title="复制命令">
                    <i class="fas fa-copy"></i>
                    复制
                  </button>
                  <button class="btn btn-sm execute-btn" 
                          (click)="executeCommand(command)"
                          [style.background-color]="commandExecutor.getSafetyColor(command.safety)"
                          [style.color]="command.safety === 'CAUTION' ? '#000' : '#fff'"
                          title="执行命令">
                    <i class="fas fa-play"></i>
                    执行
                  </button>
                </div>
              </div>
            </div>
            <div class="message-time" [textContent]="formatTime(message.timestamp)"></div>
          </div>
        </div>
        <div *ngIf="isLoading" class="message ai-message">
          <div class="message-content loading">
            <div class="message-text">
              <i class="fas fa-spinner fa-spin"></i> AI 正在思考中...
            </div>
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <!-- 选择模式控制 - 独立一行 -->
        <div class="selection-mode-control">
          <div class="control-header">
            <span class="control-title">选中文本模式</span>
          </div>
          <div class="mode-buttons">
            <button 
              class="btn btn-sm mode-btn" 
              [class.active]="selectionMode === 'current'"
              (click)="setSelectionMode('current')"
              title="只使用当前终端的选中内容">
              <i class="fas fa-terminal"></i>
              <span>当前</span>
            </button>
            <button 
              class="btn btn-sm mode-btn" 
              [class.active]="selectionMode === 'multiple'"
              (click)="setSelectionMode('multiple')"
              title="使用所有终端的选中内容">
              <i class="fas fa-layer-group"></i>
              <span>多个</span>
            </button>
            <button 
              class="btn btn-sm mode-btn" 
              [class.active]="selectionMode === 'none'"
              (click)="setSelectionMode('none')"
              title="不使用任何选中内容">
              <i class="fas fa-ban"></i>
              <span>禁用</span>
            </button>
          </div>
          <div class="selection-status">
            <span class="status-text">{{ getSelectionInfo() }}</span>
          </div>
        </div>

        <!-- 选中文本显示区域 - 独立一行 -->
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

        <!-- 图片附件显示区域 -->
        <div *ngIf="selectedFiles.length > 0" class="attachments-container">
          <div class="attachments-header">
            <span class="attachments-title">
              <i class="fas fa-paperclip"></i>
              附件 ({{ selectedFiles.length }})
            </span>
            <button class="btn btn-sm btn-outline-danger" 
                    (click)="clearAllAttachments()"
                    title="清除所有附件">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="attachments-list">
            <div *ngFor="let file of selectedFiles; let i = index" class="attachment-item">
              <div class="attachment-info">
                <i class="fas fa-image"></i>
                <span class="attachment-name">{{ file.name }}</span>
                <span class="attachment-size">({{ (file.size / 1024).toFixed(1) }}KB)</span>
              </div>
              <button class="btn-remove-attachment" 
                      (click)="removeAttachment(i)"
                      title="移除附件">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 输入框区域 - 独立一行 -->
        <div class="message-input-area">
          <div class="input-controls">
            <input type="file" 
                   #fileInput
                   accept="image/*"
                   multiple
                   style="display: none"
                   (change)="onFileSelected($event)">
            <button class="btn btn-sm attach-btn" 
                    (click)="fileInput.click()"
                    [disabled]="isLoading"
                    title="上传图片">
              <i class="fas fa-image"></i>
              <span class="attach-text">图片</span>
            </button>
          </div>
          <div class="input-group">
            <textarea 
              class="form-control" 
              [(ngModel)]="currentMessage" 
              (keydown)="onKeyDown($event)"
              placeholder="输入您的问题..." 
              rows="2"
              [disabled]="isLoading"></textarea>
          </div>
          <button 
            class="btn btn-primary send-btn" 
            (click)="sendMessage()" 
            [disabled]="!currentMessage.trim() || isLoading">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-sidebar-chat {
      position: fixed;
      right: -400px;
      top: 48px;
      bottom: 0;
      width: 400px;
      background: #f7f7f7;
      border-left: 1px solid #e5e5e5;
      display: flex;
      flex-direction: column;
      z-index: 1000;
      transition: right 0.3s ease-in-out;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    }
    
    .ai-sidebar-chat.visible {
      right: 0;
    }
    
    .chat-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #2d2d2d;
      min-height: 50px;
    }
    
    .chat-header h6 {
      margin: 0;
      color: white;
      font-weight: 500;
      font-size: 15px;
    }
    
    .header-buttons {
      display: flex;
      gap: 8px;
    }
    
    .header-buttons .btn {
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      background: transparent;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    
    .header-buttons .btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
    }
    
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 12px;
      background: #f7f7f7;
    }
    
    .message {
      margin-bottom: 12px;
      max-width: 80%;
      display: flex;
      flex-direction: column;
    }
    
    .user-message {
      align-self: flex-end;
      max-width: 70%;
      width: fit-content;
      margin-left: auto;
    }
    
    .ai-message {
      align-self: flex-start;
    }
    
    .user-message .message-content {
      background: #95d475;
      color: #000;
      border-radius: 18px 18px 4px 18px;
      position: relative;
      word-wrap: break-word;
      padding: 8px 12px;
      display: inline-block;
      min-width: fit-content;
      max-width: 100%;
    }
    
    
    .ai-message .message-content {
      background: white;
      color: #000;
      border-radius: 18px 18px 18px 4px;
      border: 1px solid #e5e5e5;
      position: relative;
      word-wrap: break-word;
    }
    
    
    .message-content {
      padding: 10px 12px;
      font-size: 14px;
      line-height: 1.4;
      max-width: 100%;
    }
    
    .message-content.loading {
      background: #f0f0f0 !important;
      border: 1px solid #e0e0e0 !important;
    }
    
    .message-text {
      margin-bottom: 4px;
    }
    
    .message-time {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }
    
    .context-indicator {
      font-size: 10px;
      opacity: 0.7;
      margin-bottom: 4px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 10px;
      display: inline-block;
    }
    
    .context-indicator i {
      margin-right: 4px;
    }

    /* 上下文内容显示样式 */
    .context-summary {
      margin-bottom: 8px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .context-header {
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.7);
      cursor: pointer;
      user-select: none;
    }

    .context-header:hover {
      background: rgba(0, 0, 0, 0.15);
    }

    .context-header i {
      color: #95d475;
    }

    .context-header span {
      flex: 1;
      font-weight: 500;
    }

    .context-toggle {
      background: transparent;
      border: none;
      color: rgba(0, 0, 0, 0.5);
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 10px;
      transition: all 0.2s ease;
    }

    .context-toggle:hover {
      background: rgba(0, 0, 0, 0.1);
      color: rgba(0, 0, 0, 0.8);
    }

    .context-content {
      padding: 6px 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      animation: slideDown 0.3s ease-out;
    }

    .context-text {
      background: rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      padding: 6px;
      margin: 0;
      max-height: 120px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 10px;
      line-height: 1.3;
      color: rgba(0, 0, 0, 0.8);
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .user-message .message-time {
      color: #555;
      text-align: right;
    }
    
    .ai-message .message-time {
      color: #999;
      text-align: left;
    }
    
    .chat-input {
      padding: 12px 16px;
      border-top: 1px solid #e5e5e5;
      background: white;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* 输入框区域样式 */
    .message-input-area {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    
    .input-group {
      flex: 1;
    }
    
    .chat-input textarea {
      resize: none;
      background: white;
      border: 1px solid #d9d9d9;
      color: #000;
      font-size: 14px;
      border-radius: 6px;
      padding: 8px 12px;
      transition: border-color 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .chat-input textarea:focus {
      border-color: #95d475;
      outline: none;
      box-shadow: 0 0 0 2px rgba(149, 212, 117, 0.2);
    }
    
    .send-btn {
      background: #95d475;
      border: 1px solid #95d475;
      color: #000;
      padding: 8px 12px;
      border-radius: 6px;
      height: 38px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    
    .send-btn:hover:not(:disabled) {
      background: #7bc955;
      border-color: #7bc955;
    }
    
    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #ccc;
      border-color: #ccc;
    }
    
    /* 滚动条样式 */
    .chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    .chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .chat-messages::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }
    
    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: #999;
    }
    
    /* 加载动画 */
    .fa-spinner {
      color: #999;
      font-size: 14px;
    }
    
    /* 响应式调整 */
    @media (max-width: 480px) {
      .ai-sidebar-chat {
        width: 100%;
        right: -100%;
      }
    }

    /* 选择模式控制样式 */
    .selection-mode-control {
      margin-bottom: 12px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .control-header {
      margin-bottom: 6px;
      text-align: center;
    }

    .control-title {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }

    .mode-buttons {
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
    }

    .mode-btn {
      flex: 1;
      font-size: 10px;
      padding: 6px 4px;
      transition: all 0.2s ease;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-height: 42px;
    }

    .mode-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      color: #fff;
    }

    .mode-btn.active {
      background: #95d475;
      border-color: #95d475;
      color: #000;
      font-weight: 600;
    }

    .mode-btn i {
      font-size: 12px;
    }

    .mode-btn span {
      font-size: 9px;
      line-height: 1;
    }

    .selection-status {
      text-align: center;
      min-height: 16px;
    }

    .status-text {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.7);
      font-style: italic;
    }

    /* 多终端选中文本容器样式 */
    .selected-texts-container {
      margin-bottom: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .selected-text-item {
      margin-bottom: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .selected-text-item:last-child {
      margin-bottom: 0;
    }

    .selected-text-item.collapsed {
      background: rgba(255, 255, 255, 0.02);
    }

    .selected-text-header {
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      font-size: 10px;
    }

    .selected-text-header:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .selected-text-label {
      color: #fff;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .selected-text-label i {
      color: #95d475;
    }

    .selected-text-actions {
      display: flex;
      gap: 2px;
    }

    .selected-text-content {
      padding: 6px;
      animation: slideDown 0.3s ease-out;
    }

    .selected-text-preview {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      padding: 4px;
      margin: 0 0 4px 0;
      max-height: 80px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 9px;
      line-height: 1.3;
      color: #fff;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .selected-text-meta {
      font-size: 8px;
      color: rgba(255, 255, 255, 0.5);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 4px;
    }

    /* 通用按钮样式 */
    .btn-icon {
      width: 16px;
      height: 16px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      border-radius: 2px;
      transition: all 0.2s ease;
      font-size: 8px;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .btn-close {
      color: #ff6b6b;
    }

    .btn-close:hover {
      background: rgba(255, 107, 107, 0.2);
      color: #ff6b6b;
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
        max-height: 100px;
        padding-top: 6px;
        padding-bottom: 6px;
      }
    }

    /* 图片附件容器样式 */
    .attachments-container {
      margin-bottom: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      overflow: hidden;
    }

    .attachments-header {
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }

    .attachments-title {
      color: #fff;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .attachments-title i {
      color: #95d475;
    }

    .attachments-list {
      padding: 4px;
    }

    .attachment-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 6px;
      margin-bottom: 2px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      font-size: 10px;
    }

    .attachment-item:last-child {
      margin-bottom: 0;
    }

    .attachment-info {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #fff;
      flex: 1;
      min-width: 0;
    }

    .attachment-info i {
      color: #95d475;
      flex-shrink: 0;
    }

    .attachment-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .attachment-size {
      color: rgba(255, 255, 255, 0.6);
      flex-shrink: 0;
    }

    .btn-remove-attachment {
      background: none;
      border: none;
      color: #ff6b6b;
      padding: 2px;
      border-radius: 2px;
      font-size: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-remove-attachment:hover {
      background: rgba(255, 107, 107, 0.2);
    }

    /* 输入控件样式 */
    .message-input-area {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .input-controls {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .attach-btn {
      background: #95d475;
      border: 1px solid #95d475;
      color: #000;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      height: 38px;
      min-width: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.2s ease;
      font-weight: 500;
    }

    .attach-btn:hover:not(:disabled) {
      background: #7bc955;
      border-color: #7bc955;
      color: #000;
    }

    .attach-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #ccc;
      border-color: #ccc;
    }

    .attach-btn i {
      font-size: 13px;
    }

    .attach-text {
      font-size: 11px;
      font-weight: 500;
    }

    /* 会话管理样式 */
    .session-manager {
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.1);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .session-title {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }

    .session-count {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
    }

    .session-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .session-tab {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
      min-width: 0;
      max-width: 120px;
    }

    .session-tab:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .session-tab.active {
      background: #95d475;
      border-color: #95d475;
      color: #000;
      font-weight: 500;
    }

    .session-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-close-session {
      background: none;
      border: none;
      color: inherit;
      padding: 0;
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      font-size: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      opacity: 0.7;
    }

    .btn-close-session:hover {
      background: rgba(255, 255, 255, 0.2);
      opacity: 1;
    }

    .session-tab.active .btn-close-session:hover {
      background: rgba(0, 0, 0, 0.2);
    }

    /* 响应式调整 */
    @media (max-width: 480px) {
      .ai-sidebar-chat {
        width: 100%;
        right: -100%;
      }
      
      .attachment-name {
        max-width: 80px;
      }
    }

    /* 命令块样式 */
    .command-blocks {
      margin-top: 8px;
    }

    .command-block {
      margin-bottom: 8px;
      border: 2px solid #ddd;
      border-radius: 6px;
      background: #f8f9fa;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .command-block:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .command-header {
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.05);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }

    .safety-badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }

    .command-language {
      color: #666;
      font-family: 'Consolas', 'Monaco', monospace;
      background: rgba(0, 0, 0, 0.1);
      padding: 2px 4px;
      border-radius: 2px;
    }

    .command-content {
      margin: 0;
      padding: 8px 10px;
      background: #fff;
      border: none;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.4;
      color: #333;
      cursor: pointer;
      transition: background-color 0.2s ease;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .command-content:hover {
      background: #f0f0f0;
    }

    .command-actions {
      padding: 6px 8px;
      background: rgba(0, 0, 0, 0.02);
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      text-align: right;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }

    .copy-btn {
      border: 1px solid #6c757d;
      background-color: #f8f9fa;
      color: #6c757d;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .copy-btn:hover {
      background-color: #6c757d;
      color: #fff;
      transform: translateY(-1px);
    }

    .copy-btn i {
      font-size: 10px;
    }

    .execute-btn {
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .execute-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .execute-btn i {
      font-size: 10px;
    }
  `]
})
@Injectable()
export class AISidebarChatComponent implements OnDestroy {
  messages: ChatMessage[] = []
  currentMessage = ''
  isLoading = false
  isVisible = false
  selectedTexts: SelectedTextData[] = []
  selectionMode: SelectionMode = 'current'
  expandedContexts = new Set<string>() // 用于跟踪展开的上下文内容
  
  // 会话管理
  sessions: any[] = []
  currentSession: any = null
  selectedFiles: File[] = [] // 存储选中的图片文件

  private selectedTextsSubscription?: Subscription
  private selectionModeSubscription?: Subscription

  constructor(
    private aiService: AIService,
    private notifications: NotificationsService,
    private contextService: ContextService,
    private config: ConfigService,
    public commandExecutor: CommandExecutorService
  ) {
    // 不在构造函数中订阅监听，只在AI聊天打开时才开始监听
    // 初始化会话数据
    this.loadSessions()
  }

  ngOnDestroy() {
    // 组件销毁时隐藏侧边栏
    this.hide()
    
    // 取消订阅
    if (this.selectedTextsSubscription) {
      this.selectedTextsSubscription.unsubscribe()
    }
    if (this.selectionModeSubscription) {
      this.selectionModeSubscription.unsubscribe()
    }
  }

  show() {
    console.log('[AI助手] 打开AI聊天界面，开始监听')
    this.isVisible = true
    
    // 启用ContextService监听
    this.contextService.enableListening()
    
    // 开始监听选中文本变化
    if (!this.selectedTextsSubscription) {
      this.selectedTextsSubscription = this.contextService.selectedTexts$.subscribe(
        selectedTexts => {
          console.log('[AI助手] 选中文本更新:', selectedTexts.length, '个文本')
          this.selectedTexts = selectedTexts
        }
      )
    }

    // 开始监听选择模式变化
    if (!this.selectionModeSubscription) {
      this.selectionModeSubscription = this.contextService.selectionMode$.subscribe(
        mode => {
          console.log('[AI助手] 选择模式更新:', mode)
          this.selectionMode = mode
        }
      )
    }
    
    // 显示后滚动到底部
    setTimeout(() => this.scrollToBottom(), 300)
  }

  hide() {
    console.log('[AI助手] 关闭AI聊天界面，停止监听')
    this.isVisible = false
    
    // 禁用ContextService监听
    this.contextService.disableListening()
    
    // 停止监听选中文本变化
    if (this.selectedTextsSubscription) {
      this.selectedTextsSubscription.unsubscribe()
      this.selectedTextsSubscription = undefined
    }

    // 停止监听选择模式变化
    if (this.selectionModeSubscription) {
      this.selectionModeSubscription.unsubscribe()
      this.selectionModeSubscription = undefined
    }
    
    // 清空当前选中文本状态
    this.selectedTexts = []
    this.selectionMode = SelectionMode.None
  }

  toggle() {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  formatMessage(content: string): string {
    // 简单的格式化：将换行符转换为HTML换行
    return content.replace(/\n/g, '<br>')
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
    this.notifications.info('聊天记录已清除')
  }

  exportHistory(): void {
    if (this.messages.length === 0) {
      this.notifications.warning('没有聊天记录可导出')
      return
    }

    try {
      const exportData = {
        exportTime: new Date().toLocaleString('zh-CN'),
        totalMessages: this.messages.length,
        conversations: this.messages.map(msg => ({
          role: msg.isUser ? '用户' : 'AI助手',
          content: msg.content.replace(/<br>/g, '\n'), // 转换回换行符
          timestamp: msg.timestamp.toLocaleString('zh-CN'),
          hasContext: msg.hasContext,
          contextContent: msg.contextContent,
          contextSummary: msg.contextSummary
        }))
      }

      // 生成Markdown格式
      const markdownContent = this.generateMarkdown(exportData)
      
      // 创建下载链接
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `AI聊天记录_${new Date().toISOString().slice(0, 10)}.md`
      
      // 触发下载
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      this.notifications.success('聊天记录已导出')
    } catch (error) {
      console.error('导出聊天记录失败:', error)
      this.notifications.error('导出失败，请稍后重试')
    }
  }

  // 选择模式相关方法
  setSelectionMode(mode: SelectionMode): void {
    console.log('[AI助手] 切换选择模式:', mode)
    this.selectionMode = mode // 立即更新本地状态
    this.contextService.setSelectionMode(mode)
  }

  getSelectionInfo(): string {
    if (this.selectionMode === 'current') {
      if (this.selectedTexts.length > 0) {
        return `当前终端: ${this.selectedTexts[0].source}`
      } else {
        return '当前终端: 无选中内容（切换窗口或重新选择）'
      }
    } else if (this.selectionMode === 'multiple') {
      return `多终端: ${this.selectedTexts.length} 个终端有选中内容`
    } else if (this.selectionMode === 'none') {
      return '已禁用选中文本功能'
    }
    return ''
  }

  // 选中文本相关方法
  toggleSelectedTextCollapse(terminalId: string): void {
    this.contextService.toggleSelectedTextCollapse(terminalId)
  }

  clearSelectedText(terminalId?: string): void {
    this.contextService.clearSelectedText(terminalId)
  }

  // 测试方法 - 手动添加选中文本
  testAddSelectedText(): void {
    this.contextService.setSelectedText('测试选中文本内容\n这是用于测试多终端功能的文本', 'Test Terminal')
    console.log('[AI助手] 已添加测试选中文本')
  }

  // 调试方法 - 显示当前状态
  debugCurrentState(): void {
    console.log('[AI助手] 当前状态:', {
      selectionMode: this.selectionMode,
      selectedTextsCount: this.selectedTexts.length,
      selectedTexts: this.selectedTexts
    })
  }

  // 上下文展开/折叠相关方法
  toggleContextContent(messageId: string): void {
    if (this.expandedContexts.has(messageId)) {
      this.expandedContexts.delete(messageId)
    } else {
      this.expandedContexts.add(messageId)
    }
  }

  isContextExpanded(messageId: string): boolean {
    return this.expandedContexts.has(messageId)
  }

  private generateMarkdown(data: any): string {
    let markdown = `# AI助手聊天记录\n\n`
    markdown += `**导出时间**: ${data.exportTime}\n`
    markdown += `**消息总数**: ${data.totalMessages} 条\n\n`
    markdown += `---\n\n`

    data.conversations.forEach((conv: any, index: number) => {
      markdown += `## ${index + 1}. ${conv.role}\n\n`
      markdown += `**时间**: ${conv.timestamp}\n\n`
      
      // 如果有上下文内容，添加到导出中
      if (conv.hasContext && conv.contextContent) {
        markdown += `**上下文内容** (${conv.contextSummary}):\n`
        markdown += `\`\`\`\n${conv.contextContent}\n\`\`\`\n\n`
      }
      
      markdown += `${conv.content}\n\n`
      markdown += `---\n\n`
    })

    markdown += `\n> 导出自 Tabby AI助手插件`
    
    return markdown
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || this.isLoading) return

    if (!this.aiService.isConfigured()) {
      this.notifications.error('请先在设置中配置AI助手')
      return
    }

    // 智能分析上下文
    const contextData = await this.contextService.analyzeContext(this.currentMessage.trim())
    
    // 准备上下文摘要和内容
    let contextSummary = ''
    let contextContent = ''
    
    if (contextData.selectedText) {
      const mode = this.contextService.getSelectionMode()
      const selectedTexts = this.selectedTexts
      
      if (mode === 'multiple' && selectedTexts.length > 1) {
        contextSummary = `${selectedTexts.length} 个终端的选中内容`
        contextContent = selectedTexts.map(text => 
          `=== ${text.source} ===\n${text.text}`
        ).join('\n\n')
      } else if (selectedTexts.length > 0) {
        contextSummary = selectedTexts[0].source
        contextContent = selectedTexts[0].text
      }
    }
    
    // 调试日志
    console.log('上下文分析结果:', {
      hasContext: !!contextData.selectedText,
      selectedText: contextData.selectedText ? '已获取' : '无',
      contextSummary,
      contextContentLength: contextContent.length,
      hasAttachments: this.selectedFiles.length > 0
    })

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: this.currentMessage.trim(),
      isUser: true,
      timestamp: new Date(),
      hasContext: !!contextData.selectedText,
      contextType: 'selected',
      contextContent: contextContent || undefined,
      contextSummary: contextSummary || undefined
    }
    this.messages.push(userMessage)

    const query = this.currentMessage.trim()
    this.currentMessage = ''
    this.isLoading = true

    try {
      // 滚动到底部
      setTimeout(() => this.scrollToBottom(), 100)

      // 发送查询，包含图片附件
      const response = await this.aiService.sendQuery(query, contextData, this.selectedFiles)

      // 添加AI回复
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        isUser: false,
        timestamp: new Date()
      }
      this.messages.push(aiMessage)
      
      // 更新当前会话的消息列表
      this.loadSessions()

      // 发送成功后根据模式清除选中文本
      if (this.selectionMode === 'current' && this.selectedTexts.length > 0) {
        // 清除当前终端的选中文本
        this.clearSelectedText(this.selectedTexts[0].terminalId)
      } else if (this.selectionMode === 'multiple') {
        // 清除所有选中文本
        this.clearSelectedText()
      }
      
      // 清除选中的文件
      this.selectedFiles = []

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
    try {
      const container = document.querySelector('.chat-messages')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    } catch (error) {
      console.warn('滚动到底部失败:', error)
    }
  }
  
  // 会话管理方法
  loadSessions(): void {
    this.sessions = this.aiService.getAllSessions()
    this.currentSession = this.aiService.getCurrentSession()
    if (this.currentSession) {
      // 更新消息列表为当前会话的消息
      this.messages = this.currentSession.messages.map((msg: any) => ({
        id: Date.now().toString() + Math.random(),
        content: typeof msg.content === 'string' ? msg.content : 
                Array.isArray(msg.content) ? msg.content.find((c: any) => c.type === 'text')?.text || '' : '',
        isUser: msg.role === 'user',
        timestamp: msg.timestamp || new Date()
      }))
    }
  }
  
  createNewSession(): void {
    const session = this.aiService.createNewSession()
    this.loadSessions()
    this.notifications.success(`创建新会话: ${session.title}`)
  }
  
  switchSession(sessionId: string): void {
    if (this.aiService.switchToSession(sessionId)) {
      this.loadSessions()
      this.notifications.info('已切换会话')
    }
  }
  
  deleteSession(sessionId: string, event: Event): void {
    event.stopPropagation()
    if (this.sessions.length <= 1) {
      this.notifications.warning('至少需要保留一个会话')
      return
    }
    
    if (this.aiService.deleteSession(sessionId)) {
      this.loadSessions()
      this.notifications.success('会话已删除')
    }
  }
  
  clearAllSessions(): void {
    if (confirm('确定要清除所有会话吗？此操作不可撤销。')) {
      this.aiService.clearAllSessions()
      this.loadSessions()
      this.notifications.success('所有会话已清除')
    }
  }
  
  // 图片上传相关方法
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files)
      const imageFiles = files.filter(file => file.type.startsWith('image/'))
      
      if (imageFiles.length > 0) {
        this.selectedFiles = [...this.selectedFiles, ...imageFiles]
        this.notifications.success(`已选择 ${imageFiles.length} 个图片文件`)
      } else {
        this.notifications.warning('请选择图片文件')
      }
      
      // 清空input
      input.value = ''
    }
  }
  
  removeAttachment(index: number): void {
    this.selectedFiles.splice(index, 1)
  }
  
  clearAllAttachments(): void {
    this.selectedFiles = []
  }

  // 命令解析和执行相关方法
  parseCommands(content: string): ParsedCommand[] {
    return this.commandExecutor.parseCommands(content)
  }

  /**
   * 获取消息的解析命令（带缓存）
   */
  getMessageCommands(message: ChatMessage): ParsedCommand[] {
    // 如果已缓存，直接返回
    if (message.parsedCommands) {
      return message.parsedCommands
    }
    
    // 只解析AI消息中的命令
    if (message.isUser) {
      return []
    }
    
    // 解析并缓存结果
    message.parsedCommands = this.commandExecutor.parseCommands(message.content)
    return message.parsedCommands
  }

  async executeCommand(command: ParsedCommand): Promise<void> {
    try {
      const success = await this.commandExecutor.executeCommand(command.command, command.safety)
      // CommandExecutorService已经处理了通知，这里不需要重复显示
      if (!success) {
        // 只在失败时显示错误通知（如果CommandExecutorService没有显示的话）
        console.error('命令执行失败')
      }
    } catch (error) {
      console.error('执行命令失败:', error)
      try {
        this.notifications.error(`执行命令失败: ${error instanceof Error ? error.message : '未知错误'}`)
      } catch (notificationError) {
        console.error(`执行命令失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }

  // 复制命令到剪贴板
  copyCommand(command: string): void {
    try {
      navigator.clipboard.writeText(command).then(() => {
        console.log('[AI助手] 命令已复制到剪贴板:', command)
        try {
          this.notifications.info(`✅ 已复制命令: ${command}`)
        } catch (notificationError) {
          console.log(`✅ 已复制命令: ${command}`)
        }
      }).catch(error => {
        console.error('[AI助手] 复制命令失败:', error)
        // 回退到旧的复制方法
        this.fallbackCopyCommand(command)
      })
    } catch (error) {
      console.error('[AI助手] 复制命令异常:', error)
      this.fallbackCopyCommand(command)
    }
  }

  // 回退复制方法（兼容旧浏览器）
  private fallbackCopyCommand(command: string): void {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = command
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      
      console.log('[AI助手] 命令已复制到剪贴板(回退方法):', command)
      try {
        this.notifications.info(`✅ 已复制命令: ${command}`)
      } catch (notificationError) {
        console.log(`✅ 已复制命令: ${command}`)
      }
    } catch (error) {
      console.error('[AI助手] 回退复制方法也失败:', error)
      try {
        this.notifications.error('❌ 复制命令失败')
      } catch (notificationError) {
        console.error('❌ 复制命令失败')
      }
    }
  }

  // 测试命令解析功能
  testCommandParsing(): void {
    const testContent = `要查看系统版本，可以使用以下命令：

\`\`\`bash
cat /etc/os-release
\`\`\`

或者：

\`\`\`bash
uname -r
\`\`\`

这两个命令都会提供系统版本的信息。`
    
    console.log('[AI助手] 测试内容:', testContent)
    
    const commands = this.commandExecutor.parseCommands(testContent)
    console.log('[AI助手] 测试命令解析结果:', commands)
    
    // 创建测试消息
    const testMessage: ChatMessage = {
      id: 'test_' + Date.now(),
      content: testContent,
      isUser: false,
      timestamp: new Date()
    }
    
    this.messages.push(testMessage)
    setTimeout(() => this.scrollToBottom(), 100)
    
    this.notifications.info(`测试完成：解析到 ${commands.length} 个命令，请查看控制台了解详细信息`)
  }
}