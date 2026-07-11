import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestRawCaptureDto } from '../ingest-raw-capture.dto';

describe('IngestRawCaptureDto', () => {
  async function validateBody(body: unknown): Promise<{
    messages: string[];
    byProperty: Record<string, string[]>;
  }> {
    const dto = plainToInstance(IngestRawCaptureDto, body);
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

  const basePayload = () => ({
    offerId: 'offer-uuid',
    sourceId: 'source-uuid',
    payload: { title: 'Test Product', price: 19.99 },
  });

  it('accepts a valid ingest payload', async () => {
    const { messages } = await validateBody(basePayload());
    expect(messages).toEqual([]);
  });

  it('rejects missing offerId', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      offerId: undefined,
    });
    expect(byProperty['offerId']).toBeDefined();
  });

  it('rejects empty offerId', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      offerId: '',
    });
    expect(byProperty['offerId']).toBeDefined();
  });

  it('rejects missing sourceId', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      sourceId: undefined,
    });
    expect(byProperty['sourceId']).toBeDefined();
  });

  it('rejects missing payload', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      payload: undefined,
    });
    expect(byProperty['payload']).toBeDefined();
  });

  it('rejects null payload', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      payload: null,
    });
    expect(byProperty['payload']).toBeDefined();
  });

  it('rejects non-object payload', async () => {
    const { byProperty } = await validateBody({
      ...basePayload(),
      payload: 'not-an-object',
    });
    expect(byProperty['payload']).toBeDefined();
  });
});
