/**
 * DI tokens for the pipeline module. Using `Symbol` keeps the injection
 * surface type-safe even when a value class is the same as the token
 * (which would otherwise collide with `@Inject(Cls)` lookups).
 *
 * Adapters are registered TWICE:
 *   - by their concrete class (so consumers can `@Inject(MercadoLibreAdapter)`)
 *   - under these symbols (so `PipelineService` can resolve the
 *     well-typed aliases `DW_LOADER`, `DATA_SOURCES`, `STAGING_PROCESSOR`)
 *
 * Why? The class-based injection is what NestJS providers always support;
 * the symbol tokens are how `useFactory` returns an `IDataSource[]` from
 * a heterogeneous group of seven adapters.
 */
export const DW_LOADER = Symbol('PIPELINE_DW_LOADER');
export const DATA_SOURCES = Symbol('PIPELINE_DATA_SOURCES');
export const STAGING_PROCESSOR = Symbol('PIPELINE_STAGING_PROCESSOR');
