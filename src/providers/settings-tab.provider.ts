import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { AIAssistantSettingsComponent } from '../components/settings.component'

@Injectable() 
export class AIAssistantSettingsTabProvider extends SettingsTabProvider {
  id = 'ai-assistant'
  icon = 'fas fa-robot'
  title = 'AI 助手'
  
  getComponentType() {
    return AIAssistantSettingsComponent
  }
}