import type { FieldMappingDto } from '@web-scraping/contracts/domains';
import type { DomainPaginationType } from '@web-scraping/contracts/domains';

/**
 * Pure domain entity for a DomainRule (per-domain scraping configuration).
 *
 * Knows nothing about NestJS, Prisma, or HTTP. Encapsulates the persisted
 * shape of a scraping rule and exposes mutators that bump `updatedAt`. The
 * category denormalization (`categoryName`) is intentionally NOT a property
 * of this entity — that field is a JOIN projection consumed only by the
 * response mapper, not the aggregate itself.
 *
 * `fieldMappings` reuses the `FieldMappingDto` shape from the shared
 * contracts package so the domain, mapper, and HTTP adapter agree on the
 * wire type. The contracts package is framework-free (no @nestjs/* or
 * @prisma/* imports), so importing the type here is allowed under the
 * hexagonal purity rule.
 */
export type DomainFieldMappings = FieldMappingDto[];

export interface DomainRuleProps {
  id: string;
  domain: string;
  name: string;
  categoryId: string | null;
  fieldMappings: DomainFieldMappings | null;
  containerSelector: string | null;
  productLimit: number | null;
  sampleUrl: string | null;
  /**
   * Persisted pagination strategy. The Prisma schema defaults to `'scroll'`,
   * so brand-new rows come back from persistence with that value; the
   * mapper preserves whatever the DB row carries.
   */
  paginationType: DomainPaginationType;
  paginationSelector: string | null;
  lastScrapedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDomainRuleInput {
  id: string;
  domain: string;
  name: string;
  categoryId?: string | null;
  fieldMappings?: DomainFieldMappings | null;
  containerSelector?: string | null;
  productLimit?: number | null;
  sampleUrl?: string | null;
  paginationSelector?: string | null;
  /**
   * Optional override for the default `'scroll'` pagination strategy.
   * The legacy service let Prisma pick the default — we keep that behavior
   * for callers that do not pass this argument.
   */
  paginationType?: DomainPaginationType;
}

export interface UpdateDomainRuleInput {
  domain?: string;
  name?: string;
  categoryId?: string | null;
  fieldMappings?: DomainFieldMappings | null;
  containerSelector?: string | null;
  productLimit?: number | null;
  sampleUrl?: string | null;
  paginationType?: DomainPaginationType;
  paginationSelector?: string | null;
}

export class DomainRule {
  private constructor(private readonly props: DomainRuleProps) {}

  static create(
    input: CreateDomainRuleInput,
    now: Date = new Date(),
  ): DomainRule {
    return new DomainRule({
      id: input.id,
      domain: input.domain,
      name: input.name,
      categoryId: input.categoryId ?? null,
      fieldMappings: input.fieldMappings ?? null,
      containerSelector: input.containerSelector ?? null,
      productLimit: input.productLimit ?? null,
      sampleUrl: input.sampleUrl ?? null,
      paginationType: input.paginationType ?? 'scroll',
      paginationSelector: input.paginationSelector ?? null,
      lastScrapedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: DomainRuleProps): DomainRule {
    return new DomainRule(props);
  }

  get id(): string {
    return this.props.id;
  }
  get domain(): string {
    return this.props.domain;
  }
  get name(): string {
    return this.props.name;
  }
  get categoryId(): string | null {
    return this.props.categoryId;
  }
  get fieldMappings(): DomainFieldMappings | null {
    return this.props.fieldMappings;
  }
  get containerSelector(): string | null {
    return this.props.containerSelector;
  }
  get productLimit(): number | null {
    return this.props.productLimit;
  }
  get sampleUrl(): string | null {
    return this.props.sampleUrl;
  }
  get paginationType(): DomainPaginationType {
    return this.props.paginationType;
  }
  get paginationSelector(): string | null {
    return this.props.paginationSelector;
  }
  get lastScrapedAt(): Date | null {
    return this.props.lastScrapedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Applies a partial mutation. `undefined` fields are no-ops; explicit
   * `null` clears the underlying column. This mirrors the legacy
   * `...(dto.x !== undefined && { x: dto.x })` pattern so PATCH semantics
   * are preserved bit-for-bit.
   *
   * `lastScrapedAt` is intentionally not settable here — that timestamp
   * is written by the scraping worker, not by HTTP mutations.
   */
  update(input: UpdateDomainRuleInput, now: Date = new Date()): void {
    let mutated = false;

    if (input.domain !== undefined && input.domain !== this.props.domain) {
      this.props.domain = input.domain;
      mutated = true;
    }
    if (input.name !== undefined && input.name !== this.props.name) {
      this.props.name = input.name;
      mutated = true;
    }
    if (input.categoryId !== undefined) {
      this.props.categoryId = input.categoryId;
      mutated = true;
    }
    if (input.fieldMappings !== undefined) {
      this.props.fieldMappings = input.fieldMappings;
      mutated = true;
    }
    if (input.containerSelector !== undefined) {
      this.props.containerSelector = input.containerSelector;
      mutated = true;
    }
    if (input.productLimit !== undefined) {
      this.props.productLimit = input.productLimit;
      mutated = true;
    }
    if (input.sampleUrl !== undefined) {
      this.props.sampleUrl = input.sampleUrl;
      mutated = true;
    }
    if (
      input.paginationType !== undefined &&
      input.paginationType !== this.props.paginationType
    ) {
      this.props.paginationType = input.paginationType;
      mutated = true;
    }
    if (input.paginationSelector !== undefined) {
      this.props.paginationSelector = input.paginationSelector;
      mutated = true;
    }

    if (mutated) {
      this.props.updatedAt = now;
    }
  }

  /**
   * Used by the worker to stamp the last scraping timestamp without
   * touching any user-controlled field.
   */
  markScraped(at: Date = new Date()): void {
    this.props.lastScrapedAt = at;
    this.props.updatedAt = at;
  }

  toJSON(): DomainRuleProps {
    const cloned = this.props.fieldMappings
      ? this.props.fieldMappings.map((m) => ({ ...m }))
      : null;
    return {
      ...this.props,
      fieldMappings: cloned,
    };
  }
}
