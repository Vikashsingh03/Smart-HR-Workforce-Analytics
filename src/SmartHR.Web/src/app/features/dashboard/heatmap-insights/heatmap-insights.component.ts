import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/api.service';
import type {
  ActionRow,
  MatrixRow,
  RateRow,
  SatisfactionRow,
  Summary,
} from '../../../core/models';
import { HeatmapComponent } from '../../../shared/charts/heatmap.component';

interface Finding {
  title: string;
  text: string;
  severity: 'high' | 'medium' | 'low';
  source: string;
}

type Severity = Finding['severity'];

interface InsightsData {
  matrix: MatrixRow[];
  summary: Summary;
  dept: RateRow[];
  overtime: RateRow[];
  roles: RateRow[];
  satisfaction: SatisfactionRow[];
  tenure: RateRow[];
  income: RateRow[];
  actionFirst: ActionRow[];
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtRate(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDiff(n: number): string {
  return n.toFixed(2);
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, row) => (!best || row.rate > best.rate ? row : best),
    undefined,
  );
}

function findGroup(rows: RateRow[], names: string[]): RateRow | undefined {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return rows.find((row) => wanted.has(row.group.toLowerCase()));
}

function severityForRate(rate: number): Severity {
  if (rate >= 25) {
    return 'high';
  }
  if (rate >= 15) {
    return 'medium';
  }
  return 'low';
}

function severityForGap(gap: number): Severity {
  if (gap >= 15) {
    return 'high';
  }
  if (gap >= 8) {
    return 'medium';
  }
  return 'low';
}

/**
 * Hottest department x role combination. Cells with fewer than 10 people are
 * ignored so a one-person cell at 100% cannot dominate the takeaway; if no
 * cell reaches 10 people, the hottest cell overall is used.
 */
function hottestCell(matrix: MatrixRow[]): MatrixRow | undefined {
  const solid = matrix.filter((cell) => cell.total >= 10);
  const pool = solid.length > 0 ? solid : matrix;
  return pool.reduce<MatrixRow | undefined>(
    (best, cell) => (!best || cell.rate > best.rate ? cell : best),
    undefined,
  );
}

function buildFindings(data: InsightsData): Finding[] {
  const findings: Finding[] = [];

  const topDept = topByRate(data.dept);
  if (topDept) {
    findings.push({
      title: `${topDept.group} loses people fastest`,
      text:
        `${topDept.group} has the highest attrition at ${fmtRate(topDept.rate)} — ` +
        `${fmtInt(topDept.left)} of ${fmtInt(topDept.total)} employees left.`,
      severity: severityForRate(topDept.rate),
      source: 'Q1 · Attrition by department',
    });
  }

  const otYes = findGroup(data.overtime, ['yes', '1', 'true', 'overtime']);
  const otNo = findGroup(data.overtime, ['no', '0', 'false']);
  if (otYes && otNo) {
    const gap = otYes.rate - otNo.rate;
    findings.push({
      title: 'Overtime is the strongest single driver',
      text:
        `Employees working overtime leave at ${fmtRate(otYes.rate)}, against ` +
        `${fmtRate(otNo.rate)} for those who do not — a gap of ${gap.toFixed(1)} points. ` +
        `Of the ${fmtInt(data.summary.attritionCount)} people who left, ` +
        `${fmtInt(otYes.left)} worked overtime.`,
      severity: severityForGap(gap),
      source: 'Q2 · Overtime and attrition',
    });
  }

  const early = findGroup(data.tenure, ['0-2']);
  const late = findGroup(data.tenure, ['10+']);
  if (early) {
    findings.push({
      title: 'The first two years are the riskiest',
      text: late
        ? `${fmtRate(early.rate)} of employees in their first two years left, against ` +
          `${fmtRate(late.rate)} for those with 10 or more years.`
        : `${fmtRate(early.rate)} of employees in their first two years left — the highest of any tenure band.`,
      severity: severityForRate(early.rate),
      source: 'Q5 · Tenure',
    });
  }

  const lowBand = findGroup(data.income, ['<3000']);
  const highBand = findGroup(data.income, ['>10000']);
  if (lowBand) {
    findings.push({
      title: 'Low pay leaves fastest',
      text: highBand
        ? `Employees earning under $3,000 a month leave at ${fmtRate(lowBand.rate)}, against ` +
          `${fmtRate(highBand.rate)} for those earning over $10,000.`
        : `Employees earning under $3,000 a month leave at ${fmtRate(lowBand.rate)} — the highest of any income band.`,
      severity: severityForRate(lowBand.rate),
      source: 'Q6 · Income',
    });
  }

  const topRole = topByRate(data.roles);
  if (topRole) {
    findings.push({
      title: `${topRole.group} is the highest-risk role`,
      text:
        `${topRole.group} loses people at ${fmtRate(topRole.rate)} — ` +
        `${fmtInt(topRole.left)} of ${fmtInt(topRole.total)} employees left.`,
      severity: severityForRate(topRole.rate),
      source: 'Q3 · Attrition by role',
    });
  }

  const left = data.satisfaction.find((row) => row.attrition === 1);
  const stayed = data.satisfaction.find((row) => row.attrition === 0);
  if (left && stayed) {
    const diff = stayed.avgJobSatisfaction - left.avgJobSatisfaction;
    findings.push({
      title: 'Leavers were less satisfied',
      text:
        `People who left averaged ${fmtDiff(left.avgJobSatisfaction)} job satisfaction, against ` +
        `${fmtDiff(stayed.avgJobSatisfaction)} for those who stayed — a gap of ${fmtDiff(diff)} on a 4-point scale.`,
      severity: diff >= 0.5 ? 'high' : diff >= 0.25 ? 'medium' : 'low',
      source: 'Q4 · Satisfaction',
    });
  }

  const first = data.actionFirst[0];
  if (first) {
    findings.push({
      title: `Act first: ${first.department} ${first.jobRole}`,
      text:
        `Start with ${first.jobRole} in ${first.department}: ${fmtRate(first.rate)} attrition ` +
        `across ${fmtInt(first.total)} people — the largest group that is both big and high-risk.`,
      severity: severityForRate(first.rate),
      source: 'Q7 · Where HR should act first',
    });
  }

  return findings;
}

@Component({
  selector: 'app-heatmap-insights',
  standalone: true,
  imports: [CommonModule, HeatmapComponent],
  templateUrl: './heatmap-insights.component.html',
  styleUrls: ['./heatmap-insights.component.css'],
})
export class HeatmapInsightsComponent implements OnInit {
  private readonly api = inject(ApiService);

  matrix: MatrixRow[] = [];
  findings: Finding[] = [];
  hottestCellText = '';
  loading = true;
  error = '';

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      matrix: this.api.getDepartmentRoleMatrix(),
      summary: this.api.getSummary(),
      dept: this.api.getAttritionByDepartment(),
      overtime: this.api.getOvertime(),
      roles: this.api.getAttritionByRole(),
      satisfaction: this.api.getSatisfaction(),
      tenure: this.api.getTenure(),
      income: this.api.getIncome(),
      actionFirst: this.api.getActionFirst(),
    }).subscribe({
      next: (data) => {
        this.matrix = data.matrix;
        const hot = hottestCell(data.matrix);
        this.hottestCellText = hot
          ? `Highest-risk combination: ${hot.jobRole} in ${hot.department} — ` +
            `${fmtRate(hot.rate)} attrition (${fmtInt(hot.left)} of ${fmtInt(hot.total)} people).`
          : '';
        this.findings = buildFindings(data);
        this.loading = false;
      },
      error: () => {
        this.error =
          'The analytics service did not answer. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }
}
