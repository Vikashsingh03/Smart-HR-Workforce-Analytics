import { Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';

/** Loading placeholder: neutral blocks with a gentle opacity pulse.
    No gradient shimmer, no spinning loader. */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [NgFor],
  template: `
    <div class="skeleton" role="status" aria-label="Loading">
      <div class="sk-block" *ngFor="let i of lineArray" [style.width.%]="widths[i % widths.length]"></div>
    </div>
  `,
  styles: [
    `
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 0;
      }
      .sk-block {
        height: 14px;
        border-radius: 6px;
        background: var(--surface-2);
        animation: sk-pulse 1.4s ease-in-out infinite;
      }
      .sk-block:first-child {
        height: 18px;
      }
      .sk-block:nth-child(2) {
        animation-delay: 0.15s;
      }
      .sk-block:nth-child(3) {
        animation-delay: 0.3s;
      }
      .sk-block:nth-child(4) {
        animation-delay: 0.45s;
      }
      @keyframes sk-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk-block {
          animation: none;
          opacity: 0.7;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  @Input() lines = 3;

  readonly widths = [100, 82, 64, 90];

  get lineArray(): number[] {
    return Array.from({ length: Math.max(1, this.lines) }, (_, i) => i);
  }
}
