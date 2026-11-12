import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../core/api.service';

/**
 * Filter values for the employees table. An empty string means "no filter".
 * C1 (employees table) owns the table: it sends `search` and `department`
 * to the API (the only two the API supports server-side) and applies
 * `role`, `attrition`, `incomeBand` and `tenureBand` client-side to the
 * loaded page.
 *
 * Band meanings (from the proposal's derived fields):
 * - incomeBand: '<3000' is monthlyIncome < 3000; '3000-6000' is
 *   3000 <= monthlyIncome < 6000; '6000-10000' is 6000 <= monthlyIncome
 *   < 10000; '>10000' is monthlyIncome >= 10000.
 * - tenureBand: '0-2' is yearsAtCompany <= 2; '3-5' is 3..5; '6-10' is
 *   6..10; '10+' is yearsAtCompany > 10.
 */
export interface EmployeeFilters {
  search: string;
  department: string;
  role: string;
  attrition: '' | 'left' | 'stayed';
  incomeBand: string;
  tenureBand: string;
}

export const EMPTY_FILTERS: EmployeeFilters = {
  search: '',
  department: '',
  role: '',
  attrition: '',
  incomeBand: '',
  tenureBand: '',
};

export const ATTRITION_OPTIONS: { value: '' | 'left' | 'stayed'; label: string }[] = [
  { value: '', label: 'All employees' },
  { value: 'left', label: 'Left' },
  { value: 'stayed', label: 'Stayed' },
];

export const INCOME_BANDS: { value: string; label: string }[] = [
  { value: '', label: 'All income' },
  { value: '<3000', label: 'Under $3,000' },
  { value: '3000-6000', label: '$3,000 – $6,000' },
  { value: '6000-10000', label: '$6,000 – $10,000' },
  { value: '>10000', label: 'Over $10,000' },
];

export const TENURE_BANDS: { value: string; label: string }[] = [
  { value: '', label: 'All tenure' },
  { value: '0-2', label: '0–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '10+', label: '10+ years' },
];

/**
 * Downloads rows as a real .csv file in the browser. C1 imports this helper
 * and calls it with the currently filtered rows when this component emits
 * `exportRequested`. Returns false when there is nothing to write (no rows
 * and no columns given). Values containing a comma, quote or newline are
 * quoted per RFC 4180.
 */
export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: string[],
): boolean {
  const headers = columns ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  if (headers.length === 0) {
    return false;
  }
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const text = String(value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(','));
  }
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

@Component({
  selector: 'app-employee-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './employee-filters.component.html',
  styleUrls: ['./employee-filters.component.css'],
})
export class EmployeeFiltersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Starting values, e.g. from the ?search= query param. Applied once on init. */
  @Input() initialFilters: Partial<EmployeeFilters> = {};

  /** C1 sets this when there are no rows to export. */
  @Input() exportDisabled = false;

  /** Emitted on every filter change (search is debounced 300ms). */
  @Output() filtersChanged = new EventEmitter<EmployeeFilters>();

  /**
   * Emitted when the user clicks "Export CSV". This component does not fetch
   * rows itself — C1 handles the download, e.g. by calling the exported
   * downloadCsv() helper with the currently filtered rows.
   */
  @Output() exportRequested = new EventEmitter<void>();

  readonly incomeBands = INCOME_BANDS;
  readonly tenureBands = TENURE_BANDS;
  readonly attritionOptions = ATTRITION_OPTIONS;

  departments: string[] = [];
  roles: string[] = [];
  optionsFailed = false;

  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    department: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true }),
    attrition: new FormControl<'' | 'left' | 'stayed'>('', { nonNullable: true }),
    incomeBand: new FormControl('', { nonNullable: true }),
    tenureBand: new FormControl('', { nonNullable: true }),
  });

  get activeFilterCount(): number {
    const values = this.form.getRawValue();
    let count = 0;
    if (values.search.trim() !== '') {
      count++;
    }
    if (values.department !== '') {
      count++;
    }
    if (values.role !== '') {
      count++;
    }
    if (values.attrition !== '') {
      count++;
    }
    if (values.incomeBand !== '') {
      count++;
    }
    if (values.tenureBand !== '') {
      count++;
    }
    return count;
  }

  ngOnInit(): void {
    this.form.setValue({ ...EMPTY_FILTERS, ...this.initialFilters }, { emitEvent: false });

    // Department and role options come from the API, so the dropdowns can
    // never list a value the data does not have.
    forkJoin({
      departments: this.api.getAttritionByDepartment(),
      roles: this.api.getAttritionByRole(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ departments, roles }) => {
          this.departments = departments
            .map((row) => row.group)
            .sort((a, b) => a.localeCompare(b));
          this.roles = roles.map((row) => row.group).sort((a, b) => a.localeCompare(b));
        },
        error: () => {
          this.optionsFailed = true;
        },
      });

    const controls = this.form.controls;
    controls.search.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.emitFilters());

    const instant = (control: FormControl<string | '' | 'left' | 'stayed'>): void => {
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.emitFilters());
    };
    instant(controls.department);
    instant(controls.role);
    instant(controls.attrition);
    instant(controls.incomeBand);
    instant(controls.tenureBand);

    this.emitFilters();
  }

  clearFilters(): void {
    this.form.setValue({ ...EMPTY_FILTERS }, { emitEvent: false });
    this.emitFilters();
  }

  requestExport(): void {
    this.exportRequested.emit();
  }

  private emitFilters(): void {
    const values = this.form.getRawValue();
    this.filtersChanged.emit({
      search: values.search.trim(),
      department: values.department,
      role: values.role,
      attrition: values.attrition,
      incomeBand: values.incomeBand,
      tenureBand: values.tenureBand,
    });
  }
}
