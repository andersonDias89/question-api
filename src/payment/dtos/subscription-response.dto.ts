// src/payment/dtos/subscription-response.dto.ts
import { Expose } from 'class-transformer';

export class SubscriptionResponseDto {
  @Expose()
  id: string;

  @Expose()
  userId: string;

  @Expose()
  stripeCustomerId: string;

  @Expose()
  stripeSubscriptionId: string;

  @Expose()
  status: string;

  @Expose()
  currentPeriodEnd: Date;

  @Expose()
  cancelAtPeriodEnd: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}