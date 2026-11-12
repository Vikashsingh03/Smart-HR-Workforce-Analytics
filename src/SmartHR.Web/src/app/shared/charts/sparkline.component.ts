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
  registerables,
} from 'chart.js';
import {
  applyChartDefaults,
  sparklineChartOptions,
  sparklineDatasetDefaults,
} from './chart-theme';

/**
 * Tiny trend line for KPI cards (v2).
 *
 * A Chart.js line chart with no axes, no legend and no tooltip — just a
 * teal stroke with a dot on the last point. Lives in shared/charts so
 * this stays the ONLY place in the app that imports Chart.js.
 *
 * Inputs: data (number[] — the trend values in order), height in px
 * (default 32). Fewer than 2 points renders an empty box of the same
 * height, never a broken chart.
 *
 * Usage:
 *   <app-sparkline [data]="attritionTrend" [height]="36" />
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  templateUrl: './sparkline.component.html',
  styleUrl: './sparkline.component.css',
})
export class SparklineComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input({ required: true }) data: number[] = [];
  @Input() height = 32;

  @ViewChild('sparkCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart<'line'> | null = null;
  private viewReady = false;

  constructor() {
    applyChartDefaults();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }
    if (changes['data'] && !changes['data'].firstChange) {
      this.recreateChart();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private createChart(): void {
    if (!this.viewReady || this.chart) {
      return;
    }
    const data = this.cleanData();
    if (data.length < 2) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    this.chart = new Chart(context, this.buildConfig(data));
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

  private cleanData(): number[] {
    return (this.data ?? []).filter(
      (v) => typeof v === 'number' && Number.isFinite(v),
    );
  }

  private buildConfig(data: number[]): ChartConfiguration<'line'> {
    const lastIndex = data.length - 1;
    return {
      type: 'line',
      data: {
        labels: data.map((_, i) => String(i)),
        datasets: [
          {
            label: 'Trend',
            data: [...data],
            ...sparklineDatasetDefaults,
            // Dot on the last point only; every other point is lineless.
            pointRadius: (ctx) =>
              ctx.dataIndex === lastIndex ? 2.5 : 0,
            pointBackgroundColor: '#0E5E54',
          },
        ],
      },
      options: sparklineChartOptions,
    };
  }
}

// Register all Chart.js controllers/elements/scales once, for this module.
// (base-chart does the same; Chart.js ignores duplicate registrations.)
Chart.register(...registerables);
