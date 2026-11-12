import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../core/api.service';
import { EmployeeDetail } from '../../../core/models';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ErrorBannerComponent } from '../../../shared/ui/error-banner/error-banner.component';

/**
 * Employee detail drawer. Slides in from the right when `employeeNumber` is
 * set; renders nothing when it is null (closed). Fetches the full profile
 * from the API — every value shown comes from the server, nothing is
 * hardcoded. Close via the button, the Escape key, or a backdrop click.
 */
@Component({
  selector: 'app-employee-drawer',
  standalone: true,
  imports: [CommonModule, BadgeComponent, SkeletonComponent, ErrorBannerComponent],
  templateUrl: './employee-drawer.component.html',
  styleUrls: ['./employee-drawer.component.css'],
})
export class EmployeeDrawerComponent implements OnChanges, OnDestroy {
  @Input() employeeNumber: number | null = null;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  detail: EmployeeDetail | null = null;
  loading = false;
  error: string | null = null;

  private previousBodyOverflow = '';
  private scrollLocked = false;

  get isOpen(): boolean {
    return this.employeeNumber !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['employeeNumber']) {
      return;
    }
    const value = changes['employeeNumber'].currentValue as number | null;
    if (value === null || value === undefined) {
      this.detail = null;
      this.error = null;
      this.loading = false;
      this.unlockScroll();
      return;
    }
    this.load(value);
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  close(): void {
    this.unlockScroll();
    this.closed.emit();
  }

  retry(): void {
    if (this.employeeNumber !== null) {
      this.load(this.employeeNumber);
    }
  }

  /** "Travel_Rarely" -> "Travel Rarely". Presentation only; the value is unchanged. */
  prettify(value: string): string {
    return value.replace(/_/g, ' ');
  }

  /** Satisfaction 1-4 as a width percent for the meter bar. */
  meterWidth(value: number): number {
    return Math.max(0, Math.min(100, (value / 4) * 100));
  }

  private load(employeeNumber: number): void {
    this.loading = true;
    this.error = null;
    this.detail = null;
    this.lockScroll();
    this.api
      .getEmployeeDetail(employeeNumber)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail = detail;
          this.loading = false;
          // Move keyboard focus into the drawer once it is visible.
          setTimeout(() => this.closeButton?.nativeElement.focus(), 0);
        },
        error: () => {
          this.loading = false;
          this.error =
            'Could not load this employee. Check that the API is running and try again.';
        },
      });
  }

  private lockScroll(): void {
    if (this.scrollLocked) {
      return;
    }
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.scrollLocked = true;
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) {
      return;
    }
    document.body.style.overflow = this.previousBodyOverflow;
    this.scrollLocked = false;
  }
}
