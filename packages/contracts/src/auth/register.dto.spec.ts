import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

/**
 * Validation contract for `POST /api/auth/register`. The runtime
 * ValidationPipe is configured globally (see backend main.ts); we
 * replicate its options here and assert the DTO behavior directly.
 *
 * Spec coverage (R3-1 from the 4R review):
 *   - valid email + password (8..128 chars) passes
 *   - missing email / missing password fail on the right property
 *   - password < 8 chars / > 128 chars fail
 *   - email > 254 chars fails (RFC 5321 cap)
 *   - invalid email format fails on IsEmail
 */
describe('RegisterDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(RegisterDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const byProperty: Record<string, string[]> = {};
    for (const e of errors) {
      const property = e.property;
      if (!byProperty[property]) byProperty[property] = [];
      byProperty[property].push(...Object.values(e.constraints ?? {}));
    }
    return {
      messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
      byProperty,
    };
  }

  it('accepts a valid email and password', async () => {
    const { messages, byProperty } = await validateBody({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(messages).toEqual([]);
    expect(byProperty).toEqual({});
  });

  it('rejects missing email', async () => {
    const { byProperty } = await validateBody({ password: 'password123' });
    expect(byProperty['email']).toBeDefined();
    expect(byProperty['email'].length).toBeGreaterThan(0);
  });

  it('rejects missing password', async () => {
    const { byProperty } = await validateBody({ email: 'user@example.com' });
    expect(byProperty['password']).toBeDefined();
    expect(byProperty['password'].length).toBeGreaterThan(0);
  });

  it('rejects password shorter than 8 characters (MinLength)', async () => {
    const { byProperty, messages } = await validateBody({
      email: 'user@example.com',
      password: 'short',
    });
    expect(messages.some((m) => /at least 8/i.test(m))).toBe(true);
    expect(byProperty['password']).toBeDefined();
  });

  it('rejects password longer than 128 characters (MaxLength)', async () => {
    const { byProperty, messages } = await validateBody({
      email: 'user@example.com',
      password: 'a'.repeat(129),
    });
    expect(messages.some((m) => /128|longer than|maximum/i.test(m))).toBe(true);
    expect(byProperty['password']).toBeDefined();
  });

  it('accepts password at the boundary (exactly 8 chars)', async () => {
    const { messages } = await validateBody({
      email: 'user@example.com',
      password: 'a'.repeat(8),
    });
    expect(messages).toEqual([]);
  });

  it('accepts password at the boundary (exactly 128 chars)', async () => {
    const { messages } = await validateBody({
      email: 'user@example.com',
      password: 'a'.repeat(128),
    });
    expect(messages).toEqual([]);
  });

  it('rejects email longer than 254 characters (MaxLength)', async () => {
    const longLocal = 'a'.repeat(250);
    const email = `${longLocal}@x.com`; // > 254 chars total
    const { byProperty, messages } = await validateBody({
      email,
      password: 'password123',
    });
    expect(messages.some((m) => /254|longer than|maximum/i.test(m))).toBe(true);
    expect(byProperty['email']).toBeDefined();
  });

  it('rejects invalid email format (IsEmail)', async () => {
    const { byProperty, messages } = await validateBody({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(messages.some((m) => /email/i.test(m))).toBe(true);
    expect(byProperty['email']).toBeDefined();
  });

  it('rejects empty strings for both fields', async () => {
    const { byProperty } = await validateBody({ email: '', password: '' });
    expect(byProperty['email']).toBeDefined();
    expect(byProperty['password']).toBeDefined();
  });
});
