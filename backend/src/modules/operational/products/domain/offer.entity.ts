/**
 * Pure domain entity for an Offer (product-at-a-site listing).
 *
 * Per `product-offer-split`, price/url/sku/rawData moved off the flat
 * Product onto Offer. The Offer is the unit of dedup (keyed by
 * `(sourceId, url)`) and the unit of price observability (one Offer →
 * many PriceObservation rows).
 *
 * `rawData` carries the original extension payload. It is intentionally
 * exposed as a `Record<string, unknown>` — the entity doesn't know the
 * shape, and the JSON column round-trips byte-for-byte.
 */
export interface OfferProps {
  id: string;
  productId: string;
  sourceId: string;
  domainRuleId: string | null;
  url: string;
  externalId: string | null;
  sku: string | null;
  currency: string;
  price: number;
  rawData: Record<string, unknown> | null;
  extractedAt: Date;
}

export interface CreateOfferInput {
  id: string;
  productId: string;
  sourceId: string;
  domainRuleId: string | null;
  url: string;
  externalId?: string | null;
  sku?: string | null;
  currency: string;
  price: number;
  rawData?: Record<string, unknown> | null;
  /**
   * Optional override; defaults to `new Date()` so callers can stamp
   * historically-restored observations.
   */
  extractedAt?: Date;
}

export interface UpdateOfferInput {
  price?: number;
  currency?: string;
  sku?: string | null;
  rawData?: Record<string, unknown> | null;
  /**
   * Stamped on every refresh so the legacy "extractedAt = now" behaviour
   * is preserved.
   */
  extractedAt?: Date;
}

export class Offer {
  private constructor(private readonly props: OfferProps) {}

  static create(input: CreateOfferInput, now: Date = new Date()): Offer {
    return new Offer({
      id: input.id,
      productId: input.productId,
      sourceId: input.sourceId,
      domainRuleId: input.domainRuleId,
      url: input.url,
      externalId: input.externalId ?? null,
      sku: input.sku ?? null,
      currency: input.currency,
      price: input.price,
      rawData: input.rawData ?? null,
      extractedAt: input.extractedAt ?? now,
    });
  }

  static fromPersistence(props: OfferProps): Offer {
    return new Offer(props);
  }

  get id(): string {
    return this.props.id;
  }
  get productId(): string {
    return this.props.productId;
  }
  get sourceId(): string {
    return this.props.sourceId;
  }
  get domainRuleId(): string | null {
    return this.props.domainRuleId;
  }
  get url(): string {
    return this.props.url;
  }
  get externalId(): string | null {
    return this.props.externalId;
  }
  get sku(): string | null {
    return this.props.sku;
  }
  get currency(): string {
    return this.props.currency;
  }
  get price(): number {
    return this.props.price;
  }
  get rawData(): Record<string, unknown> | null {
    return this.props.rawData;
  }
  get extractedAt(): Date {
    return this.props.extractedAt;
  }

  /**
   * Re-ingest path (same `(sourceId, url)` collides on a new extension
   * scrape): update price/sku/rawData and refresh `extractedAt`. The
   * parent Product fields ride along on a separate update call.
   */
  refresh(input: UpdateOfferInput, now: Date = new Date()): void {
    if (input.price !== undefined && input.price !== this.props.price) {
      this.props.price = input.price;
    }
    if (input.currency !== undefined && input.currency !== this.props.currency) {
      this.props.currency = input.currency;
    }
    if (input.sku !== undefined) {
      this.props.sku = input.sku;
    }
    if (input.rawData !== undefined) {
      this.props.rawData = input.rawData;
    }
    this.props.extractedAt = input.extractedAt ?? now;
  }

  toJSON(): OfferProps {
    return {
      ...this.props,
      rawData: this.props.rawData ? { ...this.props.rawData } : null,
    };
  }
}
