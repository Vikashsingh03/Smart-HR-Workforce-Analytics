import {
  Chart,
  type BarControllerDatasetOptions,
  type ChartOptions,
  type DoughnutControllerDatasetOptions,
  type LineControllerDatasetOptions,
  type Plugin,
  type TooltipItem,
} from 'chart.js';
import { formatNumberValue } from '../pipes/format-number.pipe';

/**
 * Smart HR Workforce Analytics — shared Chart.js theme.
 *
 * Single source of truth for every chart in the app. Feature code never
 * touches Chart.js directly; it uses <app-base-chart>, which applies this
 * theme. Muted, colourblind-safe palette, no gradients, no rainbow fills,
 * Inter type throughout, tabular numerals in tooltips.
 *
 * Design tokens (CONTRACT-FRONTEND.md):
 *   teal #0E5E54, slate #5B6B7A, ochre #B98A1D, brick #A83226,
 *   stone #8A867D, sage #7A8B6F. Gridlines #EDEAE3.
 */

export const CHART_FONT_FAMILY =
  "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const CHART_MONO_FAMILY =
  "ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace";

export const GRIDLINE_COLOR = '#E8E4DA';
export const GRIDLINE_STRONG_COLOR = '#D4D0C6';
export const AXIS_TEXT_COLOR = '#55524C';
export const MUTED_TEXT_COLOR = '#8A867D';
export const TOOLTIP_BG = '#191919';
export const TOOLTIP_TEXT = '#FAFAF7';
export const DOUGHNUT_BORDER = '#FFFFFF';

/** Muted, colourblind-safe palette. Order is fixed — charts use it in order. */
export const chartPalette: string[] = [
  '#0E5E54', // teal — primary / first series
  '#5B6B7A', // slate
  '#B98A1D', // ochre
  '#A83226', // brick — use for the "left" / attrition series
  '#8A867D', // stone
  '#7A8B6F', // sage
];

/** Palette colour for a series index; wraps around for more than 6 series. */
export function paletteFor(index: number): string {
  const i = ((index % chartPalette.length) + chartPalette.length) % chartPalette.length;
  return chartPalette[i];
}

/** One palette colour per bar/slice, in palette order. */
export function barColors(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => paletteFor(i));
}

/** Alias kept for readability at doughnut call sites. */
export function doughnutColors(count: number): string[] {
  return barColors(count);
}

/**
 * Applies the theme to Chart.js global defaults. Call once, before any
 * chart is created (base-chart does this at module load). Mutating
 * Chart.defaults is deliberate: this app has exactly one chart system.
 */
export function applyChartDefaults(): void {
  Chart.defaults.font.family = CHART_FONT_FAMILY;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = AXIS_TEXT_COLOR;
  Chart.defaults.borderColor = GRIDLINE_COLOR;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation = { duration: 300 };

  Chart.defaults.plugins.tooltip.backgroundColor = TOOLTIP_BG;
  Chart.defaults.plugins.tooltip.titleColor = TOOLTIP_TEXT;
  Chart.defaults.plugins.tooltip.bodyColor = TOOLTIP_TEXT;
  Chart.defaults.plugins.tooltip.titleFont = {
    family: CHART_FONT_FAMILY,
    size: 12,
    weight: 600,
  };
  Chart.defaults.plugins.tooltip.bodyFont = {
    family: CHART_MONO_FAMILY,
    size: 12,
  };
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.caretSize = 6;
  Chart.defaults.plugins.tooltip.titleMarginBottom = 6;
  Chart.defaults.plugins.tooltip.bodySpacing = 2;
  Chart.defaults.plugins.tooltip.borderColor = '#E6E3DB';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxWidth = 8;
  Chart.defaults.plugins.tooltip.boxHeight = 8;
  Chart.defaults.plugins.tooltip.usePointStyle = true;

  Chart.defaults.plugins.legend.position = 'bottom';
  Chart.defaults.plugins.legend.labels.color = AXIS_TEXT_COLOR;
  Chart.defaults.plugins.legend.labels.font = {
    family: CHART_FONT_FAMILY,
    size: 11,
  };
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'rect';
  Chart.defaults.plugins.legend.labels.padding = 16;
}

/* ------------------------------------------------------------------ */
/* Shared option fragments (typed, reused by the two chart options).  */
/* ------------------------------------------------------------------ */

