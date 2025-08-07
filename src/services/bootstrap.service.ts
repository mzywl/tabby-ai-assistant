import {
  Injectable,
  ComponentRef,
  ComponentFactoryResolver,
  ApplicationRef,
  Injector
} from '@angular/core'
import { AIAssistantContainerComponent } from '../components/container.component'
// import { ConfigService } from 'tabby-core' // 如果你有配置服务，可以启用这个

@Injectable()
export class AIAssistantBootstrapService {
  private containerRef: ComponentRef<AIAssistantContainerComponent> | null = null

  constructor(
    private resolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
    // private config: ConfigService // 可选：用于AI配置检测
  ) {}

  initialize() {
    console.log('[AI助手监测器] 插件初始化中...')

    // 延迟初始化，确保DOM准备完毕
    setTimeout(() => {
      this.createContainer()

      if (this.containerRef) {
        console.log('[AI助手监测器] 容器组件已创建 ✅')
      } else {
        console.warn('[AI助手监测器] 容器组件未创建 ⚠️ 请检查 ComponentFactory 是否正常')
      }

      // 可选：检测AI配置是否填写完整
      /*
      const aiConfig = this.config.store.aiAssistant
      if (!aiConfig?.provider || !aiConfig?.apiKey) {
        console.warn('[AI助手监测器] AI配置未完成 ❌ 请前往设置页填写 provider 和 API Key')
      } else {
        console.log('[AI助手监测器] AI配置已完成 ✅', aiConfig)
      }
      */
    }, 100)
  }

  private createContainer() {
    if (this.containerRef) {
      return
    }

    try {
      const factory = this.resolver.resolveComponentFactory(AIAssistantContainerComponent)
      this.containerRef = factory.create(this.injector)
      this.appRef.attachView(this.containerRef.hostView)

      const domElem = (this.containerRef.hostView as any).rootNodes[0] as HTMLElement
      document.body.appendChild(domElem)

      console.log('[AI助手监测器] 容器已挂载到 DOM ✅')
    } catch (error) {
      console.error('[AI助手监测器] 初始化容器失败 ❌', error)
    }
  }

  destroy() {
    if (this.containerRef) {
      this.appRef.detachView(this.containerRef.hostView)
      this.containerRef.destroy()
      this.containerRef = null

      console.log('[AI助手监测器] 容器已销毁 🧹')
    }
  }
}
