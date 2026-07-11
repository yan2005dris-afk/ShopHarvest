import { Injectable, Logger } from '@nestjs/common';
import type {
  QualityCheckFn,
  QualityReport,
} from './quality/quality-check.types';
import { requiredFieldsCheck } from './quality/checks/required-fields.check';
import { pricePositiveCheck } from './quality/checks/price-positive.check';
import { currencyKnownCheck } from './quality/checks/currency-known.check';
import { urlWellFormedCheck } from './quality/checks/url-well-formed.check';
import { categoryNonemptyCheck } from './quality/checks/category-nonempty.check';
import { duplicateProductIdCheck } from './quality/checks/duplicate-product-id.check';
import { stagingRowCountCheck } from './quality/checks/staging-row-count.check';

const CHECKS: ReadonlyArray<{ name: string; fn: QualityCheckFn }> = [
  { name: 'staging-row-count', fn: stagingRowCountCheck },
  { name: 'required-fields', fn: requiredFieldsCheck },
  { name: 'price-positive', fn: pricePositiveCheck },
  { name: 'currency-known', fn: currencyKnownCheck },
  { name: 'url-well-formed', fn: urlWellFormedCheck },
  { name: 'category-nonempty', fn: categoryNonemptyCheck },
  { name: 'duplicate-product-id', fn: duplicateProductIdCheck },
];

/**
 * QualityService — runs the 7 quality checks (ETL-3) against a staging
 * batch and fails fast (ETL-4): if any check fails, `run()` returns a
 * `QualityReport` with `state: 'failed'` and the caller (DwLoaderService)
 * MUST NOT proceed to write `dw.*`.
 */
@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  run(rows: ReadonlyArray<Record<string, unknown>>): QualityReport {
    const checks = CHECKS.map(({ name, fn }) => {
      const result = fn(rows);
      if (result.passed) {
        this.logger.log(`check=${name} passed rows=${rows.length}`);
      } else {
        this.logger.warn(
          `check=${name} FAILED rows=${rows.length} failures=${result.failures.length}: ${result.failures.slice(0, 3).join('; ')}`,
        );
      }
      return { name, ...result };
    });

    const state = checks.every((c) => c.passed) ? 'passed' : 'failed';
    this.logger.log(`QualityReport: state=${state} checks=${checks.length}`);

    return { state, checks };
  }
}
