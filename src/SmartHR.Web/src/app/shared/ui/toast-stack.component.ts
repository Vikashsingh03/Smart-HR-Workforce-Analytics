import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastMessage, ToastService } from './toast.service';

/** Renders toasts from ToastService, bottom-right, auto-dismiss after
    4.2 seconds. Include ONCE — ideally in the app shell. Styling lives in
    styles.css (.toast-stack / .toast). */
@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [NgFor],
  template: `
    <div class="toast-stack" aria-live="polite">
      <div *ngFor="let toast of toasts" class="toast" [class]="'toast toast-' + toast.tone" role="status">
        <span class="toast-message">{{ toast.message }}</span>
        <button type="button" class="toast-close" (click)="dismiss(toast.id)" aria-label="Dismiss notification">
          &#215;
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .toast-stack {
        right: 20px;
        bottom: 20px;
        gap: 10px;
      }
      .toast {
        align-items: flex-start;
        padding: 12px 14px;
        border-radius: 8px;
        color: var(--ink);
        line-height: 1.5;
        animation: toast-in 200ms ease;
      }
      .toast::before {
        content: '';
        flex-shrink: 0;
        width: 8px;
        height: 8px;
        margin-top: 6px;
        border-radius: 50%;
        background: var(--muted);
      }
      .toast-ok {
        background: rgba(47, 107, 58, 0.05);
      }
      .toast-ok::before {
        background: var(--ok);
      }
      .toast-danger {
        background: rgba(168, 50, 38, 0.05);
      }
      .toast-danger::before {
        background: var(--danger);
      }
      .toast-info {
        background: rgba(14, 94, 84, 0.05);
      }
      .toast-info::before {
        background: var(--accent);
      }
      .toast-message {
        font-size: 13px;
        font-weight: 500;
      }
      .toast-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 6px;
        font-size: 16px;
        transition:
          background-color 150ms ease,
          color 150ms ease;
      }
      .toast-close:hover {
        background: var(--surface-2);
        color: var(--ink);
      }
      .toast-close:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      @media (prefers-reduced-motion: reduce) {
        .toast {
          animation: none;
        }
      }
    `,
  ],
})
export class ToastStackComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private subscription: Subscription | null = null;

  constructor(private readonly toastService: ToastService) {}

  ngOnInit(): void {
    this.subscription = this.toastService.messages$.subscribe((toast) => {
      this.toasts = [...this.toasts, toast];
      window.setTimeout(() => this.dismiss(toast.id), 4200);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
