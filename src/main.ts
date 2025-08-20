import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configuração de validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não decoradas
      forbidNonWhitelisted: true, // Rejeita requisições com propriedades não permitidas
      transform: true, // Transforma automaticamente tipos
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
