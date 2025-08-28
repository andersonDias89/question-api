import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';
import { SubscriptionResponseDto } from './dtos/subscription-response.dto';
import { SubscriptionStatusDto } from './dtos/subscription-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Controller('payment')
export class PaymentController {
  private stripe: Stripe;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('payment.secretKey');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  // Endpoints protegidos (precisam de autenticação)
  @UseGuards(JwtAuthGuard)
  @Post('subscription')
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @Request() req,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    console.log('🎯 PaymentController - createSubscription chamado');
    console.log('🎯 PaymentController - req.user:', req.user);
    console.log('🎯 PaymentController - req.user.userId:', req.user?.userId);
    console.log(
      '🎯 PaymentController - createSubscriptionDto:',
      createSubscriptionDto,
    );

    if (!req.user || !req.user.userId) {
      throw new BadRequestException(
        'Usuário não autenticado ou ID não encontrado',
      );
    }

    return await this.paymentService.createSubscription(
      req.user.userId,
      createSubscriptionDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/test')
  @HttpCode(HttpStatus.CREATED)
  async createSubscriptionWithTestPayment(
    @Request() req,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    console.log(
      '🎯 PaymentController - createSubscriptionWithTestPayment chamado',
    );
    console.log('🎯 PaymentController - req.user.userId:', req.user?.userId);
    console.log(
      '🎯 PaymentController - createSubscriptionDto:',
      createSubscriptionDto,
    );

    if (!req.user || !req.user.userId) {
      throw new BadRequestException(
        'Usuário não autenticado ou ID não encontrado',
      );
    }

    return await this.paymentService.createSubscriptionWithTestPaymentMethod(
      req.user.userId,
      createSubscriptionDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(
    @Request() req,
  ): Promise<SubscriptionResponseDto | null> {
    return await this.paymentService.getSubscription(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription/status')
  async getSubscriptionStatus(@Request() req): Promise<SubscriptionStatusDto> {
    return await this.paymentService.getSubscriptionStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscription')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Request() req): Promise<SubscriptionResponseDto> {
    return await this.paymentService.cancelSubscription(req.user.userId);
  }

  // Webhook (NÃO precisa de autenticação)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    const webhookSecret = this.configService.get<string>(
      'payment.webhookSecret',
    );

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET não configurada');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Raw body não disponível');
    }

    let event: Stripe.Event;

    try {
      // Verificar assinatura do webhook
      event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Erro na assinatura do webhook:', err);
      throw new BadRequestException('Assinatura inválida');
    }

    // Processar o evento
    await this.paymentService.handleWebhook(event);
  }
}
