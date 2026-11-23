import { AIFeature, AIProviderType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateProviderDto {
  @IsEnum(AIProviderType)
  providerType: AIProviderType;

  @IsString()
  displayName: string;

  @IsUrl({ require_tld: false })
  baseUrl: string;

  @IsString()
  apiKey: string; // write-only; encrypted before storage, never returned

  @IsString()
  defaultModel: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(AIFeature, { each: true })
  enabledFeatures?: AIFeature[];
}
