import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from './auth/guards/subscription.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  // Endpoint que requer autenticação + assinatura ativa
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Get('premium-feature')
  getPremiumFeature(): { message: string; feature: string } {
    return {
      message: 'You have access to this premium feature!',
      feature:
        'This is an example of a feature that only users with an active subscription can access.',
    };
  }
}
