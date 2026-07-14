export class SourceNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Source with id "${id}" not found`);
    this.name = 'SourceNotFoundError';
  }
}

export class DuplicateSourceCodeError extends Error {
  constructor(public readonly code: string) {
    super(`Source with code "${code}" already exists`);
    this.name = 'DuplicateSourceCodeError';
  }
}

export class InvalidSourceStatusTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(
      `Invalid status transition from "${from}" to "${to}". ` +
        `Allowed transitions: inactive→active, active→error, error→inactive.`,
    );
    this.name = 'InvalidSourceStatusTransitionError';
  }
}
