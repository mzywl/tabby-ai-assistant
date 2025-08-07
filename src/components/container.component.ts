import { Component, OnInit, ViewChild, ComponentRef, ViewContainerRef, ComponentFactoryResolver, OnDestroy } from '@angular/core'
import { AISidebarChatComponent } from './sidebar-chat.component'
import { AISidebarService } from '../services/sidebar.service'

@Component({
  selector: 'ai-assistant-container',
  template: `
    <div #sidebarContainer class="ai-assistant-container"></div>
  `,
  styles: [`
    .ai-assistant-container {
      position: relative;
      z-index: 1000;
    }
  `]
})
export class AIAssistantContainerComponent implements OnInit, OnDestroy {
  @ViewChild('sidebarContainer', { read: ViewContainerRef }) container!: ViewContainerRef
  private sidebarRef: ComponentRef<AISidebarChatComponent> | null = null

  constructor(
    private resolver: ComponentFactoryResolver,
    private sidebarService: AISidebarService
  ) {}

  ngOnInit() {
    // 延迟创建侧边栏组件，确保ViewChild已初始化
    setTimeout(() => {
      this.createSidebarComponent()
    }, 0)
  }

  ngOnDestroy() {
    if (this.sidebarRef) {
      this.sidebarRef.destroy()
    }
  }

  private createSidebarComponent() {
    if (this.sidebarRef || !this.container) {
      return
    }

    try {
      const factory = this.resolver.resolveComponentFactory(AISidebarChatComponent)
      this.sidebarRef = this.container.createComponent(factory)
      
      // 将组件注册到服务中
      this.sidebarService.setSidebarComponent(this.sidebarRef.instance)
      
      console.log('AI侧边栏组件创建成功')
    } catch (error) {
      console.error('创建AI侧边栏组件失败:', error)
    }
  }
}