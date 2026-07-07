import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

/**
 * Validation contract for `POST /api/auth/login`.
 *
 * Spec coverage (R3-2 from the 4R review):
 *   - valid email + password passes
 *   - missing email / missing password fail on the right property
 *   - empty email ('') fails
 *   - empty password ('') fails (@IsNotEmpty rejects empty string)
 *   - email > 254 chars fails (boundary test)
 *   - **no length cap on password** (design intent: never leak
 *     registration rules on the login surface)
 */
describe('LoginDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(LoginDto, body);
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
    const { messages } = await validateBody({
      email: 'user@example.com',
      password: 'whatever',
    });
    expect(messages).toEqual([]);
  });

  it('accepts a long password (no length cap on login by design)', async () => {
    // Registration has a 128-char cap, but login does not — we never
    // leak the registration rules on the login surface.
    const { messages } = await validateBody({
      email: 'user@example.com',
      password: 'a'.repeat(500),
    });
    expect(messages).toEqual([]);
  });

  it('rejects missing email', async () => {
    const { byProperty } = await validateBody({ password: 'whatever' });
    expect(byProperty['email']).toBeDefined();
  });

  it('rejects missing password', async () => {
    const { byProperty } = await validateBody({ email: 'user@example.com' });
    expect(byProperty['password']).toBeDefined();
  });

  it('rejects empty email string', async () => {
    const { byProperty, messages } = await validateBody({
      email: '',
      password: 'whatever',
    });
    expect(byProperty['email']).toBeDefined();
    expect(messages.length).toBeGreaterThan(0);
  });

  it('rejects empty password string (@IsNotEmpty)', async () => {
    const { byProperty, messages } = await validateBody({
      email: 'user@example.com',
      password: '',
    });
    expect(byProperty['password']).toBeDefined();
    expect(messages.some((m) => /not.*empty|empty/i.test(m))).toBe(true);
  });

  it('rejects email longer than 254 characters (boundary)', async () => {
    const longLocal = 'a'.repeat(250);
    const email = `${longLocal}@x.com`; // > 254 chars total
    const { byProperty, messages } = await validateBody({
      email,
      password: 'whatever',
    });
    expect(messages.some((m) => /254|longer than|maximum/i.test(m))).toBe(true);
    expect(byProperty['email']).toBeDefined();
  });

  it('rejects invalid email format', async () => {
    const { byProperty } = await validateBody({
      email: 'not-an-email',
      password: 'whatever',
    });
    expect(byProperty['email']).toBeDefined();
  });
});
