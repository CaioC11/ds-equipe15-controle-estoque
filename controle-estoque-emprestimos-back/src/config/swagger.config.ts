import { registerAs } from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE ?? 'Controle de Estoque API',
  description: process.env.SWAGGER_DESCRIPTION ?? 'API para gerenciamento de estoque e empréstimos',
  version: process.env.SWAGGER_VERSION ?? '1.0.0',
  path: process.env.SWAGGER_PATH ?? 'api/docs',
}));