const tooltipBase = {
  backgroundColor: TOOLTIP_BG,
  titleColor: TOOLTIP_TEXT,
  bodyColor: TOOLTIP_TEXT,
  titleFont: { family: CHART_FONT_FAMILY, size: 12, weight: 600 },
  bodyFont: { family: CHART_MONO_FAMILY, size: 12 },
  padding: 12,
  cornerRadius: 8,
  caretSize: 6,
  titleMarginBottom: 6,
  bodySpacing: 2,
  borderColor: '#E6E3DB',
  borderWidth: 1,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  usePointStyle: true,
};
// NOTE: intentionally NOT `satisfies TooltipOptions` — Chart.js types most
// tooltip fields as required, while ChartOptions accepts deep-partial
// plugin options. The literal is validated contextually where it is used
// (barChartOptions / doughnutChartOptions / defaultChartOptions).

const legendBase = {
  labels: {
    color: AXIS_TEXT_COLOR,
    font: { family: CHART_FONT_FAMILY, size: 11 },
    boxWidth: 10,
    boxHeight: 10,
    usePointStyle: true,
    pointStyle: 'rect' as const,
    padding: 16,
  },
};
// NOTE: same as tooltipBase above — no `satisfies LegendOptions`, the
// literal is validated contextually at its use sites.

const coreBehaviour = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  animation: { duration: 300 },
} satisfies Pick<
  ChartOptions,
  'responsive' | 'maintainAspectRatio' | 'interaction' | 'animation'
>;

/** Tooltip label for bar charts: "Series: 1,470" or "Attrition %: 20.6".
 *  Horizontal bars (indexAxis 'y') carry the value on the x axis. */
export function barTooltipLabel(context: TooltipItem<'bar'>): string {
  const parsed = context.parsed;
  const horizontal = context.chart.options.indexAxis === 'y';
  const value =
    parsed && typeof parsed === 'object'
      ? horizontal
        ? parsed.x
        : parsed.y
      : null;
  const label = context.dataset.label ? `${context.dataset.label}: ` : '';
  const formatted =
    value !== null && !Number.isInteger(value)
      ? formatNumberValue(value, 'decimal1')
      : formatNumberValue(value);
  return `${label}${formatted}`;
}

/** Tooltip label for doughnut charts: "Sales: 1,234 (20.6%)". */
export function doughnutTooltipLabel(context: TooltipItem<'doughnut'>): string {
  const data = context.dataset.data as number[];
  const total = data.reduce(
    (sum, v) => sum + (typeof v === 'number' && !Number.isNaN(v) ? v : 0),
    0,
  );
  const value = context.parsed;
  const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return `${context.label}: ${formatNumberValue(value)} (${share}%)`;
}

/**
 * Shared per-chart options: fonts, tooltip, legend, interaction.
 * No scales and no type-specific settings — base-chart merges in the
 * type-specific options (barChartOptions / doughnutChartOptions).
 */
export const defaultChartOptions: ChartOptions = {
  ...coreBehaviour,
  plugins: {
    legend: { ...legendBase, position: 'bottom' },
    tooltip: { ...tooltipBase },
  },
};

/** Thin muted gridlines, no vertical gridlines, hairline axis. */
export const barScales: ChartOptions<'bar'>['scales'] = {
  x: {
    grid: { display: false },
    border: { color: GRIDLINE_STRONG_COLOR },
    ticks: {
      color: AXIS_TEXT_COLOR,
      font: { family: CHART_FONT_FAMILY, size: 12, weight: 500 },
    },
  },
  y: {
    beginAtZero: true,
    grid: { color: GRIDLINE_COLOR, lineWidth: 1 },
    border: { display: false },
    ticks: {
      color: AXIS_TEXT_COLOR,
      font: { family: CHART_FONT_FAMILY, size: 12 },
      precision: 0,
    },
  },
};

/** Bar-chart options: shared theme + scales + bar tooltip. */
export const barChartOptions: ChartOptions<'bar'> = {
  ...coreBehaviour,
  plugins: {
    legend: { ...legendBase, position: 'bottom' },
    tooltip: { ...tooltipBase, callbacks: { label: barTooltipLabel } },
  },
  scales: barScales,
};

/** Doughnut-chart options: shared theme + cutout + doughnut tooltip. */
export const doughnutChartOptions: ChartOptions<'doughnut'> = {
  ...coreBehaviour,
  cutout: '62%',
  plugins: {
    legend: { ...legendBase, position: 'bottom' },
    tooltip: { ...tooltipBase, callbacks: { label: doughnutTooltipLabel } },
  },
};

/** Dataset defaults for bar charts: solid muted fills, softer rounded caps. */
export const barDatasetDefaults = {
  borderRadius: 4,
  borderSkipped: false,
  maxBarThickness: 48,
  categoryPercentage: 0.7,
  barPercentage: 0.85,
} satisfies Partial<BarControllerDatasetOptions>;

/** Dataset defaults for doughnut charts: white separators between slices. */
export const doughnutDatasetDefaults = {
  borderColor: DOUGHNUT_BORDER,
  borderWidth: 2,
  hoverOffset: 2,
} satisfies Partial<DoughnutControllerDatasetOptions>;

