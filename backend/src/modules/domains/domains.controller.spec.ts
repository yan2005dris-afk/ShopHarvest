import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { FieldMappingDto } from './dto/field-mapping.dto';

/**
 * Verifies the wire-level behavior of POST /domains:
 * - Valid payloads reach the service.
 * - Missing `fieldMappings` is rejected (class-validator).
 * - FieldMappings entries with missing/invalid fields are rejected.
 *
 * We validate DTOs directly with class-validator rather than running the
 * full ValidationPipe, because ValidationPipe needs the controller route
 * metadata to pick the right metatype. The DTO itself is what we care
 * about here.
 */
describe('DomainsController', () => {
  let controller: DomainsController;
  let service: jest.Mocked<DomainsService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DomainsController],
      providers: [
        {
          provide: DomainsService,
          useValue: {
            create: jest.fn((dto: CreateDomainDto) =>
              Promise.resolve({ id: 'rule_x', ...dto }),
            ),
            update: jest.fn((id: string, dto: Partial<CreateDomainDto>) =>
              Promise.resolve({ id, ...dto }),
            ),
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DomainsController);
    service = moduleRef.get(DomainsService);
  });

  async function validateCreateDto(body: unknown): Promise<string[]> {
    const dto = plainToInstance(CreateDomainDto, body);
    const topErrors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    // Explicit nested validation: `@ValidateNested` recursion depends on
    // class-transformer emitting real class instances, which it does via
    // `@Type`, but only when the DTO itself was instantiated. Calling
    // `plainToInstance` on the array alone returns plain objects. Walk the
    // array and validate each entry against FieldMappingDto directly.
    const rawNested = (dto as unknown as { fieldMappings?: unknown[] })
      .fieldMappings;
    const nestedInstances = Array.isArray(rawNested)
      ? rawNested.map((m: unknown) => plainToInstance(FieldMappingDto, m))
      : [];

    const nestedErrors = (
      await Promise.all(
        nestedInstances.map((i: object) =>
          validate(i, { whitelist: true, forbidNonWhitelisted: true }),
        ),
      )
    ).flat();

    return [
      ...topErrors.flatMap((e) => Object.values(e.constraints ?? {})),
      ...nestedErrors.flatMap((e) => Object.values(e.constraints ?? {})),
    ];
  }

  it('creates a DomainRule when payload is valid', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });

    expect(errors).toEqual([]);
    await controller.create({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });
    expect(service.create).toHaveBeenCalled();
  });

  it('rejects payload with missing fieldMappings', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects payload with empty fieldMappings array', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects fieldMappings entries missing required fields', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [{ canonicalField: 'title' }],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects fieldMappings entries with invalid type', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'json' },
      ],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects malformed domain strings', async () => {
    const errors = await validateCreateDto({
      domain: 'not a hostname with spaces',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects whitespace-only canonicalField', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [{ canonicalField: '   ', selector: '.t', type: 'text' }],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects whitespace-only selector', async () => {
    const errors = await validateCreateDto({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '   ', type: 'text' },
      ],
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('lowercases the domain field on the create DTO (mixed-case input)', async () => {
    const dto = plainToInstance(CreateDomainDto, {
      domain: 'Temu.COM',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });
    expect((dto as unknown as { domain: string }).domain).toBe('temu.com');
  });

  it('lowercases the domain field on the update DTO (mixed-case input)', async () => {
    const dto = plainToInstance(UpdateDomainDto, { domain: 'Temu.COM' });
    expect((dto as unknown as { domain: string }).domain).toBe('temu.com');
  });
});
