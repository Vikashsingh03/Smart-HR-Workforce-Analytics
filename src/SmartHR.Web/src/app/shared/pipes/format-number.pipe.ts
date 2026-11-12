import { Pipe, PipeTransform } from '@angular/core';

export type NumberFormatMode = 'number' | 'percent' | 'decimal' | 'decimal1';

/**
 * Single source of truth for number formatting in the app — templates use
 * the `formatNumber` pipe, canvas tooltips (chart-theme.ts) import this
 * function directly so figures look identical everywhere.
 *
 * - 'number'  : Indian digit grouping, no decimals — 1470 -> "1,470".
 * - 'percent' : 1 decimal + % sign — 16.1 -> "16.1%".
 * - 'decimal' : 2 decimals — 3.214 -> "3.21" (satisfaction averages).
 * - 'decimal1': 1 decimal, no % — 20.6 -> "20.6" (rates shown as values).
 * Null / undefined / NaN renders as an em dash, never "0" or "NaN".
 */
export function formatNumberValue(
  value: number | null | undefined,
  mode: NumberFormatMode = 'number',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  switch (mode) {
    case 'percent':
      return `${new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)}%`;
    case 'decimal':
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case 'decimal1':
      return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
    case 'number':
    default:
      return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
      }).format(value);
  }
}

/**
 * Usage in templates:
 *   {{ summary.totalEmployees | formatNumber }}            -> 1,470
 *   {{ row.rate | formatNumber : 'percent' }}              -> 20.6%
 *   {{ row.avgJobSatisfaction | formatNumber : 'decimal' }} -> 3.21
 */
@Pipe({ name: 'formatNumber', standalone: true })
export class FormatNumberPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    mode: NumberFormatMode = 'number',
  ): string {
    return formatNumberValue(value, mode);
  }
}
