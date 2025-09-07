import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { UserRole } from '../../common/enums/user-role.enum'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user || !user.userId) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado')
    }

    // Buscar o usuário no banco para verificar seu role
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    })

    if (!userFromDb || userFromDb.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Access denied: only administrators can access this resource'
      )
    }

    return true
  }
}
