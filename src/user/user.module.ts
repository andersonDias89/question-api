import { Module } from '@nestjs/common'
import { UserService } from './user.service'
import { UserController } from './user.controller'
import { PrismaModule } from 'src/prisma/prisma.module'
import { AdminGuard } from '../auth/guards/admin.guard'

@Module({
  providers: [UserService, AdminGuard],
  controllers: [UserController],
  imports: [PrismaModule],
})
export class UserModule {}
