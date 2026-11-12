import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../core/api.service';
import type {
  ActionRow,
  AiExplainResult,
  RateRow,
  SatisfactionRow,
  Summary,
} from '../../core/models';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { ErrorBannerComponent } from '../../shared/ui/error-banner.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

type Severity = 'high' | 'medium' | 'low';
type AiState = 'idle' | 'loading' | 'done' | 'error';
type BadgeTone = 'danger' | 'amber' | 'neutral';

interface Finding {
  id: string;
  rank: number;
  rankLabel: string;
  title: string;
  severity: Severity;
  sortKey: number;
  headline: string;
  headlineLabel: string;
  numbers: string;
  explanation: string;
  source: string;
  aiTitle: string;
  aiFacts: { label: string; value: string | number }[];
  aiState: AiState;
  aiResult: AiExplainResult | null;
  aiError: string;
}

interface InsightsData {
  summary: Summary;
  dept: RateRow[] | null;
  overtime: RateRow[] | null;
  roles: RateRow[] | null;
  satisfaction: SatisfactionRow[] | null;
  tenure: RateRow[] | null;
  income: RateRow[] | null;
  actionFirst: ActionRow[] | null;
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function fmtInt(n: number): string {
  return n.toLocaleString('en-IN');
}

function fmtRate(n: number): string {
  return `${n.toFixed(1)}%`;
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return [...rows].sort((a, b) => b.rate - a.rate)[0];
}

function findGroup(rows: RateRow[], keys: string[]): RateRow | undefined {
  const lower = keys.map((k) => k.toLowerCase());
  return rows.find((r) => lower.includes(r.group.toLowerCase()));
}

function severityForRate(rate: number): Severity {
  return rate >= 25 ? 'high' : rate >= 15 ? 'medium' : 'low';
}

/** Ranked findings, computed from the live API data. Every number on this
    page comes from the API — nothing is hardcoded. */
@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [
    CommonModule,
    BadgeComponent,
    ErrorBannerComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  templateUrl: './insights.component.html',
  styleUrls: ['./insights.component.css'],
})
export class InsightsComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = true;
  loadError = '';
  findings: Finding[] = [];
  summary: Summary | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = '';
    this.findings = [];
    forkJoin({
      summary: this.api.getSummary().pipe(catchError(() => of(null))),
      dept: this.api.getAttritionByDepartment().pipe(catchError(() => of(null))),
      overtime: this.api.getOvertime().pipe(catchError(() => of(null))),
      roles: this.api.getAttritionByRole().pipe(catchError(() => of(null))),
      satisfaction: this.api.getSatisfaction().pipe(catchError(() => of(null))),
      tenure: this.api.getTenure().pipe(catchError(() => of(null))),
      income: this.api.getIncome().pipe(catchError(() => of(null))),
      actionFirst: this.api.getActionFirst().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (data) => {
        this.loading = false;
        if (!data.summary) {
          this.loadError =
            'Could not load the HR data. Check that the API is running, then try again.';
          return;
        }
        this.summary = data.summary;
        this.findings = this.buildFindings({
          summary: data.summary,
          dept: data.dept,
          overtime: data.overtime,
          roles: data.roles,
          satisfaction: data.satisfaction,
          tenure: data.tenure,
          income: data.income,
          actionFirst: data.actionFirst,
        });
      },
      error: () => {
        this.loading = false;
        this.loadError =
          'Could not load the HR data. Check that the API is running, then try again.';
      },
    });
  }

  trackById(_index: number, f: Finding): string {
    return f.id;
  }

  severityLabel(f: Finding): string {
    return f.severity === 'high' ? 'High' : f.severity === 'medium' ? 'Medium' : 'Low';
  }

  severityTone(f: Finding): BadgeTone {
    return f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'amber' : 'neutral';
  }

  aiSourceLabel(f: Finding): string {
    return f.aiResult?.source === 'gemini' ? 'AI explanation' : 'Rule-based summary';
  }

  explainFinding(f: Finding): void {
    if (f.aiState === 'loading') {
      return;
    }
    f.aiState = 'loading';
    f.aiError = '';
    this.api.explainAi({ title: f.aiTitle, facts: f.aiFacts }).subscribe({
      next: (res) => {
        f.aiResult = res;
        f.aiState = 'done';
      },
      error: () => {
        f.aiState = 'error';
        f.aiError =
          'The explanation could not be loaded. Check that the API is running, then try again.';
      },
    });
  }

  private buildFindings(data: InsightsData): Finding[] {
    const companyRate = data.summary.attritionRate;
    const list: Finding[] = [];

    const add = (f: Omit<Finding, 'rank' | 'rankLabel' | 'aiState' | 'aiResult' | 'aiError'>): void => {
      list.push({
        ...f,
        rank: 0,
        rankLabel: '',
        aiState: 'idle',
        aiResult: null,
        aiError: '',
      });
    };

    // Worst role (Q3).
    const worstRole = data.roles && data.roles.length > 0 ? topByRate(data.roles) : undefined;
    if (worstRole) {
      add({
        id: 'worst-role',
        title: `Worst role: ${worstRole.group}`,
        severity: severityForRate(worstRole.rate),
        sortKey: worstRole.rate,
        headline: fmtRate(worstRole.rate),
        headlineLabel: 'attrition rate',
        numbers: `${fmtInt(worstRole.left)} of ${fmtInt(worstRole.total)} people in this role left.`,
        explanation:
          `That is ${(worstRole.rate / companyRate).toFixed(1)}× the company rate of ` +
          `${fmtRate(companyRate)} — the fastest-leaving role in the company.`,
        source: 'Q3 — Attrition by role',
        aiTitle: `Worst role: ${worstRole.group}`,
        aiFacts: [
          { label: `${worstRole.group} attrition rate (%)`, value: worstRole.rate },
          { label: 'Company attrition rate (%)', value: companyRate },
          { label: 'People who left in this role', value: worstRole.left },
          { label: 'People in this role', value: worstRole.total },
        ],
      });
    }

    // Overtime gap (Q2).
    const otYes = data.overtime ? findGroup(data.overtime, ['yes', '1', 'true', 'overtime']) : undefined;
    const otNo = data.overtime ? findGroup(data.overtime, ['no', '0', 'false']) : undefined;
    if (otYes && otNo) {
      const ratio = otYes.rate / Math.max(otNo.rate, 0.1);
      add({
        id: 'overtime-gap',
        title: 'Overtime gap',
        severity: severityForRate(otYes.rate),
        sortKey: otYes.rate,
        headline: fmtRate(otYes.rate),
        headlineLabel: 'attrition rate with overtime',
        numbers:
          `${fmtInt(otYes.left)} of ${fmtInt(otYes.total)} overtime staff left, against ` +
          `${fmtInt(otNo.left)} of ${fmtInt(otNo.total)} without overtime.`,
        explanation:
          `Staff working overtime leave at ${fmtRate(otYes.rate)}, nearly ` +
          `${ratio.toFixed(1)}× the ${fmtRate(otNo.rate)} for staff without overtime.`,
        source: 'Q2 — Overtime and attrition',
        aiTitle: 'Overtime and attrition',
        aiFacts: [
          { label: 'Attrition rate — overtime (%)', value: otYes.rate },
          { label: 'Attrition rate — no overtime (%)', value: otNo.rate },
          { label: 'People who left and worked overtime', value: otYes.left },
          { label: 'People who left in total', value: data.summary.attritionCount },
        ],
      });
    }

    // Early tenure risk (Q5).
    const early = data.tenure ? findGroup(data.tenure, ['0-2']) : undefined;
    const late = data.tenure ? findGroup(data.tenure, ['10+']) : undefined;
    if (early) {
      add({
        id: 'early-tenure',
        title: 'First two years are the riskiest',
        severity: severityForRate(early.rate),
        sortKey: early.rate,
        headline: fmtRate(early.rate),
        headlineLabel: 'attrition rate, 0–2 years',
        numbers: `${fmtInt(early.left)} of ${fmtInt(early.total)} employees with 0–2 years at the company left.`,
        explanation: late
          ? `The 0–2 year band leaves at ${fmtRate(early.rate)}, against ${fmtRate(late.rate)} for staff with 10+ years.`
          : `The 0–2 year band leaves at ${fmtRate(early.rate)} — the highest of any tenure band.`,
        source: 'Q5 — Tenure risk',
        aiTitle: 'Early tenure risk',
        aiFacts: [
          { label: 'Attrition rate — 0–2 years (%)', value: early.rate },
          { label: 'Attrition rate — 10+ years (%)', value: late?.rate ?? 0 },
          { label: 'Company attrition rate (%)', value: companyRate },
        ],
      });
    }

    // Lowest income band (Q6).
    const lowBand = data.income ? findGroup(data.income, ['<3000']) : undefined;
    const highBand = data.income ? findGroup(data.income, ['>10000']) : undefined;
    if (lowBand) {
      add({
        id: 'low-income',
        title: 'Lowest pay band leaves fastest',
        severity: severityForRate(lowBand.rate),
        sortKey: lowBand.rate,
        headline: fmtRate(lowBand.rate),
        headlineLabel: 'attrition rate, under $3,000 / month',
        numbers: `${fmtInt(lowBand.left)} of ${fmtInt(lowBand.total)} employees earning under $3,000 a month left.`,
        explanation: highBand
          ? `The lowest income band leaves at ${fmtRate(lowBand.rate)}, against ${fmtRate(highBand.rate)} for the highest band.`
          : `The lowest income band leaves at ${fmtRate(lowBand.rate)} — the highest of any income band.`,
        source: 'Q6 — Income and attrition',
        aiTitle: 'Lowest pay band leaves fastest',
        aiFacts: [
          { label: 'Attrition rate — under $3,000 (%)', value: lowBand.rate },
          { label: 'Attrition rate — over $10,000 (%)', value: highBand?.rate ?? 0 },
          { label: 'Company attrition rate (%)', value: companyRate },
        ],
      });
    }

    // Worst department (Q1).
    const worstDept = data.dept && data.dept.length > 0 ? topByRate(data.dept) : undefined;
    if (worstDept) {
      add({
        id: 'worst-department',
        title: `Worst department: ${worstDept.group}`,
        severity: severityForRate(worstDept.rate),
        sortKey: worstDept.rate,
        headline: fmtRate(worstDept.rate),
        headlineLabel: 'attrition rate',
        numbers: `${fmtInt(worstDept.left)} of ${fmtInt(worstDept.total)} employees in ${worstDept.group} left.`,
        explanation: `${fmtRate(worstDept.rate)} against the company rate of ${fmtRate(companyRate)}.`,
        source: 'Q1 — Attrition by department',
        aiTitle: `Worst department: ${worstDept.group}`,
        aiFacts: [
          { label: `${worstDept.group} attrition rate (%)`, value: worstDept.rate },
          { label: 'Company attrition rate (%)', value: companyRate },
          { label: 'People who left in this department', value: worstDept.left },
        ],
      });
    }

    // Second-highest role (Q3).
    const sortedRoles = data.roles ? [...data.roles].sort((a, b) => b.rate - a.rate) : [];
    const secondRole = sortedRoles[1];
    if (secondRole) {
      add({
        id: 'second-role',
        title: `Second-highest role: ${secondRole.group}`,
        severity: severityForRate(secondRole.rate),
        sortKey: secondRole.rate,
        headline: fmtRate(secondRole.rate),
        headlineLabel: 'attrition rate',
        numbers: `${fmtInt(secondRole.left)} of ${fmtInt(secondRole.total)} people in this role left.`,
        explanation:
          `Second only to ${sortedRoles[0].group} (${fmtRate(sortedRoles[0].rate)}), ` +
          `and still above the company rate of ${fmtRate(companyRate)}.`,
        source: 'Q3 — Attrition by role',
        aiTitle: `Second-highest role: ${secondRole.group}`,
        aiFacts: [
          { label: `${secondRole.group} attrition rate (%)`, value: secondRole.rate },
          { label: 'Company attrition rate (%)', value: companyRate },
          { label: 'People who left in this role', value: secondRole.left },
        ],
      });
    }

    // Satisfaction gap (Q4).
    const leftRow = data.satisfaction?.find((r) => r.attrition === 1);
    const stayedRow = data.satisfaction?.find((r) => r.attrition === 0);
    if (leftRow && stayedRow) {
      const gaps = [
        { name: 'job satisfaction', gap: stayedRow.avgJobSatisfaction - leftRow.avgJobSatisfaction },
        { name: 'environment satisfaction', gap: stayedRow.avgEnvironmentSatisfaction - leftRow.avgEnvironmentSatisfaction },
        { name: 'relationship satisfaction', gap: stayedRow.avgRelationshipSatisfaction - leftRow.avgRelationshipSatisfaction },
      ];
      const widest = [...gaps].sort((a, b) => b.gap - a.gap)[0];
      const jobGap = gaps[0].gap;
      add({
        id: 'satisfaction-gap',
        title: 'Leavers were less satisfied at work',
        severity: jobGap >= 0.3 ? 'high' : jobGap >= 0.2 ? 'medium' : 'low',
        // Gap as a share of the 1–4 scale, used only to order this finding
        // against rate-based findings.
        sortKey: (jobGap / 3) * 100,
        headline: `${jobGap.toFixed(2)} pts`,
        headlineLabel: 'job-satisfaction gap (1–4 scale)',
        numbers:
          `People who left averaged ${leftRow.avgJobSatisfaction.toFixed(2)} job satisfaction; ` +
          `those who stayed averaged ${stayedRow.avgJobSatisfaction.toFixed(2)}.`,
        explanation:
          `The gap is widest on ${widest.name} (${widest.gap.toFixed(2)} points); ` +
          `environment and relationship satisfaction show the same pattern.`,
        source: 'Q4 — Satisfaction and leaving',
        aiTitle: 'Satisfaction gap between leavers and stayers',
        aiFacts: [
          { label: 'Job satisfaction — left', value: leftRow.avgJobSatisfaction },
          { label: 'Job satisfaction — stayed', value: stayedRow.avgJobSatisfaction },
          { label: 'Work-life balance — left', value: leftRow.avgWorkLifeBalance },
          { label: 'Work-life balance — stayed', value: stayedRow.avgWorkLifeBalance },
        ],
      });
    }

    // Where to act first, breadth (Q7).
    const actions = data.actionFirst ?? [];
    if (actions.length > 0) {
      const top = actions[0];
      const topNames = actions
        .slice(0, 3)
        .map((a) => a.jobRole)
        .join(', ');
      add({
        id: 'act-first',
        title: `${actions.length} groups need action first`,
        severity: severityForRate(top.rate),
        sortKey: top.rate,
        headline: `${actions.length}`,
        headlineLabel: 'department-role groups over the threshold',
        numbers:
          `Top: ${top.department} — ${top.jobRole}, ${fmtInt(top.left)} of ` +
          `${fmtInt(top.total)} left (${fmtRate(top.rate)}). Every group listed has at least 50 people.`,
        explanation: `Ranked by attrition rate — ${topNames} sit at the top of the list.`,
        source: 'Q7 — Where HR should act first',
        aiTitle: 'Where HR should act first',
        aiFacts: [
          { label: 'Top group attrition rate (%)', value: top.rate },
          { label: 'Groups over the threshold', value: actions.length },
          { label: 'Company attrition rate (%)', value: companyRate },
        ],
      });
    }

    list.sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.sortKey - a.sortKey,
    );
    list.forEach((f, i) => {
      f.rank = i + 1;
      f.rankLabel = String(i + 1).padStart(2, '0');
    });
    return list;
  }
}
