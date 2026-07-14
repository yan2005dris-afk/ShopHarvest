export interface BrandProps {
  id: string;
  name: string;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBrandInput {
  id: string;
  name: string;
  aliases?: string[];
}

export interface UpdateBrandInput {
  name?: string;
  aliases?: string[];
}

/**
 * Pure domain entity for a brand.
 * Knows nothing about NestJS, Prisma, or HTTP.
 * Brand has no status transitions; it is a flat reference entity with a
 * unique name and an optional list of aliases.
 */
export class Brand {
  private constructor(private readonly props: BrandProps) {}

  static create(input: CreateBrandInput, now: Date = new Date()): Brand {
    return new Brand({
      id: input.id,
      name: input.name,
      aliases: input.aliases ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: BrandProps): Brand {
    return new Brand(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get aliases(): string[] {
    return this.props.aliases;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(input: UpdateBrandInput, now: Date = new Date()): void {
    let mutated = false;
    if (input.name !== undefined && input.name !== this.props.name) {
      this.props.name = input.name;
      mutated = true;
    }
    if (input.aliases !== undefined) {
      this.props.aliases = input.aliases;
      mutated = true;
    }
    if (!mutated) {
      return;
    }
    this.props.updatedAt = now;
  }

  toJSON(): BrandProps {
    return { ...this.props, aliases: [...this.props.aliases] };
  }
}
