import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api.service';
import type { ActionRow, RateRow, SatisfactionRow } from '../../core/models';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

type CsvValue = string | number;

interface ReportCard {
  id: string;
  question: string;
  title: string;
  answer: string;
  filename: string;
  headers: string[];
  rows: CsvValue[][];
  /** Number of leading columns that are labels; the rest are numeric. */
  labelColumns: number;
}

interface ReportsData {
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

function fmtAvg(n: number): string {
  return n.toFixed(2);
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, row) => (best === undefined || row.rate > best.rate ? row : best),
    undefined,
  );
}

function bottomByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (worst, row) => (worst === undefined || row.rate < worst.rate ? row : worst),
    undefined,
  );
}

function findGroup(rows: RateRow[], labels: string[]): RateRow | undefined {
  const wanted = labels.map((label) => label.toLowerCase());
  return rows.find((row) => wanted.includes(row.group.toLowerCase()));
}

/** Income bands are monthly income ranges; phrase them in plain words. */
function incomeBandLabel(band: string): string {
  switch (band) {
    case '<3000':
      return 'under $3,000 a month';
    case '3000-6000':
      return '$3,000–$6,000 a month';
    case '6000-10000':
      return '$6,000–$10,000 a month';
    case '>10000':
      return 'over $10,000 a month';
    default:
      return band;
  }
}

