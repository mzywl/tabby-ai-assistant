import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCorePlugin, { ConfigProvider, ToolbarButtonProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

// 导入服务
import { AIService } from './services/ai.service'
import { AISidebarService } from './services/sidebar.service'
import { AIAssistantBootstrapService } from './services/bootstrap.service'
import { ContextService } from './services/context.service'

// 导入组件
import { AIChatPanelComponent } from './components/chat-panel.component'
import { AIAssistantSettingsComponent } from './components/settings.component'
import { AISidebarChatComponent } from './components/sidebar-chat.component'
import { AIAssistantContainerComponent } from './components/container.component'

// 导入提供者
import { AIAssistantConfigProvider } from './providers/config.provider'
import { AIAssistantToolbarButton } from './providers/toolbar-button.provider'
import { AIAssistantSettingsTabProvider } from './providers/settings-tab.provider'

// 主插件模块
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCorePlugin
  ],
  providers: [
    AIService,
    AISidebarService,
    AIAssistantBootstrapService,
    ContextService,
    { provide: ConfigProvider, useClass: AIAssistantConfigProvider, multi: true },
    { provide: ToolbarButtonProvider, useClass: AIAssistantToolbarButton, multi: true },
    { provide: SettingsTabProvider, useClass: AIAssistantSettingsTabProvider, multi: true }
  ],
  declarations: [
    AIAssistantSettingsComponent,
    AIChatPanelComponent,
    AISidebarChatComponent,
    AIAssistantContainerComponent
  ],
  entryComponents: [
    AISidebarChatComponent,
    AIAssistantContainerComponent
  ]
})
export default class AIAssistantPlugin {
  constructor(private bootstrapService: AIAssistantBootstrapService) {
    console.log('AI Assistant Plugin loaded')
    
    // 初始化侧边栏容器
    this.bootstrapService.initialize()
  }
}