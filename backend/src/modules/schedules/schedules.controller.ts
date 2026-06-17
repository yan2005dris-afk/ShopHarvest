import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  async create(@Body() body: CreateScheduleDto) {
    return this.schedulesService.create(body);
  }

  @Get()
  async findAll() {
    return this.schedulesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }
}
