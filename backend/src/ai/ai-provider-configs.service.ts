import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { encryptApiKey } from './crypto.util';

@Injectable()
export class AiProviderConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Never selects api_key_encrypted — write-only field (LLD §8).
  findAll(orgId: string) {
    return this.prisma.aiProviderConfig.findMany({
      where: { orgId },
      select: {
        id: true, orgId: true, providerType: true, displayName: true, baseUrl: true,
        defaultModel: true, isDefault: true, enabledFeatures: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async create(orgId: string, dto: CreateProviderDto) {
    const apiKeyEncrypted = encryptApiKey(dto.apiKey, this.encryptionSecret());

    if (dto.isDefault) {
      await this.prisma.aiProviderConfig.updateMany({ where: { orgId }, data: { isDefault: false } });
    }

    const created = await this.prisma.aiProviderConfig.create({
      data: {
        orgId,
        providerType: dto.providerType,
        displayName: dto.displayName,
        baseUrl: dto.baseUrl,
        apiKeyEncrypted,
        defaultModel: dto.defaultModel,
        isDefault: dto.isDefault ?? false,
        enabledFeatures: dto.enabledFeatures ?? [],
      },
    });
    const { apiKeyEncrypted: _omit, ...safe } = created;
    return safe;
  }

  async update(id: string, dto: UpdateProviderDto) {
    const existing = await this.prisma.aiProviderConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('AI provider not found');

    if (dto.isDefault) {
      await this.prisma.aiProviderConfig.updateMany({
        where: { orgId: existing.orgId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.aiProviderConfig.update({
      where: { id },
      data: {
        ...(dto.providerType && { providerType: dto.providerType }),
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.baseUrl && { baseUrl: dto.baseUrl }),
        ...(dto.defaultModel && { defaultModel: dto.defaultModel }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.enabledFeatures && { enabledFeatures: dto.enabledFeatures }),
        ...(dto.apiKey && { apiKeyEncrypted: encryptApiKey(dto.apiKey, this.encryptionSecret()) }),
      },
    });
    const { apiKeyEncrypted: _omit, ...safe } = updated;
    return safe;
  }

  async remove(id: string) {
    const existing = await this.prisma.aiProviderConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('AI provider not found');
    return this.prisma.aiProviderConfig.delete({ where: { id } });
  }

  usage(orgId: string) {
    return this.prisma.aiUsageLog.groupBy({
      by: ['feature'],
      where: { orgId },
      _count: { _all: true },
      _sum: { tokensEstimate: true, costEstimate: true },
    });
  }

  private encryptionSecret(): string {
    return this.config.get<string>('aiEncryptionKey') ?? 'dev-only-key-change-me';
  }
}
