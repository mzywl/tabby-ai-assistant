import { Injectable } from '@angular/core'
import { ToolbarButtonProvider, ToolbarButton, NotificationsService } from 'tabby-core'
import { AIService } from '../services/ai.service'
import { AISidebarService } from '../services/sidebar.service'

@Injectable()
export class AIAssistantToolbarButton extends ToolbarButtonProvider {
  constructor(
    private aiService: AIService,
    private notifications: NotificationsService,
    private sidebarService: AISidebarService
  ) {
    super()
  }

  provide(): ToolbarButton[] {
    return [
      {
        icon: require('../icons/robot.svg').default || require('../icons/robot.svg'),
        title: 'AI助手',
        weight: 10,
        click: () => {
          this.toggleAISidebar()
        }
      }
    ]
  }

  private toggleAISidebar() {
    console.log('AI助手按钮被点击')
    
    try {
      // 检查AI服务是否已配置
      if (!this.aiService.isConfigured()) {
        this.notifications.info('AI助手已打开，请先在设置中配置API密钥')
      }
      
      // 切换侧边栏显示状态
      this.sidebarService.toggle()
      
    } catch (error) {
      console.error('切换AI助手侧边栏时出错:', error)
      this.notifications.error(`AI助手操作失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}