import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './common/auth/auth.module';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import keycloakConfig from './config/keycloak.config';
import swaggerConfig from './config/swagger.config';
import { PrismaModule } from './database/prisma.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { EstoquesModule } from './modules/estoques/estoques.module';
import { HealthModule } from './modules/health/health.module';
import { ItensModule } from './modules/itens/itens.module';
import { MovimentacoesModule } from './modules/movimentacoes/movimentacoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, keycloakConfig, swaggerConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CategoriasModule,
    EstoquesModule,
    ItensModule,
    MovimentacoesModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}