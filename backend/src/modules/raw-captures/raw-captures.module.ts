import { Module } from '@nestjs/common';
import { RawCapturesController } from './raw-captures.controller';
import { RawCapturesService } from './raw-captures.service';

@Module({
  controllers: [RawCapturesController],
  providers: [RawCapturesService],
  exports: [RawCapturesService],
})
export class RawCapturesModule {}
