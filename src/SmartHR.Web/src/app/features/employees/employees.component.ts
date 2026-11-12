import { Component, DestroyRef, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { EmployeeRow, PagedResult } from '../../core/models';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorBannerComponent } from '../../shared/ui/error-banner/error-banner.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmployeeDrawerComponent } from './employee-drawer/employee-drawer.component';
import {
  EMPTY_FILTERS,
  EmployeeFilters,
  EmployeeFiltersComponent,
} from './employee-filters/employee-filters.component';

export type SortKey =
  | 'employeeNumber'
  | 'age'
  | 'gender'
  | 'department'
  | 'jobRole'
  | 'monthlyIncome'
  | 'yearsAtCompany'
  | 'attrition';

interface TableColumn {
  key: SortKey;
  label: string;
  numeric: boolean;
}

/**
 * Employees page (v2 composer). Owns the table itself; the filters bar
 * (app-employee-filters, C3) and the row-detail drawer (app-employee-drawer,
 * C2) are composed in. Search and department filter on the server; role,
 * attrition, income-band and tenure-band filter the loaded rows client-side
 * (the API only supports search/department). Sorting is client-side on the
 * loaded rows, re-applied after every load. Reads ?search= from the route
 * query params on init (global search navigates here).
 *
 * NOTE on the filters bar contract (C3, as landed): it takes
 * [initialFilters] (applied once on init) and [exportDisabled], and emits
 * (filtersChanged) on every change (search already debounced 300ms inside
 * the bar) and (exportRequested) for the Export CSV button. It fetches the
 * department/role option lists itself. This composer syncs later ?search=
 * navigations into the bar's search control via ViewChild.
 */
