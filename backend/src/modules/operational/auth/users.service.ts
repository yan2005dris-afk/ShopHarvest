import { Injectable } from '@nestjs/common';
import { OperationalPrismaService } from '../../../common/prisma/operational-prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: OperationalPrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(email: string, passwordHash: string) {
    return this.prisma.user.create({ data: { email, passwordHash } });
  }
}
