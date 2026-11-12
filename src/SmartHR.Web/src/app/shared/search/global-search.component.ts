import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { ApiService } from '../../core/api.service';
import { EmployeeRow, PagedResult } from '../../core/models';
import { BadgeComponent } from '../ui/badge.component';

/**
 * Global search (topbar). Type an employee number, job role or department
 * and matching employees appear in a dropdown, fetched live from the API
 * (debounced 300ms, max 8 results). Enter or clicking a result navigates to
 * /employees with the search applied via ?search=. Escape or clicking
 * outside closes the dropdown. No inputs — A1 places it in the topbar.
 */
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BadgeComponent],
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.css'],
})
export class GlobalSearchComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = new FormControl('', { nonNullable: true });

  results: EmployeeRow[] = [];
  total = 0;
  open = false;
  loading = false;
  error = false;
  hasQuery = false;
  activeIndex = -1;

  ngOnInit(): void {
    this.query.valueChanges
      .pipe(
        map((value) => (value ?? '').trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => {
          this.hasQuery = q.length > 0;
          this.error = false;
          this.activeIndex = -1;
          if (!this.hasQuery) {
            this.results = [];
            this.total = 0;
            this.loading = false;
            this.open = false;
          }
        }),
        filter((q) => q.length > 0),
        tap(() => {
          this.loading = true;
          this.open = true;
        }),
        switchMap((q) =>
          this.api.getEmployees({ search: q, pageSize: 8 }).pipe(
            catchError(() => {
              this.error = true;
              return of({
                items: [],
                total: 0,
                page: 1,
                pageSize: 8,
              } as PagedResult<EmployeeRow>);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.loading = false;
        this.results = page.items;
        this.total = page.total;
        this.activeIndex = -1;
        this.open = true;
      });
  }

  /** Reopen the dropdown on focus when there is already a query. */
  onFocus(): void {
    if (this.hasQuery && (this.results.length > 0 || this.error)) {
      this.open = true;
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open && this.results.length > 0) {
        this.open = true;
      }
      this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex >= 0 && this.results[this.activeIndex]) {
        this.select(this.results[this.activeIndex]);
      } else {
        this.goToEmployees(this.query.value.trim());
      }
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  /** Click a result: go to that exact employee on the Employees page. */
  select(employee: EmployeeRow): void {
    this.goToEmployees(String(employee.employeeNumber));
  }

  clear(): void {
    this.query.setValue('');
    this.results = [];
    this.total = 0;
    this.open = false;
    this.error = false;
    this.activeIndex = -1;
  }

  /** Clicking outside the component closes the dropdown. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private goToEmployees(search: string): void {
    this.close();
    if (search) {
      void this.router.navigate(['/employees'], { queryParams: { search } });
    } else {
      void this.router.navigate(['/employees']);
    }
  }

  private close(): void {
    this.open = false;
    this.activeIndex = -1;
  }
}
