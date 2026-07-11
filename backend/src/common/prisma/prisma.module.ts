import { Global, Module } from '@nestjs/common';
import { OperationalPrismaService } from './operational-prisma.service';
import { AnalyticsPrismaService } from './analytics-prisma.service';

@Global()
@Module({
  providers: [OperationalPrismaService, AnalyticsPrismaService],
  exports: [OperationalPrismaService, AnalyticsPrismaService],
})
export class PrismaModule {}
