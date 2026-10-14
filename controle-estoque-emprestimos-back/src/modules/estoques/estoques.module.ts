import { Module } from '@nestjs/common';
import { EstoquesController } from './estoques.controller';
import { EstoquesService } from './estoques.service';

@Module({
  controllers: [EstoquesController],
  providers: [EstoquesService],
  exports: [EstoquesService],
})
export class EstoquesModule {}