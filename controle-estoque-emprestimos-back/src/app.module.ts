import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import keycloakConfig from './config/keycloak.config';
import swaggerConfig from './config/swagger.config';

import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './common/auth/auth.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { EstoquesModule } from './modules/estoques/estoques.module';
import { ZodValidationPipe } from 'nestjs-zod';

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
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}