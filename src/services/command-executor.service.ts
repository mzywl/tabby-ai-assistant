import { Injectable } from '@angular/core'
import { AppService, BaseTabComponent } from 'tabby-core'
import { NotificationsService } from 'tabby-core'

// 命令安全级别
export enum CommandSafety {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION', 
  DANGER = 'DANGER'
}

// 解析后的命令对象
export interface ParsedCommand {
  safety: CommandSafety
  command: string
  originalText: string
  language?: string
}

@Injectable({ providedIn: 'root' })
export class CommandExecutorService {
  constructor(
    private app: AppService,
    private notifications: NotificationsService
  ) {}

  /**
   * 解析AI回复中的命令块
   */
  parseCommands(content: string): ParsedCommand[] {
    console.log('[CommandExecutor] 开始解析内容:', content.substring(0, 200) + '...')
    
    const commands: ParsedCommand[] = []
    
    // 改进的代码块正则表达式，支持更多格式
    const codeBlockRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g
    let match
    
    console.log('[CommandExecutor] 使用正则表达式:', codeBlockRegex.source)
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'bash'
      const codeContent = match[2].trim()
      
      console.log(`[CommandExecutor] 找到代码块 - 语言: ${language}, 内容: ${codeContent}`)
      
      // 只处理终端相关的语言
      if (['bash', 'sh', 'shell', 'cmd', 'powershell', 'zsh'].includes(language.toLowerCase())) {
        const lines = codeContent.split('\n')
        
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('//')) {
            console.log(`[CommandExecutor] 解析命令行: "${trimmedLine}"`)
            const parsedCommand = this.parseCommandLine(trimmedLine, match[0], language)
            if (parsedCommand) {
              console.log(`[CommandExecutor] 成功解析命令:`, parsedCommand)
              commands.push(parsedCommand)
            }
          }
        }
      }
    }
    
    console.log(`[CommandExecutor] 解析完成，共找到 ${commands.length} 个命令:`, commands.map(c => ({
      command: c.command,
      safety: c.safety,
      language: c.language
    })))
    
    return commands
  }

  /**
   * 解析单行命令
   */
  private parseCommandLine(line: string, originalText: string, language: string): ParsedCommand | null {
    // 匹配安全级别标识
    const safetyMatch = line.match(/^\[(\w+)\]\s*(.+)$/)
    
    if (safetyMatch) {
      const safetyLevel = safetyMatch[1].toUpperCase()
      const command = safetyMatch[2].trim()
      
      if (Object.values(CommandSafety).includes(safetyLevel as CommandSafety)) {
        return {
          safety: safetyLevel as CommandSafety,
          command: command,
          originalText: originalText,
          language: language
        }
      }
    }
    
    // 如果没有安全级别标识，尝试自动判断
    const autoSafety = this.assessCommandSafety(line)
    return {
      safety: autoSafety,
      command: line,
      originalText: originalText,
      language: language
    }
  }

  /**
   * 自动评估命令安全性
   */
  private assessCommandSafety(command: string): CommandSafety {
    const cmd = command.toLowerCase().trim()
    
    console.log(`[CommandExecutor] 评估命令安全性: "${cmd}"`)
    
    // 危险命令模式
    const dangerousPatterns = [
      /^rm\s+-rf?\s+/,
      /^del\s+/,
      /^rmdir\s+/,
      /^format\s+/,
      /^fdisk\s+/,
      /^dd\s+/,
      /^mkfs\s+/,
      /^sudo\s+rm\s+/,
      />\s*\/dev\/(null|zero)/,
      /^\s*:\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,  // fork bomb
      /^sudo\s+halt/,
      /^sudo\s+reboot/,
      /^sudo\s+shutdown/,
      /^chmod\s+777/,
      /^chown\s+-R/,
      /--force/,
      /--recursive.*delete/
    ]
    
    // 谨慎命令模式
    const cautionPatterns = [
      /^npm\s+install/,
      /^pip\s+install/,
      /^apt\s+install/,
      /^yum\s+install/,
      /^brew\s+install/,
      /^sudo\s+/,
      /^chmod\s+/,
      /^chown\s+/,
      /^git\s+reset\s+--hard/,
      /^git\s+clean\s+-fd/,
      /^\w+\s+>\s+/,  // 重定向覆盖
      /^mv\s+.*\s+\/\w+/,
      /^cp\s+-r/,
      /^wget\s+.*\s+\|\s+bash/,
      /^curl\s+.*\s+\|\s+bash/,
      /systemctl/,
      /service\s+/
    ]
    
    // 检查危险模式
    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        console.log(`[CommandExecutor] 命令匹配危险模式: ${pattern.source}`)
        return CommandSafety.DANGER
      }
    }
    
    // 检查谨慎模式  
    for (const pattern of cautionPatterns) {
      if (pattern.test(cmd)) {
        console.log(`[CommandExecutor] 命令匹配谨慎模式: ${pattern.source}`)
        return CommandSafety.CAUTION
      }
    }
    
    // 默认为安全
    console.log(`[CommandExecutor] 命令被识别为安全命令`)
    return CommandSafety.SAFE
  }

  /**
   * 获取安全级别的颜色
   */
  getSafetyColor(safety: CommandSafety): string {
    switch (safety) {
      case CommandSafety.SAFE:
        return '#28a745'  // 绿色
      case CommandSafety.CAUTION:
        return '#ffc107'  // 黄色
      case CommandSafety.DANGER:
        return '#dc3545'  // 红色
      default:
        return '#6c757d'  // 灰色
    }
  }

  /**
   * 获取安全级别的中文描述
   */
  getSafetyDescription(safety: CommandSafety): string {
    switch (safety) {
      case CommandSafety.SAFE:
        return '安全命令'
      case CommandSafety.CAUTION:
        return '谨慎执行'
      case CommandSafety.DANGER:
        return '危险命令'
      default:
        return '未知'
    }
  }

  /**
   * 执行命令到当前活动终端
   */
  async executeCommand(command: string, safety: CommandSafety): Promise<boolean> {
    try {
      console.log('[CommandExecutor] 开始执行命令:', command)
      
      // 获取当前活动标签页
      const activeTab = this.app.activeTab
      console.log('[CommandExecutor] 当前活动标签页:', activeTab?.constructor.name)
      
      if (!activeTab) {
        this.notifications.error('没有活动的标签页')
        return false
      }

      // 查找终端标签页
      let terminalTab = await this.findActiveTerminal(activeTab)
      console.log('[CommandExecutor] 找到的终端标签页:', terminalTab?.constructor.name)
      
      if (!terminalTab) {
        this.notifications.error('没有找到活动的终端')
        return false
      }

      // 对于危险命令，需要用户确认
      if (safety === CommandSafety.DANGER) {
        const confirmed = confirm(`⚠️ 这是一个危险命令！\n\n命令: ${command}\n\n确定要执行吗？此操作可能导致数据丢失或系统损坏。`)
        if (!confirmed) {
          return false
        }
      }

      // 对于谨慎命令，显示警告
      if (safety === CommandSafety.CAUTION) {
        const confirmed = confirm(`⚠️ 请谨慎执行此命令！\n\n命令: ${command}\n\n确定要执行吗？`)
        if (!confirmed) {
          return false
        }
      }

      // 向终端发送命令
      const terminalTabAny = terminalTab as any
      console.log('[CommandExecutor] 终端标签页属性:', Object.keys(terminalTabAny))
      console.log('[CommandExecutor] frontend对象:', terminalTabAny.frontend ? 'exists' : 'missing')
      
      if (terminalTabAny.frontend) {
        console.log('[CommandExecutor] frontend属性:', Object.keys(terminalTabAny.frontend))
        console.log('[CommandExecutor] sendInput方法:', typeof terminalTabAny.frontend.sendInput)
      }
      
      // 尝试多种方法发送命令
      let success = false
      
      // 方法1: 通过frontend.sendInput
      if (terminalTabAny.frontend && terminalTabAny.frontend.sendInput) {
        try {
          console.log('[CommandExecutor] 尝试通过frontend.sendInput发送命令')
          terminalTabAny.frontend.sendInput(command + '\r') // 添加回车符自动执行
          success = true
          console.log('[CommandExecutor] frontend.sendInput成功')
        } catch (error) {
          console.error('[CommandExecutor] frontend.sendInput失败:', error)
        }
      }
      
      // 方法2: 直接通过终端标签页的sendInput方法
      if (!success && terminalTabAny.sendInput) {
        try {
          console.log('[CommandExecutor] 尝试通过terminalTab.sendInput发送命令')
          terminalTabAny.sendInput(command + '\r') // 添加回车符自动执行
          success = true
          console.log('[CommandExecutor] terminalTab.sendInput成功')
        } catch (error) {
          console.error('[CommandExecutor] terminalTab.sendInput失败:', error)
        }
      }
      
      // 方法3: 尝试write方法
      if (!success && terminalTabAny.write) {
        try {
          console.log('[CommandExecutor] 尝试通过write方法发送命令')
          terminalTabAny.write(command + '\r') // 添加回车符自动执行
          success = true
          console.log('[CommandExecutor] write方法成功')
        } catch (error) {
          console.error('[CommandExecutor] write方法失败:', error)
        }
      }
      
      if (success) {
        // 显示成功通知 - 修复通知服务调用
        try {
          this.notifications.info(`✅ 命令已执行: ${command}`)
        } catch (notificationError) {
          console.log('[CommandExecutor] 通知服务不可用，使用console输出:', notificationError)
          console.log(`✅ 命令已执行: ${command}`)
        }
        return true
      } else {
        console.error('[CommandExecutor] 所有发送方法都失败了')
        try {
          this.notifications.error('❌ 无法向终端发送命令 - 所有方法都失败')
        } catch (notificationError) {
          console.error('❌ 无法向终端发送命令 - 所有方法都失败')
        }
        return false
      }
    } catch (error) {
      console.error('[CommandExecutor] 执行命令时发生异常:', error)
      try {
        this.notifications.error(`❌ 执行命令失败: ${error.message || '未知错误'}`)
      } catch (notificationError) {
        console.error(`❌ 执行命令失败: ${error.message || '未知错误'}`)
      }
      return false
    }
  }

  /**
   * 查找活动终端
   */
  private async findActiveTerminal(activeTab: BaseTabComponent): Promise<BaseTabComponent | null> {
    console.log('[CommandExecutor] 开始查找活动终端, activeTab类型:', activeTab.constructor.name)
    
    // 如果当前标签页本身就是终端
    if (this.isTerminalTab(activeTab)) {
      console.log('[CommandExecutor] 当前标签页本身就是终端')
      return activeTab
    }

    // 如果是分割标签页，查找其中的终端
    const activeTabAny = activeTab as any
    console.log('[CommandExecutor] 检查分割标签页, getAllTabs方法:', typeof activeTabAny.getAllTabs)
    
    if (activeTabAny.getAllTabs && typeof activeTabAny.getAllTabs === 'function') {
      const allTabs = activeTabAny.getAllTabs()
      console.log('[CommandExecutor] 分割标签页中的所有标签页:', allTabs.map((tab: any) => tab.constructor.name))
      
      // 优先查找有焦点的终端
      const focusedTerminal = allTabs.find((tab: any) => {
        const isFocused = tab.hasFocus
        const isTerminal = this.isTerminalTab(tab)
        console.log(`[CommandExecutor] 标签页 ${tab.constructor.name}: hasFocus=${isFocused}, isTerminal=${isTerminal}`)
        return isFocused && isTerminal
      })
      
      if (focusedTerminal) {
        console.log('[CommandExecutor] 找到有焦点的终端:', focusedTerminal.constructor.name)
        return focusedTerminal
      }

      // 查找第一个终端
      const firstTerminal = allTabs.find((tab: any) => this.isTerminalTab(tab))
      if (firstTerminal) {
        console.log('[CommandExecutor] 找到第一个终端:', firstTerminal.constructor.name)
        return firstTerminal
      }
    }

    console.log('[CommandExecutor] 未找到任何终端')
    return null
  }

  /**
   * 检查是否是终端标签页
   */
  private isTerminalTab(tab: BaseTabComponent): boolean {
    if (!tab) return false
    
    const tabAny = tab as any
    const constructorName = tab.constructor.name
    
    // 检查是否有sendInput方法
    const hasSendInput = (tabAny.frontend && typeof tabAny.frontend.sendInput === 'function') || 
                        typeof tabAny.sendInput === 'function'
    
    // 检查构造函数名称
    const isTerminalClass = constructorName.includes('Terminal') ||
                           constructorName.includes('Local') ||
                           constructorName.includes('SSH') ||
                           constructorName.includes('Serial') ||
                           constructorName.includes('Telnet')
    
    console.log(`[CommandExecutor] 检查标签页 ${constructorName}: hasSendInput=${hasSendInput}, isTerminalClass=${isTerminalClass}`)
    
    return hasSendInput || isTerminalClass
  }
}