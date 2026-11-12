import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

/** Page title block. Actions (buttons, filters) go in the projected slot. */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="page-header">
      <div>
        <p class="section-label" *ngIf="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }
      .page-header .section-label {
        margin-bottom: 6px;
        letter-spacing: 0.09em;
        color: var(--accent);
      }
      .subtitle {
        max-width: 640px;
        margin-top: 6px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--ink-2);
      }
      .actions {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        flex-shrink: 0;
        padding-top: 4px;
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle?: string;
  @Input() eyebrow?: string;
}
