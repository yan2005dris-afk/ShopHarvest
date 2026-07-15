import { ChangeDetectionStrategy, Component, computed, effect, input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import type { PriceObservation } from '../../../services/api.service';

/**
 * Price history chart using Canvas API.
 * Renders one line per offer (color-coded by source).
 */
@Component({
  selector: 'app-price-history-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas #canvas [width]="width" [height]="height" style="width: 100%; height: auto; display: block;"></canvas>
  `,
  styles: [`
    :host { display: block; width: 100%; }
  `],
})
export class PriceHistoryChartComponent implements AfterViewInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Price observations for all offers of the selected product. */
  readonly observations = input.required<PriceObservation[]>();

  /** Width in CSS pixels (CSS size, not device pixels). */
  readonly width = 600;
  /** Height in CSS pixels. */
  readonly height = 240;

  readonly dpr = computed(() => window.devicePixelRatio || 1);

  private canvasEl!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // Chart configuration constants.
  // Series colors come from the Insight Flow palette so the chart
  // matches the rest of the dashboard in light + dark mode.
  // (Material 3 primary / secondary / success / warning / danger /
  //  tertiary-fixed etc — kept as fallbacks if a token isn't bound.)
  private readonly padding = { top: 20, right: 20, bottom: 40, left: 60 };
  private readonly colors = [
    '#494bd6', // surface-tint / primary
    '#10b981', // success (emerald-500)
    '#f59e0b', // warning (amber-500)
    '#ef4444', // danger  (red-500)
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
  ];

  ngAfterViewInit(): void {
    this.canvasEl = this.canvasRef.nativeElement;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.draw();
  }

  // Redraw when observations change
  constructor() {
    effect(() => {
      this.observations();
      if (this.ctx) this.draw();
    });
  }

  private draw(): void {
    const observations = this.observations();
    if (!observations.length) return;

    const dpr = this.dpr();
    const cssWidth = this.width;
    const cssHeight = this.height;

    // Set canvas resolution to match device pixel ratio
    this.canvasEl.width = cssWidth * dpr;
    this.canvasEl.height = cssHeight * dpr;
    this.canvasEl.style.width = `${cssWidth}px`;
    this.canvasEl.style.height = `${cssHeight}px`;
    this.ctx.scale(dpr, dpr);

    const chartW = cssWidth - this.padding.left - this.padding.right;
    const chartH = cssHeight - this.padding.top - this.padding.bottom;

    // Group observations by offerId
    const grouped = new Map<string, PriceObservation[]>();
    for (const obs of observations) {
      const key = obs.offerId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(obs);
    }

    // Sort each group by date and build series
    const series: { offerId: string; color: string; data: { x: number; y: number }[] }[] = [];
    const allDates: Date[] = [];
    const allPrices: number[] = [];

    grouped.forEach((obs, offerId) => {
      const sorted = [...obs].sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
      allDates.push(...sorted.map(o => new Date(o.observedAt)));
      allPrices.push(...sorted.map(o => Number(o.price)));
      series.push({
        offerId,
        color: this.colors[series.length % this.colors.length],
        data: sorted.map(o => ({
          x: new Date(o.observedAt).getTime(),
          y: Number(o.price),
        })),
      });
    });

    if (!allDates.length) return;

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;
    const dateRange = maxDate.getTime() - minDate.getTime() || 1;

    // Clear
    this.ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Theme colors — read from the Insight Flow CSS vars first, fall
    // back to slate-* defaults if the tokens aren't bound (e.g. in
    // unit tests where styles.css isn't loaded).
    const computedStyle = getComputedStyle(document.documentElement);
    const colorBorder =
      computedStyle.getPropertyValue('--color-outline-variant').trim() || '#c7c4d7';
    const colorText3 =
      computedStyle.getPropertyValue('--color-on-surface-variant').trim() || '#464554';
    const colorText1 =
      computedStyle.getPropertyValue('--color-on-surface').trim() || '#111c2d';

    // Grid lines (horizontal)
    this.ctx.strokeStyle = colorBorder;
    this.ctx.lineWidth = 1;
    this.ctx.font = '11px sans-serif';
    this.ctx.fillStyle = colorText3;
    this.ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const y = this.padding.top + (chartH / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(this.padding.left, y);
      this.ctx.lineTo(cssWidth - this.padding.right, y);
      this.ctx.stroke();

      const val = maxPrice - (priceRange / 4) * i;
      this.ctx.fillText(val.toFixed(2), this.padding.left - 8, y + 4);
    }

    // Draw each series
    series.forEach((s, idx) => {
      this.ctx.strokeStyle = s.color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();

      s.data.forEach((point, i) => {
        const x = this.padding.left + ((point.x - minDate.getTime()) / dateRange) * chartW;
        const y = this.padding.top + chartH - ((point.y - minPrice) / priceRange) * chartH;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      });
      this.ctx.stroke();

      // Draw dots
      this.ctx.fillStyle = s.color;
      s.data.forEach(point => {
        const x = this.padding.left + ((point.x - minDate.getTime()) / dateRange) * chartW;
        const y = this.padding.top + chartH - ((point.y - minPrice) / priceRange) * chartH;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });

    // X-axis labels (dates)
    this.ctx.fillStyle = colorText3;
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = this.padding.left + (chartW / 4) * i;
      const date = new Date(minDate.getTime() + (dateRange / 4) * i);
      this.ctx.fillText(date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' }), x, cssHeight - 5);
    }

    // Y-axis label
    this.ctx.save();
    this.ctx.translate(15, cssHeight / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.fillStyle = colorText3;
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Price (USD)', 0, 0);
    this.ctx.restore();

    // Legend
    this.ctx.font = '11px sans-serif';
    this.ctx.textAlign = 'left';
    series.forEach((s, idx) => {
      const lx = this.padding.left + 10;
      const ly = this.padding.top + 10 + idx * 18;
      this.ctx.fillStyle = s.color;
      this.ctx.fillRect(lx, ly - 8, 12, 12);
      this.ctx.fillStyle = colorText1;
      this.ctx.fillText(s.offerId.substring(0, 20), lx + 16, ly + 4);
    });
  }
}