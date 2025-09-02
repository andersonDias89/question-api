// src/payment/dtos/create-subscription.dto.ts
import { IsString, IsNotEmpty } from 'class-validator'

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  priceId: string // ID do preço no Stripe
}
