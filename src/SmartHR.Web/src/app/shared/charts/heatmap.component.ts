import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MatrixRow } from '../../core/models';
import { HEATMAP_STEPS, heatmapColor } from './chart-theme';
import { formatNumberValue } from '../pipes/format-number.pipe';

/**
 * Department x role attrition heatmap (v2).
 *
 * One cell per department x job-role pair, coloured on a five-step scale
 * from the muted palette (flat colours only — no gradients). Each cell
 * shows the attrition rate and the headcount. The legend is rendered
 * inside the component so any consumer gets a complete heatmap.
 *
 * Input rows come from GET /api/analytics/department-role-matrix
 * (MatrixRow[] — department, jobRole, total, left, rate). The component
 * derives departments and roles from the rows in first-appearance order,
 * so it never assumes a fixed list. Pairs missing from the rows render
 * as an empty cell ("—").
 *
 * Usage:
 *   <app-heatmap [rows]="matrixRows" />
 */
@Component({
  selector: 'app-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './heatmap.component.html',
  styleUrl: './heatmap.component.css',
})
export class HeatmapComponent {
  @Input({ required: true }) rows: MatrixRow[] = [];

  readonly legendSteps = HEATMAP_STEPS;

  /** Departments in first-appearance order. */
  get departments(): string[] {
    return distinct((this.rows ?? []).map((row) => row.department));
  }

  /** Job roles in first-appearance order. */
  get roles(): string[] {
    return distinct((this.rows ?? []).map((row) => row.jobRole));
  }

  /** The matrix cell for a department x role pair, or null if absent. */
  cell(department: string, role: string): MatrixRow | null {
    return this.lookup().get(`${department}|${role}`) ?? null;
  }

  /** Flat background + text colour for a cell (null = empty cell). */
  cellStyle(row: MatrixRow | null): Record<string, string> {
    if (!row) {
      return { background: '#F4F3EF', color: '#8A867D' };
    }
    const step = heatmapColor(row.rate);
    return { background: step.background, color: step.color };
  }

  /** "20.6%" — the value shown in the cell. */
  cellRate(row: MatrixRow | null): string {
    return row ? `${formatNumberValue(row.rate, 'decimal1')}%` : '—';
  }

  /** Headcount shown under the rate. */
  cellTotal(row: MatrixRow | null): string {
    return row ? formatNumberValue(row.total) : '';
  }

  /** Hover detail: "Sales · Sales Executive: 39.8% (33 of 83 left)". */
  cellTitle(row: MatrixRow | null): string {
    if (!row) {
      return 'No employees in this department and role.';
    }
    return (
      `${row.department} · ${row.jobRole}: ` +
      `${formatNumberValue(row.rate, 'decimal1')}% attrition ` +
      `(${formatNumberValue(row.left)} of ${formatNumberValue(row.total)} left)`
    );
  }

  private cachedRows: MatrixRow[] | null = null;
  private cachedLookup = new Map<string, MatrixRow>();

  private lookup(): Map<string, MatrixRow> {
    if (this.cachedRows !== this.rows) {
      this.cachedRows = this.rows;
      this.cachedLookup = new Map(
        (this.rows ?? []).map((row) => [
          `${row.department}|${row.jobRole}`,
          row,
        ]),
      );
    }
    return this.cachedLookup;
  }
}

function distinct(values: string[]): string[] {
  return [...new Set(values)];
}
