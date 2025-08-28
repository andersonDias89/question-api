import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Verificar se o usuário tem uma assinatura ativa
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: user.userId }
    });

    if (!subscription) {
      throw new ForbiddenException('Subscription required to access this resource');
    }

    if (subscription.status !== 'active') {
      throw new ForbiddenException('Subscription is not active. Current status: ' + subscription.status);
    }

    // Verificar se a assinatura não expirou
    if (subscription.currentPeriodEnd < new Date()) {
      throw new ForbiddenException('Subscription expired');
    }

    return true;
  }
}