@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    PageHeaderComponent,
    EmployeeDrawerComponent,
    EmployeeFiltersComponent,
  ],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css'],
})
export class EmployeesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(EmployeeFiltersComponent)
  private filtersBar?: EmployeeFiltersComponent;

  readonly pageSize = 20;

  readonly columns: TableColumn[] = [
    { key: 'employeeNumber', label: 'Employee #', numeric: true },
    { key: 'age', label: 'Age', numeric: true },
    { key: 'gender', label: 'Gender', numeric: false },
    { key: 'department', label: 'Department', numeric: false },
    { key: 'jobRole', label: 'Job role', numeric: false },
    { key: 'monthlyIncome', label: 'Monthly income', numeric: true },
    { key: 'yearsAtCompany', label: 'Years at company', numeric: true },
    { key: 'attrition', label: 'Attrition', numeric: false },
  ];

  filters: EmployeeFilters = { ...EMPTY_FILTERS };

  /** Seed for the filters bar, applied once on init (from ?search=). */
  initialFiltersSeed: Partial<EmployeeFilters> = {};

  displayedEmployees: EmployeeRow[] = [];
  total = 0;
  page = 1;
  loading = true;
  error: string | null = null;
  exporting = false;

  sortKey: SortKey | null = null;
  sortDir: 'asc' | 'desc' = 'asc';

  selectedEmployeeNumber: number | null = null;

  private loadedRows: EmployeeRow[] = [];
  serverTotal = 0;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  /** True when any filter the API cannot do is set (role / attrition /
      income band / tenure band). Those rows are filtered client-side. */
  get hasClientFilters(): boolean {
    return (
      this.filters.role !== '' ||
      this.filters.attrition !== '' ||
      this.filters.incomeBand !== '' ||
      this.filters.tenureBand !== ''
    );
  }

  ngOnInit(): void {
    // Seed the search from ?search= (global search navigates here). The
    // filters bar applies initialFilters once on init.
    const seededSearch = this.route.snapshot.queryParamMap.get('search') ?? '';
    if (seededSearch !== '') {
      this.filters.search = seededSearch;
      this.initialFiltersSeed = { search: seededSearch };
    }

    // Apply later ?search= navigations while already on this page. The bar
    // only reads initialFilters on init, so sync its search control directly.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const search = params.get('search') ?? '';
        if (search !== this.filters.search) {
          this.filters = { ...this.filters, search };
          this.page = 1;
          this.filtersBar?.form.controls.search.setValue(search, {
            emitEvent: false,
          });
          this.loadEmployees();
        }
      });

    this.loadEmployees();
  }

  onFiltersChange(next: EmployeeFilters): void {
    if (
      next.search === this.filters.search &&
      next.department === this.filters.department &&
      next.role === this.filters.role &&
      next.attrition === this.filters.attrition &&
      next.incomeBand === this.filters.incomeBand &&
      next.tenureBand === this.filters.tenureBand
    ) {
      return;
    }
    this.filters = { ...next };
    this.page = 1;
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.loading = true;
    this.error = null;
    // Client-side filters run over loaded rows, so load a bigger window
    // (page 1, 100 rows) when any of them is set; otherwise page server-side.
    const requestPage = this.hasClientFilters ? 1 : this.page;
    const requestSize = this.hasClientFilters ? 100 : this.pageSize;
    this.api
      .getEmployees({
        search: this.filters.search.trim() === '' ? undefined : this.filters.search.trim(),
        department: this.filters.department === '' ? undefined : this.filters.department,
        page: requestPage,
        pageSize: requestSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: PagedResult<EmployeeRow>) => {
          this.serverTotal = result.total;
          if (!this.hasClientFilters) {
            this.page = result.page;
          }
          this.loadedRows = result.items;
          this.recomputeDisplay();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error =
            'Could not load employees. Check that the API is running and try again.';
        },
      });
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey !== key) {
      this.sortKey = key;
      this.sortDir = 'asc';
    } else if (this.sortDir === 'asc') {
      this.sortDir = 'desc';
    } else {
      this.sortKey = null;
    }
    this.recomputeDisplay();
  }

  ariaSort(key: SortKey): string {
    if (this.sortKey !== key) {
      return 'none';
    }
    return this.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  prevPage(): void {
    if (this.page <= 1 || this.loading) {
      return;
    }
    this.page -= 1;
    if (this.hasClientFilters) {
      this.recomputeDisplay();
    } else {
      this.loadEmployees();
    }
  }

  nextPage(): void {
    if (this.page >= this.totalPages || this.loading) {
      return;
    }
    this.page += 1;
    if (this.hasClientFilters) {
      this.recomputeDisplay();
    } else {
      this.loadEmployees();
    }
  }

  openDrawer(employee: EmployeeRow): void {
    this.selectedEmployeeNumber = employee.employeeNumber;
  }

  onDrawerClosed(): void {
    this.selectedEmployeeNumber = null;
  }

  clearFilters(): void {
    // The filters bar owns the controls: resetting through it keeps the
    // visible inputs in sync. Its emission drives the reload.
    if (this.filtersBar) {
      this.filtersBar.clearFilters();
      return;
    }
    this.filters = { ...EMPTY_FILTERS };
    this.initialFiltersSeed = {};
    this.page = 1;
    this.loadEmployees();
  }

  retry(): void {
    this.loadEmployees();
  }

  /** Download every row matching the current filters as a real .csv file.
      Pages through the API (100 rows at a time) so the export is the full
      filtered set, not just the page on screen. */
  async exportCsv(): Promise<void> {
    if (this.exporting || this.loading) {
      return;
    }
    this.exporting = true;
    this.error = null;
    try {
      const all: EmployeeRow[] = [];
      let total = Number.POSITIVE_INFINITY;
      let page = 1;
      while (all.length < total && page <= 50) {
        const result = await firstValueFrom(
          this.api.getEmployees({
            search:
              this.filters.search.trim() === ''
                ? undefined
                : this.filters.search.trim(),
            department:
              this.filters.department === '' ? undefined : this.filters.department,
            page,
            pageSize: 100,
          }),
        );
        total = result.total;
        all.push(...result.items);
        if (result.items.length === 0) {
          break;
        }
        page += 1;
      }
      const rows = all
        .filter((row) => this.matchesClientFilters(row))
        .sort((a, b) => this.compareRows(a, b));
      this.downloadCsv(rows);
    } catch {
      this.error =
        'Could not export employees. Check that the API is running and try again.';
    } finally {
      this.exporting = false;
    }
  }

  trackByEmployee(_index: number, employee: EmployeeRow): number {
    return employee.employeeNumber;
  }

  /** Client-side filters (the API cannot do these) over the loaded rows. */
  private matchesClientFilters(row: EmployeeRow): boolean {
    if (this.filters.role !== '' && row.jobRole !== this.filters.role) {
      return false;
    }
    if (this.filters.attrition === 'left' && row.attrition !== 1) {
      return false;
    }
    if (this.filters.attrition === 'stayed' && row.attrition !== 0) {
      return false;
    }
    if (!this.matchesIncome(row.monthlyIncome, this.filters.incomeBand)) {
      return false;
    }
    if (!this.matchesTenure(row.yearsAtCompany, this.filters.tenureBand)) {
      return false;
    }
    return true;
  }

  private matchesIncome(income: number, range: string): boolean {
    switch (range) {
      case '<3000':
        return income < 3000;
      case '3000-6000':
        return income >= 3000 && income < 6000;
      case '6000-10000':
        return income >= 6000 && income < 10000;
      case '>10000':
        return income >= 10000;
      default:
        return true;
    }
  }

  private matchesTenure(years: number, band: string): boolean {
    switch (band) {
      case '0-2':
        return years <= 2;
      case '3-5':
        return years >= 3 && years <= 5;
      case '6-10':
        return years >= 6 && years <= 10;
      case '10+':
        return years > 10;
      default:
        return true;
    }
  }

  private compareRows(a: EmployeeRow, b: EmployeeRow): number {
    if (this.sortKey === null) {
      return 0;
    }
    const av = a[this.sortKey];
    const bv = b[this.sortKey];
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    return this.sortDir === 'asc' ? cmp : -cmp;
  }

  private recomputeDisplay(): void {
    const filtered = this.hasClientFilters
      ? this.loadedRows.filter((row) => this.matchesClientFilters(row))
      : [...this.loadedRows];
    const sorted = [...filtered].sort((a, b) => this.compareRows(a, b));
    this.total = this.hasClientFilters ? filtered.length : this.serverTotal;
    if (this.page > this.totalPages) {
      this.page = this.totalPages;
    }
    this.displayedEmployees = this.hasClientFilters
      ? sorted.slice((this.page - 1) * this.pageSize, this.page * this.pageSize)
      : sorted;
  }

  private downloadCsv(rows: EmployeeRow[]): void {
    const header =
      'EmployeeNumber,Age,Gender,Department,JobRole,MonthlyIncome,YearsAtCompany,Attrition';
    const lines = rows.map((row) =>
      [
        row.employeeNumber,
        row.age,
        row.gender,
        row.department,
        row.jobRole,
        row.monthlyIncome,
        row.yearsAtCompany,
        row.attrition,
      ]
        .map((value) => this.csvCell(value))
        .join(','),
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `employees-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string | number): string {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
