export type RawCaptureStatus = 'UNPROCESSED' | 'PROCESSED' | 'FAILED';

export interface RawCaptureProps {
  offerId: string;
  sourceId: string;
  payload: Record<string, unknown>;
  capturedAt: Date;
  status: RawCaptureStatus;
  attempts: number;
}

export interface CreateRawCaptureInput {
  offerId: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

export class RawCapture {
  private constructor(private readonly props: RawCaptureProps) {}

  static create(
    input: CreateRawCaptureInput,
    now: Date = new Date(),
  ): RawCapture {
    return new RawCapture({
      offerId: input.offerId,
      sourceId: input.sourceId,
      payload: input.payload,
      capturedAt: now,
      status: 'UNPROCESSED',
      attempts: 0,
    });
  }

  static fromPersistence(props: RawCaptureProps): RawCapture {
    return new RawCapture(props);
  }

  get offerId(): string {
    return this.props.offerId;
  }

  get sourceId(): string {
    return this.props.sourceId;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get capturedAt(): Date {
    return this.props.capturedAt;
  }

  get status(): RawCaptureStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  refresh(payload: Record<string, unknown>, now: Date = new Date()): void {
    this.props.payload = payload;
    this.props.capturedAt = now;
    this.props.status = 'UNPROCESSED';
    this.props.attempts = 0;
  }

  toJSON(): RawCaptureProps {
    return { ...this.props, payload: { ...this.props.payload } };
  }
}
