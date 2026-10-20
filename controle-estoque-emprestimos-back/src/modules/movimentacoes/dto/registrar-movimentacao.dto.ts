import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TipoMovimentacao } from '@prisma/client';

export class RegistrarMovimentacaoDto {
  @IsUUID('4', { message: 'O ID do item deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O ID do item é obrigatório' })
  itemId: string;

  @IsEnum(TipoMovimentacao, { message: 'Tipo de movimentação inválido' })
  @IsNotEmpty({ message: 'O tipo de movimentação é obrigatório' })
  tipo: TipoMovimentacao;

  @IsInt({ message: 'A quantidade deve ser um número inteiro' })
  @Min(1, { message: 'A quantidade deve ser de no mínimo 1' })
  quantidade: number;

  @IsString({ message: 'A observação deve ser um texto' })
  @IsOptional()
  observacao?: string;
}