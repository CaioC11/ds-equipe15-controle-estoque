import { Module } from '@nestjs/common';
import { EstoquesService } from './estoques.service';
import { EstoquesController } from './estoques.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [EstoquesController],
  providers: [EstoquesService, PrismaService],
})
export class EstoquesModule {}