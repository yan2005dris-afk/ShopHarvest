/**
 * Canonical identifiers for every external data source the ETL pipeline
 * pulls from. The string values are persisted in `dw.dim_fuente.nombre_fuente`
 * and reused by analytics views (e.g. `dw.v_kpi_distribucion_fuentes`),
 * so renaming an enum member is a breaking change that requires a migration.
 */
export enum PipelineSource {
  MERCADOLIBRE = 'mercadolibre',
  ALIEXPRESS = 'aliexpress',
  TEMU = 'temu',
  SHEIN = 'shein',
  API_RATES = 'api_rates',
  CSV_DATASET = 'csv_dataset',
  ENCUESTA = 'encuesta',
}
