import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Parse a 'YYYY-MM-DD' string (or null/empty) into a local-midnight Date (or null). */
export function fromIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if ([y, m, d].some((v) => Number.isNaN(v))) return null;
  return new Date(y, m - 1, d);
}

/** Format a Date as a local 'YYYY-MM-DD' string, or '' for "no bound". */
export function toIsoDate(date: Date | null | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  disabled: boolean;
}

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Shared date field styled to match the plain bordered inputs used elsewhere
 * in the filter sidebars (e.g. the price-range fields in analisis.page).
 * The trigger is a read-only field that opens a custom calendar dropdown
 * themed with the app's Insight Flow tokens — no Angular Material dependency,
 * so it fully matches the app's own light/dark palette.
 *
 * Callers own their own visible label; this component only renders the
 * field + calendar.
 */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  template: `
    <div class="relative">
      <input
        type="text"
        readonly
        class="w-full cursor-pointer rounded-md border border-outline-variant bg-surface-container-low px-2 py-1.5 text-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        [class.pr-6]="value()"
        [attr.id]="id() ?? null"
        [value]="toIsoDate(value())"
        placeholder="AAAA-MM-DD"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() ?? label() ?? ''"
        (click)="toggle()"
        (keydown.enter)="toggle()"
        (keydown.space)="toggle()"
      />
      @if (value(); as v) {
        <button
          type="button"
          class="absolute top-1/2 right-2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          aria-label="Limpiar fecha"
          (click)="clear($event)"
        >
          ×
        </button>
      }
      @if (isOpen()) {
        <div
          class="absolute top-[calc(100%+4px)] left-0 z-[60] w-[264px] rounded-md border border-outline-variant bg-surface-container-low p-2 shadow-lg"
          role="dialog"
          aria-label="Seleccionar fecha"
        >
          <div class="mb-1 flex items-center justify-between">
            <button
              type="button"
              class="rounded-sm px-2 py-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              aria-label="Mes anterior"
              (click)="prevMonth()"
            >
              ‹
            </button>
            <span class="text-body-md font-semibold text-on-surface">{{ monthLabel() }}</span>
            <button
              type="button"
              class="rounded-sm px-2 py-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              aria-label="Mes siguiente"
              (click)="nextMonth()"
            >
              ›
            </button>
          </div>
          <div class="grid grid-cols-7 gap-0.5 text-center text-label-caps text-on-surface-variant">
            @for (wd of weekdayLabels; track $index) {
              <span class="py-1">{{ wd }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-0.5">
            @for (day of days(); track day.date.getTime()) {
              <button
                type="button"
                class="rounded-sm py-1 text-body-md transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                [class.text-on-surface]="day.inCurrentMonth && !isSelected(day.date)"
                [class.text-on-surface-variant]="!day.inCurrentMonth"
                [class.opacity-40]="!day.inCurrentMonth"
                [class.bg-primary]="isSelected(day.date)"
                [class.text-on-primary]="isSelected(day.date)"
                [class.font-semibold]="isSelected(day.date)"
                [class.border]="isToday(day.date) && !isSelected(day.date)"
                [class.border-primary]="isToday(day.date) && !isSelected(day.date)"
                [disabled]="day.disabled"
                (click)="selectDay(day.date)"
              >
                {{ day.date.getDate() }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DateRangePickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly toIsoDate = toIsoDate;
  protected readonly weekdayLabels = WEEKDAY_LABELS;

  /** Field label (optional — callers that render their own label keep it). */
  readonly label = input<string>();
  /** Selected value (Date | null). */
  readonly value = input<Date | null>(null);
  /** Lower bound (Date | null). */
  readonly min = input<Date | null>(null);
  /** Upper bound (Date | null). */
  readonly max = input<Date | null>(null);
  /** Disable the field (e.g. snapshot mode). */
  readonly disabled = input(false);
  /** Optional explicit aria-label; defaults to `label`. */
  readonly ariaLabel = input<string>();
  /** Optional id, forwarded to the trigger input (pairs with a caller's own `<label for>`). */
  readonly id = input<string>();
  /** Emits the newly selected Date (or null when cleared). */
  readonly dateChange = output<Date | null>();

  protected readonly isOpen = signal(false);
  protected readonly viewMonth = signal(this.startOfMonth(this.value() ?? new Date()));

  protected readonly days = computed<CalendarDay[]>(() => {
    const view = this.viewMonth();
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leadingDays = (firstOfMonth.getDay() + 6) % 7; // Monday-start grid
    const gridStart = new Date(year, month, 1 - leadingDays);
    const min = this.min();
    const max = this.max();
    const minDay = min ? stripTime(min) : null;
    const maxDay = max ? stripTime(max) : null;

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const disabled = (minDay != null && date < minDay) || (maxDay != null && date > maxDay);
      return { date, inCurrentMonth: date.getMonth() === month, disabled };
    });
  });

  protected readonly monthLabel = computed(() => {
    const formatted = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
      this.viewMonth(),
    );
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.viewMonth.set(this.startOfMonth(this.value() ?? new Date()));
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected prevMonth(): void {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() - 1, 1));
  }

  protected nextMonth(): void {
    const v = this.viewMonth();
    this.viewMonth.set(new Date(v.getFullYear(), v.getMonth() + 1, 1));
  }

  protected isSelected(date: Date): boolean {
    const v = this.value();
    return v != null && isSameDay(date, v);
  }

  protected isToday(date: Date): boolean {
    return isSameDay(date, new Date());
  }

  protected selectDay(date: Date): void {
    if (this.disabled()) return;
    this.dateChange.emit(stripTime(date));
    this.close();
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.dateChange.emit(null);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}
