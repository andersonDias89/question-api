import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import stripeConfig from 'src/config/stripe.config';

@Module({
  imports: [
    ConfigModule.forFeature(stripeConfig),
    PrismaModule,
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService]
})
export class PaymentModule {}