function csvCell(value: CsvValue): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 BOM first so Excel opens the file with the right encoding. */
function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function buildCards(data: ReportsData): ReportCard[] {
  const cards: ReportCard[] = [];

  // Q1 — Attrition rate by department.
  const topDept = topByRate(data.dept);
  const bottomDept = bottomByRate(data.dept);
  cards.push({
    id: 'q1',
    question: 'Q1',
    title: 'What is the attrition rate by department?',
    answer:
      topDept && bottomDept
        ? `${topDept.group} loses people fastest at ${fmtRate(topDept.rate)}; ` +
          `${bottomDept.group} is lowest at ${fmtRate(bottomDept.rate)}.`
        : 'No department data was returned.',
    filename: 'q1-attrition-by-department.csv',
    headers: ['Department', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.dept.map((r) => [r.group, r.total, r.left, r.rate]),
    labelColumns: 1,
  });

  // Q2 — Does overtime go along with attrition?
  const otYes = findGroup(data.overtime, ['yes', '1', 'true']);
  const otNo = findGroup(data.overtime, ['no', '0', 'false']);
  cards.push({
    id: 'q2',
    question: 'Q2',
    title: 'Does overtime go along with attrition?',
    answer:
      otYes && otNo
        ? `Staff who work overtime leave at ${fmtRate(otYes.rate)}, against ` +
          `${fmtRate(otNo.rate)} for staff who do not.`
        : 'No overtime data was returned.',
    filename: 'q2-overtime-and-attrition.csv',
    headers: ['Overtime', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.overtime.map((r) => [r.group, r.total, r.left, r.rate]),
    labelColumns: 1,
  });

  // Q3 — Which job roles lose people fastest?
  const topRole = topByRate(data.roles);
  cards.push({
    id: 'q3',
    question: 'Q3',
    title: 'Which job roles lose people fastest?',
    answer: topRole
      ? `${topRole.group} loses people fastest at ${fmtRate(topRole.rate)}, ` +
        `across ${fmtInt(topRole.total)} people.`
      : 'No job role data was returned.',
    filename: 'q3-attrition-by-role.csv',
    headers: ['Job role', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.roles.map((r) => [r.group, r.total, r.left, r.rate]),
    labelColumns: 1,
  });

  // Q4 — How do satisfaction and work-life balance relate to leaving?
  const left = data.satisfaction.find((r) => r.attrition === 1);
  const stayed = data.satisfaction.find((r) => r.attrition === 0);
  cards.push({
    id: 'q4',
    question: 'Q4',
    title: 'How do satisfaction and work-life balance relate to leaving?',
    answer:
      left && stayed
        ? `People who left averaged ${fmtAvg(left.avgJobSatisfaction)} job satisfaction, ` +
          `against ${fmtAvg(stayed.avgJobSatisfaction)} for those who stayed.`
        : 'No satisfaction data was returned.',
    filename: 'q4-satisfaction-and-leaving.csv',
    headers: [
      'Group',
      'Avg job satisfaction',
      'Avg environment satisfaction',
      'Avg relationship satisfaction',
      'Avg work-life balance',
      'Headcount',
    ],
    rows: data.satisfaction.map((r) => [
      r.attrition === 1 ? 'Left' : 'Stayed',
      r.avgJobSatisfaction,
      r.avgEnvironmentSatisfaction,
      r.avgRelationshipSatisfaction,
      r.avgWorkLifeBalance,
      r.headcount,
    ]),
    labelColumns: 1,
  });

  // Q5 — Is early tenure the riskiest period?
  const firstTenure = data.tenure[0];
  const lastTenure = data.tenure[data.tenure.length - 1];
  cards.push({
    id: 'q5',
    question: 'Q5',
    title: 'Is early tenure the riskiest period?',
    answer:
      firstTenure && lastTenure
        ? `Yes — the ${firstTenure.group} years are riskiest at ${fmtRate(firstTenure.rate)}, ` +
          `falling to ${fmtRate(lastTenure.rate)} after ${lastTenure.group} years.`
        : 'No tenure data was returned.',
    filename: 'q5-tenure-risk.csv',
    headers: ['Tenure band', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.tenure.map((r) => [r.group, r.total, r.left, r.rate]),
    labelColumns: 1,
  });

  // Q6 — Does income level matter, apart from role?
  const firstIncome = data.income[0];
  const lastIncome = data.income[data.income.length - 1];
  cards.push({
    id: 'q6',
    question: 'Q6',
    title: 'Does income level matter, apart from role?',
    answer:
      firstIncome && lastIncome
        ? `Yes — staff earning ${incomeBandLabel(firstIncome.group)} leave at ` +
          `${fmtRate(firstIncome.rate)}, against ${fmtRate(lastIncome.rate)} earning ` +
          `${incomeBandLabel(lastIncome.group)}.`
        : 'No income data was returned.',
    filename: 'q6-income-and-attrition.csv',
    headers: ['Income band', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.income.map((r) => [r.group, r.total, r.left, r.rate]),
    labelColumns: 1,
  });

  // Q7 — Where should HR act first?
  const topAction = data.actionFirst[0];
  cards.push({
    id: 'q7',
    question: 'Q7',
    title: 'Where should HR act first?',
    answer: topAction
      ? `${topAction.jobRole} (${topAction.department}) first — ${fmtRate(topAction.rate)} ` +
        `attrition across ${fmtInt(topAction.total)} people.`
      : 'No action data was returned.',
    filename: 'q7-where-hr-should-act-first.csv',
    headers: ['Department', 'Job role', 'Headcount', 'Left', 'Attrition rate (%)'],
    rows: data.actionFirst.map((r) => [r.department, r.jobRole, r.total, r.left, r.rate]),
    labelColumns: 2,
  });

  return cards;
}

/**
 * Reports page: one card per analytical question (Q1–Q7). Each card shows
 * the question, a one-line answer computed from the live API data, a preview
 * table of the rows, and a "Download CSV" button that saves those rows as a
 * real .csv file built client-side from the JSON response.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
})
export class ReportsComponent implements OnInit {
  private readonly api = inject(ApiService);

  loading = true;
  error = '';
  cards: ReportCard[] = [];

  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.load();
  }

  download(card: ReportCard): void {
    const blob = new Blob([toCsv(card.headers, card.rows)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = card.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  isNumericCell(card: ReportCard, index: number): boolean {
    return index >= card.labelColumns;
  }

  formatCell(header: string, value: CsvValue): string {
    if (typeof value !== 'number') {
      return value;
    }
    if (header.includes('(%)')) {
      return fmtRate(value);
    }
    if (header.startsWith('Avg')) {
      return fmtAvg(value);
    }
    return fmtInt(value);
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.cards = [];
    forkJoin({
      dept: this.api.getAttritionByDepartment(),
      overtime: this.api.getOvertime(),
      roles: this.api.getAttritionByRole(),
      satisfaction: this.api.getSatisfaction(),
      tenure: this.api.getTenure(),
      income: this.api.getIncome(),
      actionFirst: this.api.getActionFirst(),
    }).subscribe({
      next: (data) => {
        this.cards = buildCards(data);
        this.loading = false;
      },
      error: () => {
        this.error =
          'Could not load the reports. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }
}
