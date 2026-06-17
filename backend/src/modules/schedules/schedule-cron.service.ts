import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScrapingJobsService } from '../scraping-jobs/scraping-jobs.service';

/**
 * Minimal cron parser — validates expressions and checks if a cron expression
 * matches the current minute.
 *
 * Supports standard 5-field cron expressions (minute hour day month weekday).
 */
function cronMatches(expression: string, now: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false; // invalid or unsupported (e.g., 6-field with seconds)
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

  return (
    fieldMatches(minute, utc.getUTCMinutes()) &&
    fieldMatches(hour, utc.getUTCHours()) &&
    fieldMatches(dayOfMonth, utc.getUTCDate()) &&
    fieldMatches(month, utc.getUTCMonth() + 1) &&
    fieldMatches(dayOfWeek, utc.getUTCDay())
  );
}

function fieldMatches(pattern: string, value: number): boolean {
  // Handle */N (every N)
  if (pattern.startsWith('*/')) {
    const interval = parseInt(pattern.slice(2), 10);
    if (isNaN(interval) || interval === 0) return false;
    return value % interval === 0;
  }

  // Handle comma-separated list
  if (pattern.includes(',')) {
    return pattern.split(',').some((p) => fieldMatches(p.trim(), value));
  }

  // Handle range (e.g., 1-5)
  if (pattern.includes('-')) {
    const [rawStart, rawEnd] = pattern.split('-');
    const start = parseInt(rawStart, 10);
    const end = parseInt(rawEnd, 10);
    if (isNaN(start) || isNaN(end)) return false;
    return value >= start && value <= end;
  }

  // Handle exact value or *
  if (pattern === '*') return true;

  const num = parseInt(pattern, 10);
  return !isNaN(num) && num === value;
}

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapingJobsService: ScrapingJobsService,
  ) {}

  onModuleInit() {
    this.logger.log('ScheduleCronService initialized — checking schedules every 60s');

    // Check immediately on startup
    this.checkSchedules();

    // Then every 60 seconds
    this.intervalId = setInterval(() => {
      this.checkSchedules();
    }, 60_000);
  }

  private async checkSchedules() {
    try {
      const activeSchedules = await this.prisma.scrapingSchedule.findMany({
        where: { enabled: true },
        include: { domainRule: true },
      });

      if (activeSchedules.length === 0) return;

      const now = new Date();

      for (const schedule of activeSchedules) {
        try {
          if (!cronMatches(schedule.cronExpression, now)) continue;

          this.logger.log(
            `Schedule ${schedule.id} matches cron "${schedule.cronExpression}" — enqueuing job`,
          );

          // Enqueue job for the domain's sample URL
          const url = schedule.domainRule.sampleUrl || undefined;
          await this.scrapingJobsService.enqueueJob(schedule.domainRuleId, url);

          // Update lastRunAt
          await this.prisma.scrapingSchedule.update({
            where: { id: schedule.id },
            data: { lastRunAt: now },
          });

          this.logger.log(
            `Schedule ${schedule.id} enqueued job for domain rule ${schedule.domainRuleId}`,
          );
        } catch (err) {
          this.logger.warn(
            `Schedule ${schedule.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Error checking schedules: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
