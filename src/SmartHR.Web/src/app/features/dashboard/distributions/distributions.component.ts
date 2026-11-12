import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import type { AiExplainResult, RateRow } from '../../../core/models';
import { BaseChartComponent } from '../../../shared/charts/base-chart.component';

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
}

interface ChartConfig {
  id: string;
  eyebrow: string;
  title: string;
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

function lowByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, row) => (!best || row.rate < best.rate ? row : best),
    undefined,
  );
}

/**
 * Band order key: the first integer in the group label. The API returns
 * bands in order, but sorting here makes the charts immune to ordering
 * changes — '18-25' -> 18, '6-10' -> 6, 'Level 3' -> 3.
 */
function bandStart(group: string): number {
  const match = group.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function sortBands(rows: RateRow[]): RateRow[] {
  return [...rows].sort((a, b) => bandStart(a.group) - bandStart(b.group));
}

@Component({
  selector: 'app-distributions',
  standalone: true,
  imports: [CommonModule, BaseChartComponent],
  templateUrl: './distributions.component.html',
  styleUrl: './distributions.component.css',
})
export class DistributionsComponent implements OnInit {
  loading = true;
  error = '';

  charts: ChartConfig[] = [];
  ai: Record<string, AiState> = {};

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      age: this.api.getAgeBands(),
      distance: this.api.getDistanceBands(),
      level: this.api.getJobLevel(),
    }).subscribe({
      next: (data) => {
        this.buildCharts(data);
        this.loading = false;
      },
      error: () => {
        this.error =
          'The distributions could not be loaded. Check that the API is running and try again.';
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
    age: RateRow[];
    distance: RateRow[];
    level: RateRow[];
  }): void {
    const configs: ChartConfig[] = [];

    // Age bands: 18-25, 26-35, 36-45, 46-55, 56+.
    const age = sortBands(data.age);
    const ageTop = topByRate(age);
    const ageLow = lowByRate(age);
    configs.push({
      id: 'age',
      eyebrow: 'Age',
      title: 'Attrition by age band',
      labels: age.map((r) => r.group),
      datasets: [
        {
          label: 'Attrition rate (%)',
          data: age.map((r) => r.rate),
          backgroundColor: TEAL,
        },
      ],
      takeaway:
        ageTop && ageLow
          ? `Attrition peaks in the ${ageTop.group} age band at ${fmtRate(ageTop.rate)}, ` +
            `against ${fmtRate(ageLow.rate)} for ${ageLow.group}.`
          : 'No age-band data was returned.',
      aiTitle: 'Attrition by age band',
      aiFacts: [
        ...age.map((r) => ({
          label: `Attrition rate — age ${r.group} (%)`,
          value: r.rate,
        })),
        ...age.map((r) => ({
          label: `Headcount — age ${r.group}`,
          value: r.total,
        })),
      ],
    });

    // Distance from home: 1-5, 6-10, 11-20, 21+ miles.
    const distance = sortBands(data.distance);
    const distTop = topByRate(distance);
    const distLow = lowByRate(distance);
    configs.push({
      id: 'distance',
      eyebrow: 'Distance from home',
      title: 'Attrition by distance from home',
      labels: distance.map((r) => r.group),
      datasets: [
        {
          label: 'Attrition rate (%)',
          data: distance.map((r) => r.rate),
          backgroundColor: TEAL,
        },
      ],
      takeaway:
        distTop && distLow
          ? `Attrition peaks ${distTop.group} miles from home at ${fmtRate(distTop.rate)}, ` +
            `against ${fmtRate(distLow.rate)} for ${distLow.group} miles.`
          : 'No distance data was returned.',
      aiTitle: 'Attrition by distance from home',
      aiFacts: [
        ...distance.map((r) => ({
          label: `Attrition rate — ${r.group} miles from home (%)`,
          value: r.rate,
        })),
        ...distance.map((r) => ({
          label: `Headcount — ${r.group} miles from home`,
          value: r.total,
        })),
      ],
    });

    // Job level: Level 1..Level 5.
    const level = sortBands(data.level);
    const levelTop = topByRate(level);
    const levelLow = lowByRate(level);
    configs.push({
      id: 'job-level',
      eyebrow: 'Job level',
      title: 'Attrition by job level',
      labels: level.map((r) => r.group),
      datasets: [
        {
          label: 'Attrition rate (%)',
          data: level.map((r) => r.rate),
          backgroundColor: TEAL,
        },
      ],
      takeaway:
        levelTop && levelLow
          ? `${levelTop.group} loses people fastest at ${fmtRate(levelTop.rate)}, ` +
            `against ${fmtRate(levelLow.rate)} for ${levelLow.group}.`
          : 'No job-level data was returned.',
      aiTitle: 'Attrition by job level',
      aiFacts: [
        ...level.map((r) => ({
          label: `Attrition rate — ${r.group} (%)`,
          value: r.rate,
        })),
        ...level.map((r) => ({
          label: `Headcount — ${r.group}`,
          value: r.total,
        })),
      ],
    });

    this.charts = configs;
    for (const chart of configs) {
      this.ai[chart.id] = { loading: false, result: null, error: '' };
    }
  }
}
