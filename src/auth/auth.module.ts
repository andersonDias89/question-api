import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UserModule } from 'src/user/user.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { JwtModule } from '@nestjs/jwt'
import { jwtConfig } from 'src/config/jwt.config'
import { PassportModule } from '@nestjs/passport'
import { LocalStrategy } from './strategies/local.strategy'
import { JwtStrategy } from './strategies/jwt.strategy'
import { SubscriptionGuard } from './guards/subscription.guard'

@Module({
  providers: [AuthService, LocalStrategy, JwtStrategy, SubscriptionGuard],
  controllers: [AuthController],
  exports: [AuthService, SubscriptionGuard],
  imports: [
    UserModule,
    PrismaModule,
    PassportModule,
    JwtModule.register(jwtConfig),
  ],
})
export class AuthModule {}
