import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import type {
  AiExplainResult,
  RateRow,
  SatisfactionRow,
} from '../../../core/models';
import { BaseChartComponent } from '../../../shared/charts/base-chart.component';

type ChartType = 'bar' | 'doughnut';

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
}

interface ChartConfig {
  id: string;
  question: string;
  title: string;
  type: ChartType;
  labels: string[];
  datasets: ChartDataset[];
  takeaway: string;
  aiTitle: string;
  aiFacts: { label: string; value: string | number }[];
}

interface AiState {
  loading: boolean;
  result: AiExplainResult | null;
  error: string;
}

const TEAL = '#0E5E54';
const BRICK = '#A83226';

// Canonical band order, so the charts stay in reading order even if the
// API ever returns the bands in a different order.
const TENURE_ORDER = ['0-2', '3-5', '6-10', '10+'];
const INCOME_ORDER = ['<3000', '3000-6000', '6000-10000', '>10000'];

function fmtRate(n: number): string {
  return n.toFixed(1) + '%';
}

function orderRows(rows: RateRow[], order: string[]): RateRow[] {
  const rank = new Map(order.map((group, i) => [group, i]));
  return [...rows].sort(
    (a, b) => (rank.get(a.group) ?? 99) - (rank.get(b.group) ?? 99),
  );
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, row) => (!best || row.rate > best.rate ? row : best),
    undefined,
  );
}

