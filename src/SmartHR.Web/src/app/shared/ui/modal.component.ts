import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

/** Dialog. The parent controls `open` and listens for `closed`.
    Closes on Escape, on backdrop click, or on the close button.
    Body goes in the default slot; footer actions go in [modal-footer].
    Styling lives in styles.css (.modal-backdrop / .modal). */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="modal-backdrop" *ngIf="open" (click)="onBackdropClick($event)">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title">
        <div class="modal-header">
          <h2 class="modal-title">{{ title }}</h2>
          <button
            type="button"
            class="btn btn-icon modal-close"
            (click)="closed.emit()"
            aria-label="Close dialog"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div class="modal-body"><ng-content /></div>
        <div class="modal-footer"><ng-content select="[modal-footer]" /></div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal {
        border-radius: 8px;
        box-shadow: 0 8px 28px rgba(18, 22, 26, 0.14);
        animation: modal-in 200ms ease;
      }
      .modal-header {
        align-items: center;
        padding: 18px 20px 14px;
        border-bottom: 1px solid var(--border);
      }
      .modal-title {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.3;
      }
      .modal-close {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        padding: 0;
        border-radius: 6px;
        color: var(--muted);
        transition:
          background-color 150ms ease,
          color 150ms ease;
      }
      .modal-close:hover:not(:disabled) {
        background: var(--surface-2);
        color: var(--ink);
      }
      .modal-close:active:not(:disabled) {
        transform: translateY(1px);
      }
      .modal-close:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .modal-body {
        padding: 16px 20px;
        line-height: 1.55;
      }
      .modal-footer {
        padding: 14px 20px;
        background: var(--bg);
        border-radius: 0 0 8px 8px;
      }
      @media (prefers-reduced-motion: reduce) {
        .modal {
          animation: none;
        }
      }
    `,
  ],
})
export class ModalComponent {
  @Input({ required: true }) title = '';
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
