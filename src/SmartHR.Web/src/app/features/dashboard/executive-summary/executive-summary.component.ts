import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import type { ActionRow, RateRow, Summary } from '../../../core/models';

interface SentencePart {
  text: string;
  strong?: boolean;
  tone?: 'danger' | 'accent';
}

type Sentence = SentencePart[];

interface SummaryData {
  summary: Summary;
  dept: RateRow[];
  overtime: RateRow[];
  tenure: RateRow[];
  actionFirst: ActionRow[];
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-IN');
}

function fmtRate(n: number): string {
  return `${n.toFixed(1)}%`;
}

function findGroup(rows: RateRow[], keys: string[]): RateRow | undefined {
  const wanted = keys.map((k) => k.toLowerCase());
  return rows.find((r) => wanted.includes(r.group.trim().toLowerCase()));
}

function topByRate(rows: RateRow[]): RateRow | undefined {
  return rows.reduce<RateRow | undefined>(
    (best, r) => (!best || r.rate > best.rate ? r : best),
    undefined,
  );
}

@Component({
  selector: 'app-executive-summary',
  standalone: true,
  imports: [],
  templateUrl: './executive-summary.component.html',
  styleUrls: ['./executive-summary.component.css'],
})
export class ExecutiveSummaryComponent implements OnInit {
  loading = true;
  error = '';
  sentences: Sentence[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      summary: this.api.getSummary(),
      dept: this.api.getAttritionByDepartment(),
      overtime: this.api.getOvertime(),
      tenure: this.api.getTenure(),
      actionFirst: this.api.getActionFirst(),
    }).subscribe({
      next: (data) => {
        this.sentences = this.buildSentences(data);
        this.loading = false;
      },
      error: () => {
        this.error =
          'The summary could not be loaded. Check that the API is running and try again.';
        this.loading = false;
      },
    });
  }

  print(): void {
    window.print();
  }

  private buildSentences(data: SummaryData): Sentence[] {
    const out: Sentence[] = [];
    const { summary } = data;

    // 1. Top department by attrition rate, against the company average.
    const top = topByRate(data.dept);
    if (top) {
      out.push([
        { text: `${top.group} loses people fastest at ` },
        { text: fmtRate(top.rate), strong: true, tone: 'danger' },
        { text: ` — above the company average of ` },
        { text: fmtRate(summary.attritionRate), strong: true },
        { text: ` across ` },
        { text: fmtInt(summary.totalEmployees), strong: true },
        { text: ` employees, of whom ` },
        { text: fmtInt(summary.attritionCount), strong: true },
        { text: ` left.` },
      ]);
    }

    // 2. Overtime gap, expressed as a computed multiple.
    const otYes = findGroup(data.overtime, ['yes', '1', 'true', 'overtime']);
    const otNo = findGroup(data.overtime, ['no', '0', 'false']);
    if (otYes && otNo && otNo.rate > 0) {
      const multiple = otYes.rate / otNo.rate;
      out.push([
        { text: `Employees who work overtime leave at ` },
        { text: fmtRate(otYes.rate), strong: true, tone: 'danger' },
        { text: ` — ` },
        { text: `${multiple.toFixed(1)}×`, strong: true },
        { text: ` the ` },
        { text: fmtRate(otNo.rate), strong: true },
        { text: ` rate of those who do not.` },
      ]);
    }

    // 3. Early-tenure risk (0–2 year band).
    const early = findGroup(data.tenure, ['0-2', '0–2']);
    if (early) {
      out.push([
        { text: `The first two years are the riskiest: ` },
        { text: fmtRate(early.rate), strong: true, tone: 'danger' },
        { text: ` of employees in the 0–2 year band have left, against ` },
        { text: fmtRate(summary.attritionRate), strong: true },
        { text: ` overall.` },
      ]);
    }

    // 4. First action from Q7 (already ordered by rate desc).
    const first = data.actionFirst[0];
    if (first) {
      out.push([
        { text: `HR should act first on ` },
        { text: `${first.jobRole} in ${first.department}`, strong: true, tone: 'accent' },
        { text: ` — ` },
        { text: fmtRate(first.rate), strong: true, tone: 'danger' },
        { text: ` attrition across ` },
        { text: fmtInt(first.total), strong: true },
        { text: ` people.` },
      ]);
    }

    return out;
  }
}
