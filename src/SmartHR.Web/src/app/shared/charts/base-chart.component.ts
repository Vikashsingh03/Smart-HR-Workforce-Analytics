import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  Chart,
  type ChartConfiguration,
  type ChartData,
  type ChartDataset,
  registerables,
} from 'chart.js';
import {
  applyChartDefaults,
  barChartOptions,
  barColors,
  barDatasetDefaults,
  doughnutChartOptions,
  doughnutColors,
  doughnutDatasetDefaults,
  horizontalBarChartOptions,
  paletteFor,
  valueLabelsPlugin,
} from './chart-theme';

/**
 * The ONLY place in the app that imports Chart.js. Feature components
 * (dashboard, employees, AI assistant) use <app-base-chart> and never
 * import 'chart.js' themselves.
 *
 * Colour rule: a dataset without an explicit backgroundColor gets palette
 * colours — per-bar colours for a single-dataset bar chart or a doughnut,
 * one palette colour per dataset for multi-dataset bar charts. The brick
 * palette entry (#A83226) is the "left" / attrition colour; pass it
 * explicitly for attrition series.
 *
 * Usage:
 *   <app-base-chart type="bar" [labels]="deptLabels"
 *     [datasets]="[{ label: 'Attrition %', data: deptRates }]" [height]="260" />
 *   <app-base-chart type="doughnut" [labels]="['Yes', 'No']"
 *     [datasets]="[{ label: 'Overtime', data: [overtimeYes, overtimeNo] }]" />
 *   Histogram / value labels (v2):
 *   <app-base-chart type="bar" [labels]="bands" [datasets]="[...]"
 *     [showValues]="true" /> — values drawn on the bars, no extra package.
 *   Horizontal bars (v2):
 *   <app-base-chart type="bar" [labels]="roles" [datasets]="[...]"
 *     [horizontal]="true" [showValues]="true" />
 */

export interface BaseChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
}

@Component({
  selector: 'app-base-chart',
  standalone: true,
  templateUrl: './base-chart.component.html',
  styleUrl: './base-chart.component.css',
})
export class BaseChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) type!: 'bar' | 'doughnut';
  @Input({ required: true }) labels: string[] = [];
  @Input({ required: true }) datasets: BaseChartDataset[] = [];
  @Input() height = 240;
  /** v2: draw the value on each bar (histogram style). No effect on doughnuts. */
  @Input() showValues = false;
  /** v2: horizontal bars (indexAxis 'y'). Only applies to type 'bar'. */
  @Input() horizontal = false;

  @ViewChild('chartCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart<'bar' | 'doughnut'> | null = null;
  private viewReady = false;

  constructor() {
    applyChartDefaults();
  }

  get ariaLabel(): string {
    return `${this.type} chart with ${this.labels.length} categories`;
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }
    // Type, orientation and value labels live in the chart options, so a
    // change to any of them needs a full rebuild, not a data update.
    if (
      (changes['type'] && !changes['type'].firstChange) ||
      (changes['horizontal'] && !changes['horizontal'].firstChange) ||
      (changes['showValues'] && !changes['showValues'].firstChange)
    ) {
      this.recreateChart();
      return;
    }
    if (this.chart) {
      this.updateChartData();
    } else {
      this.createChart();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private createChart(): void {
    if (!this.viewReady || this.chart || this.labels.length === 0) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    this.chart = new Chart(context, this.buildConfig());
  }

  private recreateChart(): void {
    this.destroyChart();
    this.createChart();
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private updateChartData(): void {
    if (!this.chart) {
      return;
    }
    this.chart.data.labels = [...this.labels];
    this.chart.data.datasets = this.buildDatasets();
    this.chart.update();
  }

  private buildConfig(): ChartConfiguration<'bar' | 'doughnut'> {
    const data: ChartData<'bar' | 'doughnut'> = {
      labels: [...this.labels],
      datasets: this.buildDatasets(),
    };
    const options =
      this.type === 'bar'
        ? this.horizontal
          ? horizontalBarChartOptions
          : barChartOptions
        : doughnutChartOptions;
    return {
      type: this.type,
      data,
      options,
      plugins:
        this.showValues && this.type === 'bar' ? [valueLabelsPlugin] : [],
    };
  }

  private buildDatasets(): ChartDataset<'bar' | 'doughnut'>[] {
    return this.datasets.map((dataset, index) => {
      const base = {
        label: dataset.label,
        data: [...dataset.data],
        backgroundColor:
          dataset.backgroundColor ?? this.resolveColors(index),
      };
      return this.type === 'bar'
        ? { ...base, ...barDatasetDefaults }
        : { ...base, ...doughnutDatasetDefaults };
    }) as ChartDataset<'bar' | 'doughnut'>[];
  }

  private resolveColors(datasetIndex: number): string[] {
    if (this.type === 'doughnut') {
      return doughnutColors(this.labels.length);
    }
    if (this.datasets.length === 1) {
      return barColors(this.labels.length);
    }
    return [paletteFor(datasetIndex)];
  }
}

// Register all Chart.js controllers/elements/scales once, for this module.
Chart.register(...registerables);
