import { Injectable } from '@angular/core'
import { Subject, BehaviorSubject } from 'rxjs'
import { AppService, BaseTabComponent, PlatformService } from 'tabby-core'

// 上下文数据接口
export interface ContextData {
  selectedText?: string
  timestamp?: Date
  source?: string
  isCollapsed?: boolean
}

// 选中文本接口
export interface SelectedTextData {
  text: string
  timestamp: Date
  source: string
  isCollapsed: boolean
  terminalId: string // 添加终端ID用于区分不同终端
}

// 选中文本显示模式
export enum SelectionMode {
  Current = 'current',
  Multiple = 'multiple', 
  None = 'none'
}

@Injectable({ providedIn: 'root' })
export class ContextService {
  // 多终端选中文本管理
  private allSelectedTexts = new Map<string, SelectedTextData>() // terminalId -> SelectedTextData
  private selectedTextSubject = new BehaviorSubject<SelectedTextData[]>([])
  public selectedTexts$ = this.selectedTextSubject.asObservable()

  // 选择模式
  private selectionModeSubject = new BehaviorSubject<SelectionMode>(SelectionMode.Current)
  public selectionMode$ = this.selectionModeSubject.asObservable()

  // 当前活动终端的选中文本（向后兼容）
  private currentSelectedText: SelectedTextData | null = null
  
  // 已监听的终端标签页
  private monitoredTabs = new Set<string>()
  
  // 原始的setClipboard方法引用
  private originalSetClipboard: Function | null = null
  
  // 监听控制开关
  private isListeningEnabled = false

  constructor(
    private app: AppService,
    private platform: PlatformService
  ) {
    // 不在构造函数中自动开始监听，只设置剪贴板钩子
    this.hookClipboardAPI()
    
    // 添加全局调试访问
    if (typeof window !== 'undefined') {
      (window as any).aiContextService = this
    }
  }
  
  /**
   * 启用监听 - 只有AI聊天界面打开时调用
   */
  enableListening(): void {
    console.log('[ContextService] 启用终端选中文本监听')
    if (!this.isListeningEnabled) {
      this.isListeningEnabled = true
      this.initTerminalSelectionListener()
      
      // 处理已经存在的标签页
      setTimeout(() => {
        this.app.tabs.forEach(tab => {
          this.processTab(tab)
        })
        
        // 如果有活动标签页，确保也处理它
        if (this.app.activeTab) {
          this.processTab(this.app.activeTab)
        }
      }, 100)
    }
  }
  
  /**
   * 禁用监听 - AI聊天界面关闭时调用
   */
  disableListening(): void {
    console.log('[ContextService] 禁用终端选中文本监听')
    this.isListeningEnabled = false
    // 清空已监听的终端
    this.monitoredTabs.clear()
    // 清空选中文本
    this.allSelectedTexts.clear()
    this.selectedTextSubject.next([])
    this.currentSelectedText = null
  }

  /**
   * Hook系统剪贴板API来捕获复制操作
   */
  private hookClipboardAPI(): void {
    // 保存原始方法
    this.originalSetClipboard = this.platform.setClipboard.bind(this.platform)
    
    // 重写setClipboard方法
    this.platform.setClipboard = (data: { text: string, html?: string }) => {
      // 调用原始方法
      this.originalSetClipboard!(data)
      
      // 如果复制的是终端选中的文本，自动捕获
      if (data.text && data.text.length > 2) {
        const activeTab = this.app.activeTab
        if (activeTab && this.isTerminalTab(activeTab)) {
          this.setSelectedText(data.text, `Terminal: ${activeTab.title}`)
          console.log('[AI助手] 通过复制操作捕获到选中文本:', data.text.substring(0, 50) + '...')
        }
      }
    }
    
    console.log('[AI助手] 已hook剪贴板API')
  }

