import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ConfigModule } from '@nestjs/config';
import stripeConfig from 'src/config/stripe.config';

@Module({
  imports: [ConfigModule.forFeature(stripeConfig)],
  providers: [PaymentService],
  exports: [PaymentService]
})
export class PaymentModule {}
