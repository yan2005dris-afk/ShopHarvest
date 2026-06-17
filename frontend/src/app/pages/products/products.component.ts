import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, PriceHistory } from '../../services/api.service';

@Component({
  selector: 'app-products',
  imports: [NgFor, NgIf, DatePipe, CurrencyPipe, RouterLink, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm = '';
  selectedProduct: Product | null = null;
  priceHistory: PriceHistory[] = [];
  isLoading = true;
  error = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.error = '';
    this.apiService.getProducts(true).subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = products;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.error = 'Error al cargar productos. Verificá que el backend esté funcionando.';
        console.error('Failed to load products', err);
      },
    });
  }

  filterProducts(): void {
    const term = this.searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    this.filteredProducts = this.products.filter((p) =>
      p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term),
    );
  }

  selectProduct(product: Product): void {
    if (this.selectedProduct?.id === product.id) {
      this.selectedProduct = null;
      this.priceHistory = [];
      return;
    }

    this.selectedProduct = product;
    this.loadPriceHistory(product.id);
  }

  private loadPriceHistory(productId: string): void {
    this.apiService.getPriceHistory(productId).subscribe({
      next: (history) => {
        this.priceHistory = history;
        this.cdr.markForCheck();
        // Render chart after a tick to ensure DOM is ready
        setTimeout(() => this.renderChart(), 0);
      },
      error: (err) => {
        console.error('Failed to load price history', err);
      },
    });
  }

  private renderChart(): void {
    const canvas = document.getElementById('price-chart') as HTMLCanvasElement | null;
    if (!canvas || this.priceHistory.length === 0) return;

    // Simple inline chart using Canvas API (no Chart.js dependency needed)
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Sort by date ascending for chart
    const sorted = [...this.priceHistory].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );

    const prices = sorted.map((h) => Number(h.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), padding.left - 8, y + 4);
    }

    // Plot line
    if (sorted.length === 1) {
      // Single point — draw a dot
      const x = padding.left + chartW / 2;
      const y = padding.top + chartH - ((prices[0] - minPrice) / priceRange) * chartH;
      ctx.fillStyle = '#007bff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Multiple points — draw line
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.beginPath();

      sorted.forEach((h, i) => {
        const x = padding.left + (i / (sorted.length - 1)) * chartW;
        const y = padding.top + chartH - ((Number(h.price) - minPrice) / priceRange) * chartH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Dots
      sorted.forEach((h, i) => {
        const x = padding.left + (i / (sorted.length - 1)) * chartW;
        const y = padding.top + chartH - ((Number(h.price) - minPrice) / priceRange) * chartH;
        ctx.fillStyle = '#007bff';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // X-axis title
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fecha', width / 2, height - 5);
  }
}
