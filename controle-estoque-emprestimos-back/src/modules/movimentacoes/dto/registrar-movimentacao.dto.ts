import { TipoMovimentacao } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RegistrarMovimentacaoDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsEnum(TipoMovimentacao)
  tipo: TipoMovimentacao;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}
