import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEstoqueDto {
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome do estoque é obrigatório.' })
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  localizacao?: string;

  @IsString()
  @IsOptional()
  gestorId?: string;
}