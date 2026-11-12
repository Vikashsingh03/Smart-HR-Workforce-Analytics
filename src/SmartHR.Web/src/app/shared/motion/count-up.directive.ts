import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
} from '@angular/core';

/**
 * Count-up directive — animates a number from its current displayed value
 * to the target over ~600ms with an ease-out curve. Used by the KPI row
 * (B1) on dashboard values.
 *
 * Basic use:
 *   <span [appCountUp]="summary.totalEmployees"></span>
 *
 * With decimals / affixes:
 *   <span [appCountUp]="summary.attritionRate" [appCountUpDecimals]="1" appCountUpSuffix="%"></span>
 *   <span [appCountUp]="summary.avgMonthlyIncome" appCountUpPrefix="$"></span>
 *
 * Behaviour:
 * - Numbers are formatted with Indian digit grouping (1,470 / 6,503) to
 *   match the format-number pipe.
 * - A new target re-animates from the currently displayed value.
 * - Respects prefers-reduced-motion: jumps straight to the final value.
 * - No-op when the target equals the displayed value.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  /** Target value to count up (or down) to. Required. */
  @Input({ required: true }) appCountUp = 0;

  /** Decimal places in the displayed value. Default 0. */
  @Input() appCountUpDecimals = 0;

  /** Animation duration in milliseconds. Default 600. */
  @Input() appCountUpDuration = 600;

  /** Text placed before the number, e.g. "$". Default ''. */
  @Input() appCountUpPrefix = '';

  /** Text placed after the number, e.g. "%". Default ''. */
  @Input() appCountUpSuffix = '';

  private current = 0;
  private rafId = 0;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // First binding sets the initial value; later changes re-animate.
    if (changes['appCountUp'] || changes['appCountUpDecimals']
      || changes['appCountUpPrefix'] || changes['appCountUpSuffix']) {
      this.animateTo(toFiniteNumber(this.appCountUp));
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.rafId);

    if (target === this.current) {
      this.render();
      return;
    }

    if (prefersReducedMotion() || !canAnimate() || this.appCountUpDuration <= 0) {
      this.current = target;
      this.render();
      return;
    }

    const from = this.current;
    const duration = this.appCountUpDuration;
    const start = performance.now();

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic: fast start, gentle landing
      this.current = from + (target - from) * eased;
      this.render();
      if (t < 1) {
        this.rafId = requestAnimationFrame(step);
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  private render(): void {
    this.renderer.setProperty(this.el.nativeElement, 'textContent', this.format(this.current));
  }

  private format(value: number): string {
    const fixed = value.toFixed(Math.max(0, this.appCountUpDecimals));
    const [intPart, decPart] = fixed.split('.');
    const grouped = Number(intPart).toLocaleString('en-IN');
    const text = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
    return `${this.appCountUpPrefix}${text}${this.appCountUpSuffix}`;
  }
}

function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function canAnimate(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function' &&
    typeof window.performance !== 'undefined'
  );
}