  /**
   * 初始化终端选择监听器
   */
  private initTerminalSelectionListener(): void {
    // 监听活动标签页变化
    this.app.activeTabChange$.subscribe(tab => {
      if (tab) {
        this.processTab(tab)
        // 如果当前是current模式，实时跟随活动窗口
        const currentMode = this.getSelectionMode()
        if (currentMode === SelectionMode.Current) {
          this.followActiveWindowInCurrentMode()
        }
      }
    })

    // 监听标签页打开事件
    this.app.tabOpened$.subscribe(tab => {
      this.processTab(tab)
    })

    // 监听标签页关闭事件
    this.app.tabClosed$.subscribe(tab => {
      this.monitoredTabs.delete(tab.title)
    })
  }

  /**
   * 处理标签页，包括SplitTabComponent
   */
  private processTab(tab: BaseTabComponent): void {
    // 如果监听未启用，直接返回
    if (!this.isListeningEnabled) {
      return
    }
    
    // 如果是直接的终端标签页
    if (this.isTerminalTab(tab)) {
      this.setupTerminalListeners(tab)
      return
    }

    // 如果是SplitTabComponent，处理其子标签页
    const tabAny = tab as any
    if (tabAny.getAllTabs && typeof tabAny.getAllTabs === 'function') {
      const allTabs = tabAny.getAllTabs()
      allTabs.forEach((subTab: BaseTabComponent) => {
        if (this.isTerminalTab(subTab)) {
          this.setupTerminalListeners(subTab)
        }
      })

      // 监听SplitTabComponent的子标签页变化
      if (tabAny.tabAdded$) {
        tabAny.tabAdded$.subscribe((addedTab: BaseTabComponent) => {
          if (this.isTerminalTab(addedTab)) {
            this.setupTerminalListeners(addedTab)
          }
        })
      }

      if (tabAny.tabRemoved$) {
        tabAny.tabRemoved$.subscribe((removedTab: BaseTabComponent) => {
          const tabId = this.getTerminalId(removedTab)
          this.monitoredTabs.delete(tabId)
          this.removeSelectedText(tabId)
        })
      }

      // 监听焦点变化，用于当前终端模式
      if (tabAny.focusChanged$) {
        tabAny.focusChanged$.subscribe((focusedTab: BaseTabComponent) => {
          if (this.isTerminalTab(focusedTab)) {
            this.updateCurrentTerminalSelection(focusedTab)
          }
        })
      }
    }
  }

  /**
   * 获取终端ID
   */
  private getTerminalId(terminalTab: BaseTabComponent): string {
    return terminalTab.title + '_' + terminalTab.constructor.name + '_' + (terminalTab as any).__instanceId || Date.now()
  }

  /**
   * 更新当前终端的选中文本（用于current模式）
   */
  private updateCurrentTerminalSelection(terminalTab: BaseTabComponent): void {
    const terminalId = this.getTerminalId(terminalTab)
    const selectedText = this.allSelectedTexts.get(terminalId)
    if (selectedText) {
      this.currentSelectedText = selectedText
    }
    this.updateSelectedTextsOutput()
  }

  /**
   * 检查是否是终端标签页
   */
  private isTerminalTab(tab: BaseTabComponent): boolean {
    return tab && (
      (tab as any).frontend?.getSelection ||
      tab.constructor.name.includes('Terminal') ||
      tab.constructor.name.includes('Local') ||
      tab.constructor.name.includes('SSH') ||
      tab.constructor.name.includes('Serial') ||
      tab.constructor.name.includes('Telnet')
    )
  }

