import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../../core/api.service';
import type { RateRow, Summary } from '../../../core/models';
import { SparklineComponent } from '../../../shared/charts/sparkline.component';
import { CountUpDirective } from '../../../shared/motion/count-up.directive';

interface DeltaPart {
  text: string;
  strong?: boolean;
  danger?: boolean;
}

interface KpiCard {
  id: 'total' | 'attrition' | 'departments' | 'income';
  label: string;
  value: number;
  /** Decimals for the count-up animation (attrition rate needs 1, the rest 0). */
  decimals: number;
  prefix: string;
  suffix: string;
  /** Formatted final value, e.g. "1,470" — shown before the count-up runs. */
  display: string;
  spark: number[];
  sparkCaption: string;
  delta: DeltaPart[];
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

function fmtRate(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** "<3000" -> "<$3,000", "3000-6000" -> "$3,000–$6,000", ">10000" -> ">$10,000". */
function fmtIncomeBand(group: string): string {
  if (group.startsWith('<')) {
    return `<$${Number(group.slice(1)).toLocaleString('en-IN')}`;
  }
  if (group.startsWith('>')) {
    return `>$${Number(group.slice(1)).toLocaleString('en-IN')}`;
  }
  const parts = group.split('-');
  if (parts.length === 2) {
    return `$${Number(parts[0]).toLocaleString('en-IN')}–$${Number(parts[1]).toLocaleString('en-IN')}`;
  }
  return group;
}

function topByRate(rows: RateRow[]): RateRow | null {
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((best, row) => (row.rate > best.rate ? row : best), rows[0]);
}

function largestByTotal(rows: RateRow[]): RateRow | null {
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((best, row) => (row.total > best.total ? row : best), rows[0]);
}

/**
 * KPI row for the dashboard: four cards, each with a count-up value, a
 * sparkline of a real series from the API, and a delta line computed from
 * the same live data. Fetches its own data; no inputs.
 */
@Component({
  selector: 'app-kpi-row',
  standalone: true,
  imports: [CommonModule, SparklineComponent, CountUpDirective],
  templateUrl: './kpi-row.component.html',
  styleUrls: ['./kpi-row.component.css'],
})
export class KpiRowComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = true;
  error = false;
  cards: KpiCard[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    forkJoin({
      summary: this.api.getSummary().pipe(catchError(() => of(null))),
      dept: this.api.getAttritionByDepartment().pipe(catchError(() => of(null))),
      tenure: this.api.getTenure().pipe(catchError(() => of(null))),
      income: this.api.getIncome().pipe(catchError(() => of(null))),
    }).subscribe((data) => {
      this.loading = false;
      if (!data.summary) {
        this.error = true;
        return;
      }
      this.cards = this.buildCards(
        data.summary,
        data.dept ?? [],
        data.tenure ?? [],
        data.income ?? [],
      );
    });
  }

  private buildCards(
    summary: Summary,
    dept: RateRow[],
    tenure: RateRow[],
    income: RateRow[],
  ): KpiCard[] {
    const stayed = summary.totalEmployees - summary.attritionCount;
    const topDept = topByRate(dept);
    const largestDept = largestByTotal(dept);
    const lowestBand = income.length > 0 ? income[0] : null;
    const topBand = income.length > 0 ? income[income.length - 1] : null;

    const attritionDelta: DeltaPart[] = topDept
      ? [
          { text: `${topDept.group} runs ` },
          {
            text: `+${(topDept.rate - summary.attritionRate).toFixed(1)} pts`,
            strong: true,
            danger: true,
          },
          { text: ` above the company rate of ${summary.attritionRate.toFixed(1)}%.` },
        ]
      : [
          {
            text: `${fmtInt(summary.attritionCount)} of ${fmtInt(summary.totalEmployees)} people left.`,
          },
        ];

    const departmentsDelta: DeltaPart[] = largestDept
      ? [
          { text: `${largestDept.group} is the largest — ` },
          {
            text: `${fmtInt(largestDept.total)} of ${fmtInt(summary.totalEmployees)} people (${summary.totalEmployees > 0 ? ((largestDept.total / summary.totalEmployees) * 100).toFixed(1) : '0.0'}%)`,
            strong: true,
          },
          { text: '.' },
        ]
      : [{ text: `${summary.departmentCount} departments in the sample.` }];

    const incomeDelta: DeltaPart[] =
      lowestBand && topBand
        ? [
            { text: `Lowest band (${fmtIncomeBand(lowestBand.group)}) leaves at ` },
            { text: fmtRate(lowestBand.rate), strong: true, danger: true },
            { text: ` vs ` },
            { text: fmtRate(topBand.rate), strong: true },
            { text: ` at the top.` },
          ]
        : [{ text: 'Average across all employees.' }];

    return [
      {
        id: 'total',
        label: 'Total employees',
        value: summary.totalEmployees,
        decimals: 0,
        prefix: '',
        suffix: '',
        display: fmtInt(summary.totalEmployees),
        spark: tenure.map((row) => row.total),
        sparkCaption: 'Headcount by tenure band',
        delta: [
          { text: `${fmtInt(stayed)} stayed · ` },
          { text: `${fmtInt(summary.attritionCount)} left`, strong: true },
        ],
      },
      {
        id: 'attrition',
        label: 'Attrition rate',
        value: summary.attritionRate,
        decimals: 1,
        prefix: '',
        suffix: '%',
        display: summary.attritionRate.toFixed(1),
        spark: dept.map((row) => row.rate),
        sparkCaption: 'Attrition rate by department',
        delta: attritionDelta,
      },
      {
        id: 'departments',
        label: 'Departments',
        value: summary.departmentCount,
        decimals: 0,
        prefix: '',
        suffix: '',
        display: fmtInt(summary.departmentCount),
        spark: dept.map((row) => row.total),
        sparkCaption: 'Headcount by department',
        delta: departmentsDelta,
      },
      {
        id: 'income',
        label: 'Avg monthly income',
        value: summary.avgMonthlyIncome,
        decimals: 0,
        prefix: '$',
        suffix: '',
        display: fmtInt(summary.avgMonthlyIncome),
        spark: income.map((row) => row.total),
        sparkCaption: 'Headcount by income band',
        delta: incomeDelta,
      },
    ];
  }
}
