import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

/** Underline tabs. The parent owns the active id and renders the matching
    panel with *ngIf. Styling lives in styles.css (.tabs / .tab). */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <div class="tabs" role="tablist">
      <button
        *ngFor="let tab of tabs"
        type="button"
        role="tab"
        class="tab"
        [attr.aria-selected]="tab.id === activeId"
        [disabled]="tab.disabled"
        (click)="selected.emit(tab.id)"
      >
        {{ tab.label
        }}<span class="tab-count" *ngIf="tab.count !== undefined">{{ tab.count }}</span>
      </button>
    </div>
  `,
  styles: [
    `
      .tabs {
        gap: 4px;
      }
      .tab {
        padding: 9px 12px;
        border-radius: 6px 6px 0 0;
        transition:
          color 150ms ease,
          background-color 150ms ease,
          border-color 150ms ease;
      }
      .tab:hover:not(:disabled) {
        color: var(--ink);
        background: var(--surface-2);
      }
      .tab[aria-selected='true'] {
        color: var(--accent);
        border-bottom-color: var(--accent);
        background: var(--accent-soft);
        font-weight: 600;
      }
      .tab[aria-selected='true'] .tab-count {
        background: rgba(14, 94, 84, 0.14);
        color: var(--accent-ink);
      }
      .tab:disabled {
        opacity: 0.45;
      }
      .tab:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
      .tab-count {
        padding: 1px 7px;
      }
    `,
  ],
})
export class TabsComponent {
  @Input({ required: true }) tabs: TabItem[] = [];
  @Input() activeId = '';
  @Output() selected = new EventEmitter<string>();
}
