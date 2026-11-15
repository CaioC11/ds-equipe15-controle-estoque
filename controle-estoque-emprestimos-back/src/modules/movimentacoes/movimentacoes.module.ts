import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { MovimentacoesController } from './movimentacoes.controller';
import { MovimentacoesService } from './movimentacoes.service';
import { TransferenciasService } from './transferencias.service';

@Module({
  imports: [PrismaModule],
  controllers: [MovimentacoesController],
  providers: [MovimentacoesService, TransferenciasService],
  exports: [MovimentacoesService],
})
export class MovimentacoesModule {}
