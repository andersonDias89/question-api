import { Expose } from 'class-transformer'

export class SubscriptionStatusDto {
  @Expose()
  hasActiveSubscription: boolean

  @Expose()
  subscription?: {
    id: string
    status: string
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
  }
}
