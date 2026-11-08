import { Module } from '@nestjs/common';
import { EmprestimosController } from './emprestimos.controller';
import { EmprestimosService } from './emprestimos.service';
import { TermoPdfService } from './termo-pdf.service';
import { TermoStorageService } from './termo-storage.service';

@Module({
  controllers: [EmprestimosController],
  providers: [EmprestimosService, TermoPdfService, TermoStorageService],
  exports: [EmprestimosService],
})
export class EmprestimosModule {}
