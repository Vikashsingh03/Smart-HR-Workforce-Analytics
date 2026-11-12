import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastTone = 'info' | 'ok' | 'danger';

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

/** App-wide toasts. Inject and call show/ok/error from anywhere.
    Render once with <app-toast-stack></app-toast-stack> — ideally once in
    the app shell so every page can use it. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messagesSubject = new Subject<ToastMessage>();
  readonly messages$ = this.messagesSubject.asObservable();
  private nextId = 1;

  show(message: string, tone: ToastTone = 'info'): void {
    this.messagesSubject.next({ id: this.nextId++, message, tone });
  }

  ok(message: string): void {
    this.show(message, 'ok');
  }

  error(message: string): void {
    this.show(message, 'danger');
  }
}
