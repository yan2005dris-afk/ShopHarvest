export class BrandNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Brand with id "${id}" not found`);
    this.name = 'BrandNotFoundError';
  }
}

export class DuplicateBrandNameError extends Error {
  constructor(public readonly name: string) {
    super(`Brand with name "${name}" already exists`);
    this.name = 'DuplicateBrandNameError';
  }
}
