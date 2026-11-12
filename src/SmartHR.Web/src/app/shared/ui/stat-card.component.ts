import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

export type StatCardTone = 'default' | 'danger' | 'accent';

/** KPI card: 11px uppercase label, 28px tabular value, optional sub-line. */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="stat-card card">
      <p class="section-label">{{ label }}</p>
      <p class="value" [class.value-danger]="tone === 'danger'" [class.value-accent]="tone === 'accent'">
        {{ value }}
      </p>
      <p class="sub" *ngIf="sub">{{ sub }}</p>
      <ng-content />
    </div>
  `,
  styles: [
    `
      .stat-card {
        min-width: 0;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        transition:
          border-color 150ms ease,
          box-shadow 150ms ease;
      }
      .stat-card:hover {
        border-color: var(--border-strong);
      }
      .stat-card .section-label {
        margin-bottom: 0;
      }
      .value {
        margin-top: 10px;
        font-size: 30px;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .value-danger {
        color: var(--danger);
      }
      .value-accent {
        color: var(--accent);
      }
      .sub {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--muted);
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() sub?: string;
  @Input() tone: StatCardTone = 'default';
}
