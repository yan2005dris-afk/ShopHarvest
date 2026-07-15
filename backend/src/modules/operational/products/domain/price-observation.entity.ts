/**
 * Pure domain entity for a PriceObservation.
 *
 * One Offer → many PriceObservation rows; each row is an immutable
 * snapshot of price at `observedAt`. The ingest pipeline writes one
 * observation per ingested item; future history queries span across
 * offers (each entry still carries its own `offerId`).
 */
export interface PriceObservationProps {
  id: string;
  offerId: string;
  price: number;
  currency: string;
  observedAt: Date;
  createdAt: Date;
}

export interface CreatePriceObservationInput {
  id: string;
  offerId: string;
  price: number;
  currency: string;
  /**
   * Optional override; defaults to `now`.
   */
  observedAt?: Date;
  createdAt?: Date;
}

export class PriceObservation {
  private constructor(private readonly props: PriceObservationProps) {}

  static create(
    input: CreatePriceObservationInput,
    now: Date = new Date(),
  ): PriceObservation {
    return new PriceObservation({
      id: input.id,
      offerId: input.offerId,
      price: input.price,
      currency: input.currency,
      observedAt: input.observedAt ?? now,
      createdAt: input.createdAt ?? now,
    });
  }

  static fromPersistence(props: PriceObservationProps): PriceObservation {
    return new PriceObservation(props);
  }

  get id(): string {
    return this.props.id;
  }
  get offerId(): string {
    return this.props.offerId;
  }
  get price(): number {
    return this.props.price;
  }
  get currency(): string {
    return this.props.currency;
  }
  get observedAt(): Date {
    return this.props.observedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): PriceObservationProps {
    return { ...this.props };
  }
}
