import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import type {
  AiExplainResult,
  RateRow,
  Summary,
} from '../../../core/models';
import { BaseChartComponent } from '../../../shared/charts/base-chart.component';
import { ErrorBannerComponent } from '../../../shared/ui/error-banner.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';

/**
 * Department charts (Q1 + Q2 + Q3) for the v2 dashboard.
 * Standalone, no inputs — fetches its own data via ApiService.
 *
 * Q1 and Q3 are hand-built horizontal bars (HTML/CSS): the shared
 * base-chart has no horizontal-axis mode and no value-label plugin, and no
 * new packages are allowed, so ranked bars with value labels are rendered
 * as precise div bars with tabular numerals. Q2 uses app-base-chart for
 * both the comparative bars and the leaver-composition doughnut.
 * No Chart.js import in this file.
 */

type ChartId = 'dept' | 'overtime' | 'role';

interface HBarRow {
  label: string;
  rate: number;
  total: number;
  left: number;
  /** Bar width in percent of the fastest rate in the set. */
  width: number;
}

interface AiState {
  loading: boolean;
  result: AiExplainResult | null;
  error: string;
}

const TEAL = '#0E5E54';
const SLATE = '#5B6B7A';
const BRICK = '#A83226';

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtRate(n: number): string {
  return n.toFixed(1) + '%';
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, row) => (!best || row.rate > best.rate ? row : best),
    undefined,
  );
}

function findGroup(rows: RateRow[], names: string[]): RateRow | undefined {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return rows.find((row) => wanted.has(row.group.trim().toLowerCase()));
}

@Component({
  selector: 'app-charts-dept',
  standalone: true,
  imports: [CommonModule, BaseChartComponent, ErrorBannerComponent, SkeletonComponent],
  templateUrl: './charts-dept.component.html',
  styleUrl: './charts-dept.component.css',
})
export class ChartsDeptComponent implements OnInit {
  loading = true;
  error = '';

  summary: Summary | null = null;

  deptBars: HBarRow[] = [];
  roleBars: HBarRow[] = [];

  overtimeBarLabels: string[] = [];
  overtimeBarDatasets: { label: string; data: number[]; backgroundColor: string[] }[] = [];
  doughnutLabels: string[] = [];
  doughnutDatasets: { label: string; data: number[]; backgroundColor: string[] }[] = [];

  takeawayQ1 = '';
  takeawayQ2 = '';
  takeawayQ3 = '';

  ai: Record<ChartId, AiState> = {
    dept: { loading: false, result: null, error: '' },
    overtime: { loading: false, result: null, error: '' },
    role: { loading: false, result: null, error: '' },
  };

  private aiFacts: Record<ChartId, { label: string; value: string | number }[]> = {
    dept: [],
    overtime: [],
    role: [],
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      summary: this.api.getSummary(),
      dept: this.api.getAttritionByDepartment(),
      overtime: this.api.getOvertime(),
      roles: this.api.getAttritionByRole(),
    }).subscribe({
      next: (data) => {
        this.summary = data.summary;
        this.buildDept(data.dept);
        this.buildOvertime(data.overtime, data.summary);
        this.buildRoles(data.roles);
        this.loading = false;
      },
      error: () => {
        this.error =
          'The department charts could not be loaded. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }

  aiState(id: ChartId): AiState {
    return this.ai[id];
  }

  explain(id: ChartId): void {
    const titles: Record<ChartId, string> = {
      dept: 'Attrition by department',
      overtime: 'Overtime and attrition',
      role: 'Attrition by job role',
    };
    this.ai[id] = { loading: true, result: null, error: '' };
    this.api
      .explainAi({ title: titles[id], facts: this.aiFacts[id] })
      .subscribe({
        next: (result) => {
          this.ai[id] = { loading: false, result, error: '' };
        },
        error: () => {
          this.ai[id] = {
            loading: false,
            result: null,
            error: 'The explanation could not be loaded. Try again.',
          };
        },
      });
  }

  private buildDept(dept: RateRow[]): void {
    const top = topByRate(dept);
    const maxRate = top ? top.rate : 0;
    this.deptBars = dept.map((d) => ({
      label: d.group,
      rate: d.rate,
      total: d.total,
      left: d.left,
      width: maxRate > 0 ? (d.rate / maxRate) * 100 : 0,
    }));
    this.takeawayQ1 = top
      ? `${top.group} loses people fastest at ${fmtRate(top.rate)} — ` +
        `${fmtInt(top.left)} of ${fmtInt(top.total)} employees left.`
      : 'No department data was returned.';
    const summary = this.summary;
    this.aiFacts['dept'] = [
      { label: 'Overall attrition rate (%)', value: summary?.attritionRate ?? 0 },
      ...dept.map((d) => ({
        label: `Attrition rate — ${d.group} (%)`,
        value: d.rate,
      })),
      { label: 'Total employees', value: summary?.totalEmployees ?? 0 },
    ];
  }

  private buildOvertime(overtime: RateRow[], summary: Summary): void {
    const otYes = findGroup(overtime, ['yes', '1', 'true', 'overtime']);
    const otNo = findGroup(overtime, ['no', '0', 'false']);
    const leftYes = otYes?.left ?? 0;
    const leftNo = otNo?.left ?? 0;

    // Comparative bars: attrition rate with vs without overtime.
    this.overtimeBarLabels = ['No overtime', 'Overtime'];
    this.overtimeBarDatasets = [
      {
        label: 'Attrition rate (%)',
        data: [otNo?.rate ?? 0, otYes?.rate ?? 0],
        backgroundColor: [SLATE, BRICK],
      },
    ];

    // Doughnut: composition of the people who left.
    this.doughnutLabels = ['No overtime', 'Overtime'];
    this.doughnutDatasets = [
      {
        label: 'People who left',
        data: [leftNo, leftYes],
        backgroundColor: [SLATE, BRICK],
      },
    ];

    this.takeawayQ2 =
      otYes && otNo
        ? `Of the ${fmtInt(summary.attritionCount)} people who left, ${fmtInt(leftYes)} worked overtime. ` +
          `Overtime staff leave at ${fmtRate(otYes.rate)}, compared with ${fmtRate(otNo.rate)} for the rest.`
        : 'No overtime data was returned.';
    this.aiFacts['overtime'] = [
      { label: 'Attrition rate — overtime (%)', value: otYes?.rate ?? 0 },
      { label: 'Attrition rate — no overtime (%)', value: otNo?.rate ?? 0 },
      { label: 'People who left and worked overtime', value: leftYes },
      { label: 'People who left in total', value: summary.attritionCount },
    ];
  }

  private buildRoles(roles: RateRow[]): void {
    const topRoles = roles.slice(0, 9);
    const top = topByRate(roles);
    const maxRate = top ? top.rate : 0;
    this.roleBars = topRoles.map((r) => ({
      label: r.group,
      rate: r.rate,
      total: r.total,
      left: r.left,
      width: maxRate > 0 ? (r.rate / maxRate) * 100 : 0,
    }));
    this.takeawayQ3 = top
      ? `${top.group} loses people fastest at ${fmtRate(top.rate)} — ` +
        `${fmtInt(top.left)} of ${fmtInt(top.total)} left.`
      : 'No job role data was returned.';
    const summary = this.summary;
    this.aiFacts['role'] = [
      { label: 'Overall attrition rate (%)', value: summary?.attritionRate ?? 0 },
      ...topRoles.slice(0, 3).map((r) => ({
        label: `Attrition rate — ${r.group} (%)`,
        value: r.rate,
      })),
    ];
  }
}
