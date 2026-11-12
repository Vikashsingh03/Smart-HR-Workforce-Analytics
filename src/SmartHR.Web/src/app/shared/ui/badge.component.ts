import { Component, Input } from '@angular/core';

export type BadgeTone = 'danger' | 'ok' | 'neutral' | 'amber' | 'accent';

/** Small status pill. Danger is reserved for attrition ("Left").
    Label via the `text` input, or as projected content:
    `<app-badge tone="ok">Stayed</app-badge>`. */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span [class]="'badge badge-' + tone">{{ text }}<ng-content /></span>`,
  styles: [
    `
      .badge {
        display: inline-block;
        padding: 3px 9px;
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.01em;
        line-height: 1.5;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .badge-danger {
        background: rgba(168, 50, 38, 0.08);
        border-color: rgba(168, 50, 38, 0.22);
        color: var(--danger);
      }
      .badge-ok {
        background: rgba(47, 107, 58, 0.08);
        border-color: rgba(47, 107, 58, 0.22);
        color: var(--ok);
      }
      .badge-neutral {
        background: var(--surface-2);
        border-color: var(--border);
        color: var(--ink-2);
      }
      .badge-amber {
        background: rgba(154, 106, 20, 0.09);
        border-color: rgba(154, 106, 20, 0.25);
        color: var(--amber);
      }
      .badge-accent {
        background: rgba(14, 94, 84, 0.08);
        border-color: rgba(14, 94, 84, 0.22);
        color: var(--accent);
      }
    `,
  ],
})
export class BadgeComponent {
  @Input() text = '';
  @Input() tone: BadgeTone = 'neutral';
}
