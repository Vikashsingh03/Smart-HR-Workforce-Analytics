import { Component, Input } from '@angular/core';

/** Error banner: 3px danger left border, plain text. Never a stack trace. */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  template: `<div class="error-banner" role="alert">{{ message }}</div>`,
  styles: [
    `
      .error-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid var(--border);
        border-left: 3px solid var(--danger);
        border-radius: 8px;
        background: rgba(168, 50, 38, 0.06);
        color: var(--ink);
        font-size: 14px;
        line-height: 1.5;
      }
      .error-banner::before {
        content: '!';
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 1px;
        border-radius: 50%;
        background: rgba(168, 50, 38, 0.12);
        color: var(--danger);
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }
    `,
  ],
})
export class ErrorBannerComponent {
  @Input({ required: true }) message = '';
}
