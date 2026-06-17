import { Module } from '@nestjs/common';
import { FetchPageController } from './fetch-page.controller';
import { FetchPageService } from './fetch-page.service';

@Module({
  controllers: [FetchPageController],
  providers: [FetchPageService],
  exports: [FetchPageService],
})
export class FetchPageModule {}
