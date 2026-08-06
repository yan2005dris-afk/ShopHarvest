import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  isIP,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Bare hostname used to build AliExpress category URLs
 * (`https://${region}${categoryPath}`). It must be a plain hostname —
 * no scheme, no path, no userinfo, no port.
 */
const HOSTNAME_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/**
 * Well-known metadata / loopback endpoints that must never be scraped,
 * regardless of how their spelling resolves. IP literals are also
 * rejected (see `validate`), covering the classic cloud-metadata SSRF
 * (`169.254.169.254`, ALIYUN `100.100.100.200`, GCE/AWS aliases).
 */
const DENY_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '169.254.169.254',
  '100.100.100.200',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

@ValidatorConstraint({ name: 'publicHostname', async: false })
class IsPublicHostnameConstraint implements ValidatorConstraintInterface {
  validate(hostname: unknown): boolean {
    if (typeof hostname !== 'string') return false;
    const host = hostname.toLowerCase();

    // Must be a bare hostname shape (no scheme/path/port/userinfo).
    if (!HOSTNAME_REGEX.test(host)) return false;

    // Never allow an IP literal — IPv4 and IPv6 both.
    if (isIP(host)) return false;

    // Block well-known metadata/loopback aliases outright.
    if (DENY_HOSTNAMES.has(host)) return false;

    // Reject obviously internal TLDs / mDNS suffixes.
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;

    // Private-range hostnames that are not IP literals cannot be
    // detected without DNS resolution; the IP-literal ban above covers
    // the common `127.0.0.1` / `10.0.0.5` / `192.168.0.1` cases.
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return (
      `${args.property} must be a public hostname (no scheme, path, port, ` +
      `IP literal, or private/metadata endpoint)`
    );
  }
}

/**
 * Per-source scraper options. Only the keys AliExpress actually reads
 * are declared; `forbidNonWhitelisted` on the global ValidationPipe
 * rejects anything else, so a stray key can't sneak into an adapter.
 */
export class ScrapeExtraDto {
  @ApiPropertyOptional({
    description:
      'Public hostname (no scheme/path/port/IP) used to build AliExpress category URLs',
    example: 'www.aliexpress.com',
  })
  @IsOptional()
  @Validate(IsPublicHostnameConstraint)
  @MaxLength(253)
  region?: string;

  @ApiPropertyOptional({ example: 'es-EC,es;q=0.9,en;q=0.8' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  acceptLanguage?: string;
}

/**
 * Request body for POST /pipeline/scrape/:source. Replaces the old
 * unvalidated inline type so the global ValidationPipe can whitelist
 * and validate `maxItems` and `extra` (upstream SSRF vector).
 */
export class ScrapeOneDto {
  @ApiPropertyOptional({ example: 'aliexpress' })
  @IsString()
  @IsNotEmpty()
  outputDir!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxItems?: number;

  @ApiPropertyOptional({ type: ScrapeExtraDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScrapeExtraDto)
  extra?: ScrapeExtraDto;
}