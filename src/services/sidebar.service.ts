import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class AISidebarService {
  private visibilitySubject = new BehaviorSubject<boolean>(false)
  public visibility$ = this.visibilitySubject.asObservable()

  private sidebarComponent: any = null

  get isVisible(): boolean {
    return this.visibilitySubject.value
  }

  setSidebarComponent(component: any) {
    this.sidebarComponent = component
  }

  show() {
    if (this.sidebarComponent) {
      this.sidebarComponent.show()
      this.visibilitySubject.next(true)
    }
  }

  hide() {
    if (this.sidebarComponent) {
      this.sidebarComponent.hide()
      this.visibilitySubject.next(false)
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }
}