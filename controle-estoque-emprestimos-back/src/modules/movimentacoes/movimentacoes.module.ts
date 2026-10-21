import { Module } from '@nestjs/common';
import { MovimentacoesService } from './movimentacoes.service';
import { MovimentacoesController } from './movimentacoes.controller';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MovimentacoesController],
  providers: [MovimentacoesService],
  exports: [MovimentacoesService],
})
export class MovimentacoesModule {}