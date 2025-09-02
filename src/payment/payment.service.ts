import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dtos/create-subscription.dto';
import { SubscriptionResponseDto } from './dtos/subscription-response.dto';
import { SubscriptionStatusDto } from './dtos/subscription-status.dto';
import { plainToInstance } from 'class-transformer';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    const secretKey = this.configService.get<string>('payment.secretKey');
    const apiVersion = this.configService.get<string>('payment.apiVersion');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: apiVersion as any,
    });
  }

  async createSubscription(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    try {
      // 1. Verificar se usuário já tem assinatura
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (existingSubscription) {
        throw new BadRequestException('Usuário já possui uma assinatura ativa');
      }

      // 2. Buscar dados do usuário
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // 3. Verificar se o price existe no Stripe
      try {
        await this.stripe.prices.retrieve(createSubscriptionDto.priceId);
      } catch {
        throw new BadRequestException(
          'Price ID inválido ou não encontrado no Stripe'
        );
      }

      // 4. Verificar se usuário já tem customer no Stripe
      let customer: Stripe.Customer;
      const existingCustomer = await this.stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existingCustomer.data.length > 0) {
        customer = existingCustomer.data[0];
      } else {
        // 5. Criar customer no Stripe
        customer = await this.stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userId,
          },
        });
      }

      // 6. Criar subscription no Stripe com método de pagamento de teste
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: createSubscriptionDto.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
        },
      });

      // 7. Salvar no banco local
      const currentPeriodEnd = new Date(
        (stripeSubscription as any).current_period_end * 1000
      );

      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      console.log('✅ Assinatura criada com sucesso:', {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        customerId: customer.id,
      });

      return plainToInstance(SubscriptionResponseDto, subscription);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('❌ Erro ao criar assinatura:', error);
      throw new BadRequestException('Erro ao processar assinatura');
    }
  }

  // Método para criar assinatura com método de pagamento de teste (apenas para desenvolvimento)
  async createSubscriptionWithTestPaymentMethod(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto
  ): Promise<SubscriptionResponseDto> {
    try {
      // 1. Verificar se usuário já tem assinatura
      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (existingSubscription) {
        throw new BadRequestException('Usuário já possui uma assinatura ativa');
      }

      // 2. Buscar dados do usuário
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // 3. Verificar se o price existe no Stripe
      try {
        await this.stripe.prices.retrieve(createSubscriptionDto.priceId);
      } catch {
        throw new BadRequestException(
          'Price ID inválido ou não encontrado no Stripe'
        );
      }

      // 4. Verificar se usuário já tem customer no Stripe
      let customer: Stripe.Customer;
      const existingCustomer = await this.stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existingCustomer.data.length > 0) {
        customer = existingCustomer.data[0];
      } else {
        // 5. Criar customer no Stripe
        customer = await this.stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userId,
          },
        });
      }

      // 6. Criar método de pagamento de teste
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: 'tok_visa', // Token de teste do Stripe
        },
      });

      // 7. Anexar método de pagamento ao customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customer.id,
      });

      // 8. Definir como método de pagamento padrão
      await this.stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      // 9. Criar subscription no Stripe
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: createSubscriptionDto.priceId }],
        default_payment_method: paymentMethod.id,
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: userId,
        },
      });

      // 10. Se a subscription tem um payment intent, configurar return_url
      if ((stripeSubscription as any).latest_invoice?.payment_intent) {
        const paymentIntent = (stripeSubscription as any).latest_invoice
          .payment_intent;
        console.log(
          '🔗 Configurando return_url para PaymentIntent:',
          paymentIntent.id
        );
      }

      // 10. Salvar no banco local
      const currentPeriodEnd = new Date(
        (stripeSubscription as any).current_period_end * 1000
      );

      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: customer.id,
          stripeSubscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      console.log('✅ Assinatura criada com método de pagamento de teste:', {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        customerId: customer.id,
        paymentMethodId: paymentMethod.id,
      });

      return plainToInstance(SubscriptionResponseDto, subscription);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error(
        '❌ Erro ao criar assinatura com método de pagamento:',
        error
      );
      throw new BadRequestException('Erro ao processar assinatura');
    }
  }

  async getSubscription(
    userId: string
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return subscription
      ? plainToInstance(SubscriptionResponseDto, subscription)
      : null;
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() },
      },
    });

    return !!subscription;
  }

  async cancelSubscription(userId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }

    // Cancelar no Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Atualizar no banco local
    const updatedSubscription = await this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        status: 'canceled',
      },
    });

    return plainToInstance(SubscriptionResponseDto, updatedSubscription);
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() },
      },
    });

    const hasActiveSubscription = !!subscription;

    if (hasActiveSubscription) {
      return plainToInstance(SubscriptionStatusDto, {
        hasActiveSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      });
    }

    return plainToInstance(SubscriptionStatusDto, {
      hasActiveSubscription: false,
    });
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Evento não tratado: ${event.type}`);
      }
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('Subscription sem userId nos metadados');
      return;
    }

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status,
        currentPeriodEnd: new Date(
          (subscription as any).current_period_end * 1000
        ),
      },
    });
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('Subscription sem userId nos metadados');
      return;
    }

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status,
        currentPeriodEnd: new Date(
          (subscription as any).current_period_end * 1000
        ),
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.error('Subscription sem userId nos metadados');
      return;
    }

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: true,
      },
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (!subscriptionId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId as string },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId as string },
        data: {
          status: 'active',
        },
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (!subscriptionId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId as string },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId as string },
        data: {
          status: 'past_due',
        },
      });
    }
  }
}
