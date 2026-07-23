/**
 * Dashboard chart components — domain-aware, reusable chart components.
 *
 * Each component encapsulates:
 * - Data transformation (rows → ApexCharts series/xaxis)
 * - Visual configuration (colors, tooltips, legends, plotOptions)
 * - Snapshot / error badges where applicable
 *
 * Pages import these instead of using the generic ChartHostComponent.
 */

export { PrecioPromedioFuenteCategoriaChartComponent } from './precio-promedio-fuente-categoria.chart';
export { SerieTemporalPreciosChartComponent } from './serie-temporal-precios.chart';
export { DispersionOutliersChartComponent } from './dispersion-outliers.chart';
export { BoxPlotPorFuenteChartComponent } from './boxplot-por-fuente.chart';
export { EncuestaFrecuenciaChartComponent } from './encuesta-frecuencia.chart';
export { EncuestaHeatmapChartComponent } from './encuesta-heatmap.chart';
export { EncuestaGeneroChartComponent } from './encuesta-genero.chart';
