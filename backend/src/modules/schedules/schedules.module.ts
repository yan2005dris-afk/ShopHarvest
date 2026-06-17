import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ScheduleCronService } from './schedule-cron.service';
import { ScrapingJobsModule } from '../scraping-jobs/scraping-jobs.module';

@Module({
  imports: [ScheduleModule.forRoot(), ScrapingJobsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleCronService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
