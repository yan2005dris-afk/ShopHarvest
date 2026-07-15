import { Module } from '@nestjs/common';
import { CreateDomainUseCase } from './application/create-domain.use-case';
import { DeleteDomainUseCase } from './application/delete-domain.use-case';
import { FindDomainUseCase } from './application/find-domain.use-case';
import { ListDomainsUseCase } from './application/list-domains.use-case';
import { UpdateDomainUseCase } from './application/update-domain.use-case';
import { DOMAINS_REPOSITORY } from './domain/domains.repository';
import { DomainsHttpController } from './infrastructure/http/domains-http.controller';
import { PrismaDomainsRepository } from './infrastructure/persistence/prisma-domains.repository';

@Module({
  controllers: [DomainsHttpController],
  providers: [
    PrismaDomainsRepository,
    { provide: DOMAINS_REPOSITORY, useExisting: PrismaDomainsRepository },
    ListDomainsUseCase,
    FindDomainUseCase,
    CreateDomainUseCase,
    UpdateDomainUseCase,
    DeleteDomainUseCase,
  ],
  exports: [
    DOMAINS_REPOSITORY,
    ListDomainsUseCase,
    FindDomainUseCase,
    CreateDomainUseCase,
    UpdateDomainUseCase,
    DeleteDomainUseCase,
  ],
})
export class DomainsModule {}
