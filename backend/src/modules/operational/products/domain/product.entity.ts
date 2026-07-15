import type { Offer } from './offer.entity';

/**
 * Pure domain entity for a Product.
 *
 * Knows nothing about NestJS, Prisma, or HTTP. Encapsulates the canonical
 * product aggregate (per `product-offer-split`): canonical fields only —
 * `title`, `description`, `imageUrl`, `categoryId`, `brandId` —
 * with `offers[]` as a child collection. Price/url/sku moved to Offer;
 * this entity never sees them.
 *
 * `categoryId` / `brandId` are unpopulated FK columns (no auto
 * classification in this change). They live on the entity for shape
 * completeness — they may be assigned later by a domain service.
 */
export interface ProductProps {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  brandId: string | null;
  createdAt: Date;
  updatedAt: Date;
  offers: Offer[];
}

export interface CreateProductInput {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
}

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  static create(input: CreateProductInput, now: Date = new Date()): Product {
    return new Product({
      id: input.id,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      createdAt: now,
      updatedAt: now,
      offers: [],
    });
  }

  static fromPersistence(props: ProductProps): Product {
    return new Product(props);
  }

  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string | null {
    return this.props.description;
  }
  get imageUrl(): string | null {
    return this.props.imageUrl;
  }
  get categoryId(): string | null {
    return this.props.categoryId;
  }
  get brandId(): string | null {
    return this.props.brandId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get offers(): Offer[] {
    return this.props.offers;
  }

  /**
   * Applies a partial mutation. `undefined` fields are no-ops; explicit
   * `null` clears the underlying column. Mirrors the legacy PATCH
   * semantics bit-for-bit.
   */
  update(input: UpdateProductInput, now: Date = new Date()): void {
    let mutated = false;

    if (input.title !== undefined && input.title !== this.props.title) {
      this.props.title = input.title;
      mutated = true;
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
      mutated = true;
    }
    if (input.imageUrl !== undefined) {
      this.props.imageUrl = input.imageUrl;
      mutated = true;
    }
    if (input.categoryId !== undefined) {
      this.props.categoryId = input.categoryId;
      mutated = true;
    }
    if (input.brandId !== undefined) {
      this.props.brandId = input.brandId;
      mutated = true;
    }

    if (mutated) {
      this.props.updatedAt = now;
    }
  }

  toJSON(): ProductProps {
    return {
      ...this.props,
      // `offers` is a child collection of Offer entities. The aggregate
      // exposes the same Offer instances — callers that want a
      // snapshot should call `offer.toJSON()` themselves per element.
      offers: [...this.props.offers],
    };
  }
}
