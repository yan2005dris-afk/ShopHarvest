import { ProductNotFoundError } from './product.errors';

describe('Product domain errors', () => {
  it('ProductNotFoundError carries the id and reads it back', () => {
    const error = new ProductNotFoundError('p_missing');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ProductNotFoundError');
    expect(error.id).toBe('p_missing');
    expect(error.message).toBe('Product with id "p_missing" not found');
  });
});