@Component({
  selector: 'app-charts-drivers',
  standalone: true,
  imports: [CommonModule, BaseChartComponent],
  templateUrl: './charts-drivers.component.html',
  styleUrl: './charts-drivers.component.css',
})
export class ChartsDriversComponent implements OnInit {
  loading = true;
  error = '';
  charts: ChartConfig[] = [];
  ai: Record<string, AiState> = {};

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      satisfaction: this.api.getSatisfaction(),
      tenure: this.api.getTenure(),
      income: this.api.getIncome(),
    }).subscribe({
      next: (data) => {
        this.buildCharts(data);
        this.loading = false;
      },
      error: () => {
        this.error =
          'The driver charts could not be loaded. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }

  aiState(id: string): AiState {
    return this.ai[id] ?? { loading: false, result: null, error: '' };
  }

  explain(chart: ChartConfig): void {
    this.ai[chart.id] = { loading: true, result: null, error: '' };
    this.api.explainAi({ title: chart.aiTitle, facts: chart.aiFacts }).subscribe({
      next: (result) => {
        this.ai[chart.id] = { loading: false, result, error: '' };
      },
      error: () => {
        this.ai[chart.id] = {
          loading: false,
          result: null,
          error: 'The explanation could not be loaded. Try again.',
        };
      },
    });
  }

  private buildCharts(data: {
    satisfaction: SatisfactionRow[];
    tenure: RateRow[];
    income: RateRow[];
  }): void {
    const configs: ChartConfig[] = [];

    // Q4 — Satisfaction: people who left vs people who stayed.
    const left = data.satisfaction.find((s) => s.attrition === 1);
    const stayed = data.satisfaction.find((s) => s.attrition === 0);
    const dims = [
      {
        label: 'Job satisfaction',
        left: left?.avgJobSatisfaction,
        stayed: stayed?.avgJobSatisfaction,
      },
      {
        label: 'Environment',
        left: left?.avgEnvironmentSatisfaction,
        stayed: stayed?.avgEnvironmentSatisfaction,
      },
      {
        label: 'Relationship',
        left: left?.avgRelationshipSatisfaction,
        stayed: stayed?.avgRelationshipSatisfaction,
      },
      {
        label: 'Work-life balance',
        left: left?.avgWorkLifeBalance,
        stayed: stayed?.avgWorkLifeBalance,
      },
    ];
    const widestGap = dims
      .map((d) => ({ ...d, gap: (d.stayed ?? 0) - (d.left ?? 0) }))
      .reduce((best, d) => (d.gap > best.gap ? d : best), {
        ...dims[0],
        gap: (dims[0].stayed ?? 0) - (dims[0].left ?? 0),
      });
    configs.push({
      id: 'satisfaction',
      question: 'Q4',
      title: 'Satisfaction: left vs stayed',
      type: 'bar',
      labels: dims.map((d) => d.label),
      datasets: [
        {
          label: 'Stayed',
          data: dims.map((d) => d.stayed ?? 0),
          backgroundColor: TEAL,
        },
        {
          label: 'Left',
          data: dims.map((d) => d.left ?? 0),
          backgroundColor: BRICK,
        },
      ],
      takeaway:
        left && stayed
          ? `The gap is widest in ${widestGap.label.toLowerCase()}: people who stayed averaged ` +
            `${widestGap.stayed?.toFixed(1)}, leavers ${widestGap.left?.toFixed(1)}.`
          : 'No satisfaction data was returned.',
      aiTitle: 'Satisfaction: left vs stayed',
      aiFacts: [
        { label: 'Avg job satisfaction — left', value: left?.avgJobSatisfaction ?? 0 },
        { label: 'Avg job satisfaction — stayed', value: stayed?.avgJobSatisfaction ?? 0 },
        { label: 'Avg environment satisfaction — left', value: left?.avgEnvironmentSatisfaction ?? 0 },
        { label: 'Avg environment satisfaction — stayed', value: stayed?.avgEnvironmentSatisfaction ?? 0 },
        { label: 'Avg relationship satisfaction — left', value: left?.avgRelationshipSatisfaction ?? 0 },
        { label: 'Avg relationship satisfaction — stayed', value: stayed?.avgRelationshipSatisfaction ?? 0 },
        { label: 'Avg work-life balance — left', value: left?.avgWorkLifeBalance ?? 0 },
        { label: 'Avg work-life balance — stayed', value: stayed?.avgWorkLifeBalance ?? 0 },
        { label: 'People who left', value: left?.headcount ?? 0 },
        { label: 'People who stayed', value: stayed?.headcount ?? 0 },
      ],
    });

    // Q5 — Tenure bands, in reading order.
    const tenure = orderRows(data.tenure, TENURE_ORDER);
    const firstBand = tenure.find((t) => t.group === '0-2');
    configs.push({
      id: 'tenure',
      question: 'Q5',
      title: 'Attrition by tenure',
      type: 'bar',
      labels: tenure.map((t) => t.group),
      datasets: [
        {
          label: 'Attrition rate (%)',
          data: tenure.map((t) => t.rate),
          backgroundColor: TEAL,
        },
      ],
      takeaway: firstBand
        ? `The first two years are the riskiest: ${fmtRate(firstBand.rate)} of employees leave.`
        : 'No tenure data was returned.',
      aiTitle: 'Attrition by tenure',
      aiFacts: tenure.map((t) => ({
        label: `Attrition rate — ${t.group} years (%)`,
        value: t.rate,
      })),
    });

    // Q6 — Income bands, in reading order.
    const income = orderRows(data.income, INCOME_ORDER);
    const topIncome = topByRate(income);
    configs.push({
      id: 'income',
      question: 'Q6',
      title: 'Attrition by income band',
      type: 'bar',
      labels: income.map((i) => i.group),
      datasets: [
        {
          label: 'Attrition rate (%)',
          data: income.map((i) => i.rate),
          backgroundColor: TEAL,
        },
      ],
      takeaway: topIncome
        ? `The ${topIncome.group} income band loses people fastest at ${fmtRate(topIncome.rate)}.`
        : 'No income data was returned.',
      aiTitle: 'Attrition by income band',
      aiFacts: income.map((i) => ({
        label: `Attrition rate — income ${i.group} (%)`,
        value: i.rate,
      })),
    });

    this.charts = configs;
    for (const chart of configs) {
      this.ai[chart.id] = { loading: false, result: null, error: '' };
    }
  }
}
