import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe, Logger } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Importante para webhooks do Stripe
  })

  const port = process.env.PORT || 3000
  const nodeEnv = process.env.NODE_ENV || 'development'

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: nodeEnv === 'production',
    })
  )

  // Global prefix
  app.setGlobalPrefix('api/v1')

  await app.listen(port)

  const logger = new Logger('Bootstrap')
  logger.log(`🚀 Application is running on: http://localhost:${port}`)
  logger.log(`📊 Environment: ${nodeEnv}`)
}
void bootstrap()
