import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import type { ActionRow } from '../../../core/models';
import { BadgeComponent, type BadgeTone } from '../../../shared/ui/badge.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { ErrorBannerComponent } from '../../../shared/ui/error-banner.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

type SortKey = 'department' | 'jobRole' | 'total' | 'left' | 'rate';
type SortDir = 'asc' | 'desc';

interface Severity {
  label: string;
  tone: BadgeTone;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtRate(n: number): string {
  return n.toFixed(1) + '%';
}

const RANK_WORDS = ['largest', 'second-largest', 'third-largest'];

/**
 * Q7 — "Where HR should act first". Department x job-role groups with
 * headcount >= 50, ordered by attrition rate (API order). Sortable columns,
 * severity badges, a "Why it matters" callout for the top 3 priorities,
 * and a working department filter. All numbers come from the API.
 */
@Component({
  selector: 'app-action-table',
  standalone: true,
  imports: [
    CommonModule,
    BadgeComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    SkeletonComponent,
  ],
  templateUrl: './action-table.component.html',
  styleUrl: './action-table.component.css',
})
export class ActionTableComponent implements OnInit {
  loading = true;
  error = '';

  rows: ActionRow[] = [];
  departments: string[] = [];
  selectedDepartment = 'all';

  sortKey: SortKey = 'rate';
  sortDir: SortDir = 'desc';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getActionFirst().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.departments = [...new Set(rows.map((r) => r.department))].sort((a, b) =>
          a.localeCompare(b),
        );
        this.loading = false;
      },
      error: () => {
        this.error =
          'The action list could not be loaded. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }

  onDepartmentChange(event: Event): void {
    this.selectedDepartment = (event.target as HTMLSelectElement).value;
  }

  clearFilter(): void {
    this.selectedDepartment = 'all';
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = key === 'department' || key === 'jobRole' ? 'asc' : 'desc';
    }
  }

  /** Rows after the department filter, in the current sort order. */
  get filteredRows(): ActionRow[] {
    const filtered =
      this.selectedDepartment === 'all'
        ? [...this.rows]
        : this.rows.filter((r) => r.department === this.selectedDepartment);
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp: number;
      if (this.sortKey === 'department' || this.sortKey === 'jobRole') {
        cmp = a[this.sortKey].localeCompare(b[this.sortKey]);
      } else {
        cmp = a[this.sortKey] - b[this.sortKey];
      }
      if (cmp !== 0) {
        return cmp * dir;
      }
      // Deterministic tie-break: highest rate first, then department, then role.
      return (
        b.rate - a.rate ||
        a.department.localeCompare(b.department) ||
        a.jobRole.localeCompare(b.jobRole)
      );
    });
  }

  /** Top 3 company-wide priorities (ignores the department filter on purpose:
      the company's priorities do not change when the table is filtered). */
  get topReasons(): string[] {
    return [...this.rows]
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map((row, i) => this.reasonFor(row, i));
  }

  severity(row: ActionRow): Severity {
    if (row.rate >= 25) {
      return { label: 'Critical', tone: 'danger' };
    }
    if (row.rate >= 15) {
      return { label: 'High', tone: 'amber' };
    }
    if (row.rate >= 10) {
      return { label: 'Watch', tone: 'neutral' };
    }
    return { label: 'Low', tone: 'ok' };
  }

  formatInt(n: number): string {
    return fmtInt(n);
  }

  formatRate(n: number): string {
    return fmtRate(n);
  }

  private reasonFor(row: ActionRow, index: number): string {
    const rank = RANK_WORDS[index] ?? 'largest';
    const base =
      `${row.jobRole} in ${row.department} loses ${fmtRate(row.rate)} of its people — ` +
      `${fmtInt(row.left)} of ${fmtInt(row.total)} left. ` +
      `That is the ${rank} attrition pocket in the company.`;
    const action =
      index === 0
        ? ' Start stay interviews here first.'
        : ' Review overtime and pay against similar roles.';
    return base + action;
  }
}