/* ------------------------------------------------------------------ */
/* v2 additions: value labels, horizontal bars, heatmap, sparkline.    */
/* ------------------------------------------------------------------ */

/**
 * Custom Chart.js plugin: draws the value on top of every bar (vertical)
 * or to the right of every bar (horizontal). Implemented by hand because
 * no new npm packages are allowed (no chartjs-plugin-datalabels).
 * Only used when <app-base-chart showValues> is set. Flat text, no
 * background, no shadows — values are formatted exactly like tooltips.
 */
export const valueLabelsPlugin: Plugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const horizontal = chart.options.indexAxis === 'y';
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = `600 11px ${CHART_FONT_FAMILY}`;
    ctx.fillStyle = AXIS_TEXT_COLOR;
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) {
        return;
      }
      meta.data.forEach((element, index) => {
        const raw = (dataset.data as (number | null)[])[index];
        if (raw === null || raw === undefined || Number.isNaN(raw)) {
          return;
        }
        const text = Number.isInteger(raw)
          ? formatNumberValue(raw)
          : formatNumberValue(raw, 'decimal1');
        const el = element as unknown as { x: number; y: number };
        if (horizontal) {
          ctx.textAlign = 'left';
          ctx.fillText(text, el.x + 6, el.y);
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(text, el.x, el.y - 8);
        }
      });
    });
    ctx.restore();
  },
};

/** Horizontal bar scales: the value axis is x, the category axis is y. */
export const horizontalBarScales: ChartOptions<'bar'>['scales'] = {
  x: {
    beginAtZero: true,
    grid: { color: GRIDLINE_COLOR, lineWidth: 1 },
    border: { display: false },
    ticks: {
      color: AXIS_TEXT_COLOR,
      font: { family: CHART_FONT_FAMILY, size: 12 },
      precision: 0,
    },
  },
  y: {
    grid: { display: false },
    border: { color: GRIDLINE_STRONG_COLOR },
    ticks: {
      color: AXIS_TEXT_COLOR,
      font: { family: CHART_FONT_FAMILY, size: 12, weight: 500 },
    },
  },
};

/** Horizontal bar-chart options: shared theme + swapped scales + tooltip. */
export const horizontalBarChartOptions: ChartOptions<'bar'> = {
  ...coreBehaviour,
  indexAxis: 'y',
  plugins: {
    legend: { ...legendBase, position: 'bottom' },
    tooltip: { ...tooltipBase, callbacks: { label: barTooltipLabel } },
  },
  scales: horizontalBarScales,
};

/* ------------------------------------------------------------------ */
/* Heatmap colour scale (attrition rate -> flat cell colour).          */
/* Five discrete steps from the muted palette — no gradients anywhere: */
/* each cell is one flat colour. The top step is brick, the app's       */
/* "high attrition" colour; darker cells get white text.               */
/* ------------------------------------------------------------------ */

export interface HeatmapStep {
  min: number;
  max: number;
  label: string;
  background: string;
  color: string;
}

export const HEATMAP_STEPS: HeatmapStep[] = [
  { min: 0, max: 5, label: '0–5%', background: '#F4F3EF', color: '#55524C' },
  { min: 5, max: 10, label: '5–10%', background: '#D9E6E2', color: '#191919' },
  { min: 10, max: 20, label: '10–20%', background: '#A9C6BF', color: '#191919' },
  { min: 20, max: 30, label: '20–30%', background: '#4E8A80', color: '#FFFFFF' },
  { min: 30, max: Infinity, label: '30%+', background: '#A83226', color: '#FFFFFF' },
];

/** Step (background + text colour) for an attrition rate. */
export function heatmapColor(rate: number): HeatmapStep {
  const r = Number.isFinite(rate) ? rate : 0;
  return (
    HEATMAP_STEPS.find((step) => r >= step.min && r < step.max) ??
    HEATMAP_STEPS[HEATMAP_STEPS.length - 1]
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline: tiny line chart, no axes, no legend, no tooltip.         */
/* Teal stroke, last-point dot only. Used inside KPI cards.            */
/* ------------------------------------------------------------------ */

export const sparklineChartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  animation: { duration: 300 },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  scales: {
    x: { display: false },
    y: { display: false },
  },
};

/** Sparkline dataset defaults: teal line, no fill, no points by default. */
export const sparklineDatasetDefaults = {
  borderColor: '#0E5E54',
  borderWidth: 2,
  tension: 0.35,
  fill: false,
  pointRadius: 0,
  pointHoverRadius: 0,
} satisfies Partial<LineControllerDatasetOptions>;
