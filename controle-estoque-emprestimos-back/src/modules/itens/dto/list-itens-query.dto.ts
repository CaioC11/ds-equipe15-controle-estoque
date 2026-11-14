import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationQuerySchema } from '../../../common/pagination/pagination-query.dto';

export const ListItensQuerySchema = PaginationQuerySchema.extend({
  pendente: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export class ListItensQueryDto extends createZodDto(ListItensQuerySchema) {
  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }
}