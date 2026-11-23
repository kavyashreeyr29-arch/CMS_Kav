import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    // Neon URLs normally already include sslmode=require. Add it for any
    // remote production URL so Prisma always negotiates TLS with Neon.
    const requiresSsl = process.env.NODE_ENV === 'production' || /\.neon\.tech(?:[/:?]|$)/.test(databaseUrl ?? '');
    const url = databaseUrl && requiresSsl && !databaseUrl.includes('sslmode=')
      ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`
      : databaseUrl;
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
