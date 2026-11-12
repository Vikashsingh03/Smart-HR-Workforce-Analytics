import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

/** One plain sentence plus the action that fixes it. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" />
          <path d="M4 13h4l2 3h4l2-3h4" />
          <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
        </svg>
      </span>
      <p>{{ message }}</p>
      <button type="button" class="btn" *ngIf="actionLabel" (click)="actionClick.emit()">
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: [
    `
      .empty-state {
        padding: 40px 24px;
        text-align: center;
        color: var(--ink-2);
        font-size: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
      }
      .empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        margin-bottom: 14px;
        border-radius: 50%;
        background: var(--surface-2);
        color: var(--muted);
      }
      .empty-icon svg {
        display: block;
      }
      .empty-state p {
        max-width: 420px;
        margin: 0 auto;
        line-height: 1.55;
      }
      .empty-state .btn {
        margin-top: 16px;
      }
      .empty-state .btn:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input({ required: true }) message = '';
  @Input() actionLabel?: string;
  @Output() actionClick = new EventEmitter<void>();
}