  /**
   * 为终端标签页设置选择监听器
   */
  private setupTerminalListeners(terminalTab: BaseTabComponent): void {
    const terminalId = this.getTerminalId(terminalTab)
    
    // 避免重复监听同一个标签页
    if (this.monitoredTabs.has(terminalId)) {
      return
    }

    this.monitoredTabs.add(terminalId)

    const terminalTabAny = terminalTab as any
    
    // 方法1: Hook终端的copySelection方法
    if (terminalTabAny.frontend && terminalTabAny.frontend.copySelection) {
      const originalCopySelection = terminalTabAny.frontend.copySelection.bind(terminalTabAny.frontend)
      
      terminalTabAny.frontend.copySelection = () => {
        // 先获取选中文本
        const selectedText = terminalTabAny.frontend.getSelection()?.trim()
        
        // 调用原始复制方法
        originalCopySelection()
        
        // 捕获选中文本
        if (selectedText && selectedText.length > 2) {
          this.setSelectedText(selectedText, `Terminal: ${terminalTab.title}`, terminalId)
          console.log('[AI助手] 通过copySelection hook捕获到选中文本:', selectedText.substring(0, 50) + '...')
        }
      }
    }

    // 方法2: 直接监听xterm的选择变化事件
    if (terminalTabAny.frontend && terminalTabAny.frontend.xterm) {
      const xterm = terminalTabAny.frontend.xterm
      
      // 监听选择变化事件
      const onSelectionChange = () => {
        const selectedText = xterm.getSelection()?.trim()
        if (selectedText && selectedText.length > 2) {
          this.setSelectedText(selectedText, `Terminal: ${terminalTab.title}`, terminalId)
          console.log('[AI助手] 通过xterm选择事件捕获到选中文本:', selectedText.substring(0, 50) + '...')
        }
      }
      
      // 添加选择变化监听器，使用防抖避免频繁触发
      let selectionTimeout: NodeJS.Timeout | null = null
      xterm.onSelectionChange(() => {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout)
        }
        selectionTimeout = setTimeout(onSelectionChange, 300) // 300ms防抖
      })
    }

    // 当标签页销毁时，从监听列表中移除
    terminalTab.destroyed$.subscribe(() => {
      this.monitoredTabs.delete(terminalId)
      this.removeSelectedText(terminalId)
    })

    console.log('[AI助手] 已设置终端选择监听器:', terminalTab.title, '(ID:', terminalId, ')')
  }

  /**
   * 设置选中文本
   */
  public setSelectedText(text: string, source: string = 'Unknown', terminalId?: string): void {
    // 忽略空文本或太短的文本
    if (!text || text.length < 3) return

    const finalTerminalId = terminalId || 'manual_' + Date.now()

    // 忽略重复的文本（同一终端）
    const existingText = this.allSelectedTexts.get(finalTerminalId)
    if (existingText && existingText.text === text) return

    const selectedTextData: SelectedTextData = {
      text: text,
      timestamp: new Date(),
      source: source,
      isCollapsed: false,
      terminalId: finalTerminalId
    }

    // 更新多终端文本管理
    this.allSelectedTexts.set(finalTerminalId, selectedTextData)
    
    // 如果是current模式且这是活动终端，或者还没有当前选中文本，更新当前选中文本
    const currentMode = this.getSelectionMode()
    if (currentMode === SelectionMode.Current) {
      const activeTab = this.app.activeTab
      if (activeTab) {
        let isActiveTerminal = false
        
        // 检查是否是活动终端
        if (this.isTerminalTab(activeTab)) {
          isActiveTerminal = this.getTerminalId(activeTab) === finalTerminalId
        } else {
          const activeTabAny = activeTab as any
          if (activeTabAny.getAllTabs && typeof activeTabAny.getAllTabs === 'function') {
            const allTabs = activeTabAny.getAllTabs()
            const focusedTab = allTabs.find((tab: any) => tab.hasFocus && this.isTerminalTab(tab))
            if (focusedTab) {
              isActiveTerminal = this.getTerminalId(focusedTab) === finalTerminalId
            }
          }
        }
        
        // 如果是活动终端或者没有当前选中文本，设置为当前选中文本
        if (isActiveTerminal || !this.currentSelectedText) {
          this.currentSelectedText = selectedTextData
          console.log('[AI助手] 设置为当前选中文本:', source)
        }
      } else {
        // 没有活动标签页时，直接设置为当前选中文本
        this.currentSelectedText = selectedTextData
      }
    } else {
      // 在multiple或none模式下，总是更新最后的选中文本（向后兼容）
      this.currentSelectedText = selectedTextData
    }
    
    this.updateSelectedTextsOutput()
  }

  /**
   * 移除特定终端的选中文本
   */
  public removeSelectedText(terminalId: string): void {
    this.allSelectedTexts.delete(terminalId)
    
    // 如果删除的是当前选中文本，更新当前选中文本
    if (this.currentSelectedText && this.currentSelectedText.terminalId === terminalId) {
      // 选择其他终端的文本作为当前选中文本
      const remainingTexts = Array.from(this.allSelectedTexts.values())
      this.currentSelectedText = remainingTexts.length > 0 ? remainingTexts[0] : null
    }
    
    this.updateSelectedTextsOutput()
  }

  /**
   * 获取当前选中文本
   */
  public getCurrentSelectedText(): SelectedTextData | null {
    return this.currentSelectedText
  }

  /**
   * 获取所有选中文本
   */
  public getAllSelectedTexts(): SelectedTextData[] {
    return Array.from(this.allSelectedTexts.values())
  }

  /**
   * 清除选中文本
   */
  public clearSelectedText(terminalId?: string): void {
    if (terminalId) {
      this.removeSelectedText(terminalId)
    } else {
      // 清除所有
      this.allSelectedTexts.clear()
      this.currentSelectedText = null
      this.updateSelectedTextsOutput()
    }
  }

  /**
   * 更新选择模式
   */
  public setSelectionMode(mode: SelectionMode): void {
    const previousMode = this.selectionModeSubject.value
    this.selectionModeSubject.next(mode)
    
    // 当从multiple模式切换到current模式时，自动跟随活动窗口
    if (previousMode === SelectionMode.Multiple && mode === SelectionMode.Current) {
      this.followActiveWindow()
    }
    
    this.updateSelectedTextsOutput()
  }

  /**
   * 在Current模式下跟随活动窗口（窗口切换时调用）
   */
  private followActiveWindowInCurrentMode(): void {
    const activeTab = this.app.activeTab
    if (!activeTab) {
      console.log('[AI助手] 没有活动标签页，清除当前选中文本')
      this.currentSelectedText = null
      this.updateSelectedTextsOutput()
      return
    }

    // 查找活动终端ID
    let activeTerminalId: string | null = null
    
    if (this.isTerminalTab(activeTab)) {
      activeTerminalId = this.getTerminalId(activeTab)
    } else {
      const activeTabAny = activeTab as any
      if (activeTabAny.getAllTabs && typeof activeTabAny.getAllTabs === 'function') {
        const allTabs = activeTabAny.getAllTabs()
        const focusedTab = allTabs.find((tab: any) => tab.hasFocus && this.isTerminalTab(tab))
        if (focusedTab) {
          activeTerminalId = this.getTerminalId(focusedTab)
        } else {
          const activeTerminal = allTabs.find((tab: any) => this.isTerminalTab(tab) && activeTabAny.activeIndex !== undefined && allTabs.indexOf(tab) === activeTabAny.activeIndex)
          if (activeTerminal) {
            activeTerminalId = this.getTerminalId(activeTerminal)
          } else {
            const firstTerminal = allTabs.find((tab: any) => this.isTerminalTab(tab))
            if (firstTerminal) {
              activeTerminalId = this.getTerminalId(firstTerminal)
            }
          }
        }
      }
    }

    // 在current模式下，只显示当前活动窗口的选中文本
    if (activeTerminalId && this.allSelectedTexts.has(activeTerminalId)) {
      this.currentSelectedText = this.allSelectedTexts.get(activeTerminalId)!
      console.log('[AI助手] Current模式 - 切换到有选中文本的窗口:', this.currentSelectedText.source)
    } else {
      // 切换到没有选中文本的窗口时，清除显示
      this.currentSelectedText = null
      console.log('[AI助手] Current模式 - 切换到无选中文本的窗口，已清除显示（请重新选择）')
    }
    
    this.updateSelectedTextsOutput()
  }

  /**
   * 跟随活动窗口（从multiple模式切换到current模式时使用）
   */
  private followActiveWindow(): void {
    const activeTab = this.app.activeTab
    if (!activeTab) {
      console.log('[AI助手] 没有活动标签页，无法跟随')
      return
    }

    // 查找活动终端的选中文本
    let activeTerminalId: string | null = null
    let activeTerminalTab: any = null
    
    // 如果活动标签页是直接的终端标签页
    if (this.isTerminalTab(activeTab)) {
      activeTerminalId = this.getTerminalId(activeTab)
      activeTerminalTab = activeTab
    } else {
      // 如果是SplitTabComponent，查找焦点终端
      const activeTabAny = activeTab as any
      if (activeTabAny.getAllTabs && typeof activeTabAny.getAllTabs === 'function') {
        const allTabs = activeTabAny.getAllTabs()
        // 查找当前焦点的终端标签页
        const focusedTab = allTabs.find((tab: any) => tab.hasFocus && this.isTerminalTab(tab))
        if (focusedTab) {
          activeTerminalId = this.getTerminalId(focusedTab)
          activeTerminalTab = focusedTab
        } else {
          // 如果没有焦点标签页，查找活动的终端标签页
          const activeTerminal = allTabs.find((tab: any) => this.isTerminalTab(tab) && activeTabAny.activeIndex !== undefined && allTabs.indexOf(tab) === activeTabAny.activeIndex)
          if (activeTerminal) {
            activeTerminalId = this.getTerminalId(activeTerminal)
            activeTerminalTab = activeTerminal
          } else {
            // 最后使用第一个终端标签页
            const firstTerminal = allTabs.find((tab: any) => this.isTerminalTab(tab))
            if (firstTerminal) {
              activeTerminalId = this.getTerminalId(firstTerminal)
              activeTerminalTab = firstTerminal
            }
          }
        }
      }
    }

    if (activeTerminalId && this.allSelectedTexts.has(activeTerminalId)) {
      // 将活动窗口的选中文本设为当前选中文本
      this.currentSelectedText = this.allSelectedTexts.get(activeTerminalId)!
      console.log('[AI助手] 已跟随活动窗口:', this.currentSelectedText.source)
    } else {
      // 在current模式下，如果活动窗口没有选中文本，清除当前选中文本
      // 这样用户需要重新选择内容
      this.currentSelectedText = null
      console.log('[AI助手] 活动窗口无选中文本，已清除当前选中文本（等待重新选择）')
    }
    
    // 更新输出
    this.updateSelectedTextsOutput()
  }

  /**
   * 获取当前选择模式
   */
  public getSelectionMode(): SelectionMode {
    return this.selectionModeSubject.value
  }

  /**
   * 更新输出的选中文本数组
   */
  private updateSelectedTextsOutput(): void {
    const mode = this.selectionModeSubject.value
    let textsToOutput: SelectedTextData[] = []

    switch (mode) {
      case SelectionMode.Current:
        if (this.currentSelectedText) {
          textsToOutput = [this.currentSelectedText]
        }
        break
      case SelectionMode.Multiple:
        textsToOutput = Array.from(this.allSelectedTexts.values())
        break
      case SelectionMode.None:
        textsToOutput = []
        break
    }

    this.selectedTextSubject.next(textsToOutput)
  }

  /**
   * 切换选中文本的折叠状态
   */
  public toggleSelectedTextCollapse(terminalId?: string): void {
    if (terminalId) {
      const selectedText = this.allSelectedTexts.get(terminalId)
      if (selectedText) {
        selectedText.isCollapsed = !selectedText.isCollapsed
        this.updateSelectedTextsOutput()
      }
    } else if (this.currentSelectedText) {
      this.currentSelectedText.isCollapsed = !this.currentSelectedText.isCollapsed
      this.updateSelectedTextsOutput()
    }
  }

  /**
   * 智能分析上下文（保留原有方法）
   */
  async analyzeContext(query: string): Promise<ContextData> {
    const contextData: ContextData = {}

    // 根据选择模式获取选中文本
    const mode = this.getSelectionMode()
    const selectedTexts = this.selectedTextSubject.value

    if (selectedTexts.length > 0) {
      if (mode === SelectionMode.Multiple) {
        // 多终端模式：合并所有选中文本
        const combinedText = selectedTexts.map(text => 
          `=== ${text.source} ===\n${text.text}`
        ).join('\n\n')
        contextData.selectedText = combinedText
        contextData.source = `Multiple terminals (${selectedTexts.length})`
      } else {
        // 当前终端模式
        const firstText = selectedTexts[0]
        contextData.selectedText = firstText.text
        contextData.source = firstText.source
        contextData.timestamp = firstText.timestamp
      }
    }

    return contextData
  }

  /**
   * 构建包含上下文的查询（保留原有方法）
   */
  buildQueryWithContext(query: string, contextData: ContextData): string {
    let finalQuery = query

    // 如果有选中文本上下文，添加到查询前面
    if (contextData.selectedText) {
      finalQuery = `基于以下内容回答问题：

\`\`\`
${contextData.selectedText}
\`\`\`

问题：${query}`
    }

    return finalQuery
  }

  /**
   * 获取格式化的选中文本预览（限制显示长度）
   */
  public getSelectedTextPreview(maxLength: number = 100): string {
    const selectedTexts = this.selectedTextSubject.value
    if (selectedTexts.length === 0) return ''
    
    if (selectedTexts.length === 1) {
      const text = selectedTexts[0].text
      if (text.length <= maxLength) return text
      return text.substring(0, maxLength) + '...'
    } else {
      // 多终端模式显示总结
      return `${selectedTexts.length} 个终端选中内容`
    }
  }

  /**
   * 检查是否有选中文本
   */
  public hasSelectedText(): boolean {
    return this.selectedTextSubject.value.length > 0
  }

  /**
   * 手动初始化当前标签页（用于调试）
   */
  public initCurrentTab(): void {
    console.log('[AI助手] 手动初始化当前标签页')
    if (this.app.activeTab) {
      this.processTab(this.app.activeTab)
    }
    this.app.tabs.forEach(tab => {
      this.processTab(tab)
    })
  }

  /**
   * 手动测试方法 - 可以用来测试功能
   */
  public testSetSelectedText(): void {
    this.setSelectedText('测试选中文本内容\n这是第二行内容', 'Manual Test')
    console.log('[AI助手] 手动设置测试文本')
  }

  /**
   * 调试方法 - 检查当前监听状态
   */
  public debugInfo(): void {
    console.log('[AI助手] 调试信息:')
    console.log('- 当前监听的标签页数量:', this.monitoredTabs.size)
    console.log('- 监听的标签页:', Array.from(this.monitoredTabs))
    console.log('- 当前选中文本:', this.currentSelectedText)
    console.log('- 活动标签页:', this.app.activeTab?.title)
    console.log('- 是否为终端标签页:', this.app.activeTab ? this.isTerminalTab(this.app.activeTab) : 'N/A')
    
    const activeTab = this.app.activeTab as any
    if (activeTab) {
      console.log('- 标签页构造函数名:', activeTab.constructor.name)
      console.log('- 标签页类型:', typeof activeTab)
      console.log('- 标签页原型链:', Object.getPrototypeOf(activeTab).constructor.name)
      
      if (activeTab.frontend) {
        console.log('- Frontend类型:', activeTab.frontend.constructor.name)
        console.log('- 是否有xterm:', !!activeTab.frontend.xterm)
        console.log('- 是否有getSelection:', !!activeTab.frontend.getSelection)
        if (activeTab.frontend.getSelection) {
          const currentSelection = activeTab.frontend.getSelection()
          console.log('- 当前终端选择:', currentSelection ? `"${currentSelection.substring(0, 50)}..."` : '无选择')
        }
      } else {
        console.log('- 没有frontend属性')
        console.log('- 可用属性:', Object.keys(activeTab))
      }
      
      // 检查是否是SplitTabComponent包装的终端
      if (activeTab.getAllTabs && typeof activeTab.getAllTabs === 'function') {
        const allTabs = activeTab.getAllTabs()
        console.log('- 这是一个SplitTabComponent，包含', allTabs.length, '个子标签页')
        allTabs.forEach((tab: any, index: number) => {
          console.log(`  - 子标签页 ${index}:`, tab.constructor.name, tab.title)
          console.log(`    - 是否为终端:`, this.isTerminalTab(tab))
          if (tab.frontend) {
            console.log(`    - Frontend:`, tab.frontend.constructor.name)
          }
        })
      }
    }
  }

  /**
   * 恢复原始的剪贴板API（清理时使用）
   */
  public cleanup(): void {
    if (this.originalSetClipboard) {
      this.platform.setClipboard = this.originalSetClipboard
      console.log('[AI助手] 已恢复原始剪贴板API')
    }
  }
}