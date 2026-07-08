/**
 * Barrel for all IDataSource adapters. PipelineService injects the
 * DATA_SOURCES token which resolves to an array of the seven
 * adapters defined here.
 */
export { MercadoLibreAdapter } from './meli.adapter';
export { AliExpressAdapter } from './ali.adapter';
export { TemuAdapter } from './temu.adapter';
export { SheinAdapter } from './shein.adapter';
export { ApiRateAdapter } from './api-rates.adapter';
export { CsvAdapter } from './csv.adapter';
export { EncuestaAdapter } from './encuesta.adapter';
