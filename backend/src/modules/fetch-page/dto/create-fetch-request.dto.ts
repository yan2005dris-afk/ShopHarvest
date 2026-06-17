import { IsUrl, MaxLength, IsOptional, IsString } from 'class-validator';

export class CreateFetchRequestDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  cookies?: string;
}
