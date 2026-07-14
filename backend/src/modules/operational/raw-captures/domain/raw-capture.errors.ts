export class RawCaptureSourceNotFoundError extends Error {
  constructor(public readonly sourceId: string) {
    super(`Source with id ${sourceId} not found`);
    this.name = 'RawCaptureSourceNotFoundError';
  }
}

export class RawCaptureOfferNotFoundError extends Error {
  constructor(public readonly offerId: string) {
    super(`Offer with id ${offerId} not found`);
    this.name = 'RawCaptureOfferNotFoundError';
  }
}

export class RawCaptureNotFoundError extends Error {
  constructor(
    public readonly offerId: string,
    public readonly sourceId: string,
  ) {
    super(
      `RawCapture with offerId ${offerId} and sourceId ${sourceId} not found`,
    );
    this.name = 'RawCaptureNotFoundError';
  }
}
