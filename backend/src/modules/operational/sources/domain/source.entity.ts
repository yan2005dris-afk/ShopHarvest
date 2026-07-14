import { InvalidSourceStatusTransitionError } from './source.errors';

export type SourceStatus = 'inactive' | 'active' | 'error';

const VALID_TRANSITIONS: Record<SourceStatus, SourceStatus[]> = {
  inactive: ['active'],
  active: ['error'],
  error: ['inactive'],
};

export interface SourceProps {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
  status: SourceStatus;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSourceInput {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
  config?: Record<string, unknown> | null;
}

export interface UpdateSourceInput {
  name?: string;
  baseUrl?: string;
  status?: SourceStatus;
  config?: Record<string, unknown> | null;
}

/**
 * Pure domain entity for a scraping source.
 * Knows nothing about NestJS, Prisma, or HTTP.
 * Encapsulates the status-transition rule: inactive → active → error → inactive.
 */
export class Source {
  private constructor(private readonly props: SourceProps) {}

  static create(input: CreateSourceInput, now: Date = new Date()): Source {
    return new Source({
      id: input.id,
      code: input.code,
      name: input.name,
      baseUrl: input.baseUrl,
      status: 'inactive',
      config: input.config ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: SourceProps): Source {
    return new Source(props);
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get baseUrl(): string {
    return this.props.baseUrl;
  }
  get status(): SourceStatus {
    return this.props.status;
  }
  get config(): Record<string, unknown> | null {
    return this.props.config;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  transitionStatus(target: SourceStatus, now: Date = new Date()): void {
    if (this.props.status === target) {
      return;
    }
    const allowed = VALID_TRANSITIONS[this.props.status];
    if (!allowed.includes(target)) {
      throw new InvalidSourceStatusTransitionError(this.props.status, target);
    }
    this.props.status = target;
    this.props.updatedAt = now;
  }

  update(input: UpdateSourceInput, now: Date = new Date()): void {
    if (input.name !== undefined) {
      this.props.name = input.name;
    }
    if (input.baseUrl !== undefined) {
      this.props.baseUrl = input.baseUrl;
    }
    if (input.config !== undefined) {
      this.props.config = input.config;
    }
    if (input.status !== undefined && input.status !== this.props.status) {
      this.transitionStatus(input.status, now);
      return;
    }
    this.props.updatedAt = now;
  }

  toJSON(): SourceProps {
    return { ...this.props };
  }
}
