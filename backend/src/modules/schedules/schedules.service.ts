import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScheduleDto) {
    const domainRule = await this.prisma.domainRule.findUnique({
      where: { id: dto.domainRuleId },
    });
    if (!domainRule) {
      throw new NotFoundException(`DomainRule with id ${dto.domainRuleId} not found`);
    }

    return this.prisma.scrapingSchedule.create({
      data: {
        domainRuleId: dto.domainRuleId,
        cronExpression: dto.cronExpression,
        enabled: dto.enabled ?? true,
      },
      include: { domainRule: true },
    });
  }

  async findAll() {
    return this.prisma.scrapingSchedule.findMany({
      include: { domainRule: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const schedule = await this.prisma.scrapingSchedule.findUnique({
      where: { id },
      include: { domainRule: true },
    });
    if (!schedule) {
      throw new NotFoundException(`ScrapingSchedule with id ${id} not found`);
    }
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const existing = await this.prisma.scrapingSchedule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`ScrapingSchedule with id ${id} not found`);
    }

    return this.prisma.scrapingSchedule.update({
      where: { id },
      data: {
        ...(dto.domainRuleId !== undefined && { domainRuleId: dto.domainRuleId }),
        ...(dto.cronExpression !== undefined && { cronExpression: dto.cronExpression }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
      include: { domainRule: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.scrapingSchedule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`ScrapingSchedule with id ${id} not found`);
    }

    return this.prisma.scrapingSchedule.delete({
      where: { id },
    });
  }
}
