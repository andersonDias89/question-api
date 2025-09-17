// Primeiro: Mocks antes de qualquer import
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    prices: {
      retrieve: jest.fn(),
    },
    customers: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentMethods: {
      create: jest.fn(),
      attach: jest.fn(),
    },
  })),
}))

jest.mock('class-transformer', () => ({
  ...jest.requireActual('class-transformer'),
  plainToInstance: jest.fn((dto, data) => data),
}))

// Agora os imports
import { Test, TestingModule } from '@nestjs/testing'
import { PaymentService } from '../payment.service'
import { PrismaService } from '@/prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto'
import { SubscriptionResponseDto } from '../dtos/subscription-response.dto'
import { SubscriptionStatusDto } from '../dtos/subscription-status.dto'
import { plainToInstance } from 'class-transformer'

describe('PaymentService', () => {
  let service: PaymentService
  let configService: ConfigService
  let mockStripe: any

  // Mock do PrismaService
  const mockPrismaService = {
    subscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  }

  // Mock do ConfigService
  const mockConfigService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks()

    // Configurar mocks do ConfigService
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'payment.secretKey':
          return 'sk_test_mock_key'
        case 'payment.apiVersion':
          return '2024-12-18.acacia'
        default:
          return null
      }
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<PaymentService>(PaymentService)
    configService = module.get<ConfigService>(ConfigService)

    // Acessar a instância do Stripe mockada através do serviço
    mockStripe = (service as any).stripe
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('deve lançar erro quando STRIPE_SECRET_KEY não está configurada', () => {
      // Arrange
      const mockConfigServiceWithoutKey = {
        get: jest.fn().mockReturnValue(null),
      }

      // Act & Assert
      expect(() => {
        new PaymentService(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          mockPrismaService as any,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          mockConfigServiceWithoutKey as any
        )
      }).toThrow('STRIPE_SECRET_KEY não configurada')
    })

    it('deve inicializar Stripe corretamente com configurações válidas', () => {
      // Arrange & Act já foram feitos no beforeEach

      // Assert
      expect(configService.get).toHaveBeenCalledWith('payment.secretKey')
      expect(configService.get).toHaveBeenCalledWith('payment.apiVersion')
      expect(mockStripe).toBeDefined()
    })
  })

  describe('createSubscription', () => {
    const mockUserId = 'user-123'
    const mockCreateSubscriptionDto: CreateSubscriptionDto = {
      priceId: 'price_test_123',
    }

    const mockUser = {
      id: mockUserId,
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockCustomer = {
      id: 'cus_test_123',
      email: 'test@example.com',
      name: 'Test User',
    }

    const mockStripeSubscription = {
      id: 'sub_test_123',
      status: 'active',
      current_period_end: 1672531200, // Timestamp
      metadata: { userId: mockUserId },
    }

    beforeEach(() => {
      // Setup padrão para testes de sucesso
      mockPrismaService.subscription.findUnique.mockResolvedValue(null)
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockStripe.prices.retrieve.mockResolvedValue({
        id: 'price_test_123',
      })
      mockStripe.customers.list.mockResolvedValue({ data: [] })
      mockStripe.customers.create.mockResolvedValue(mockCustomer)
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription)
    })

    it('deve criar assinatura com sucesso para novo cliente', async () => {
      // Arrange
      const mockSubscription = {
        id: 'sub_local_123',
        userId: mockUserId,
        stripeCustomerId: mockCustomer.id,
        stripeSubscriptionId: mockStripeSubscription.id,
        status: 'active',
        currentPeriodEnd: new Date(
          mockStripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: false,
      }

      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription)

      // Act
      const result = await service.createSubscription(
        mockUserId,
        mockCreateSubscriptionDto
      )

      // Assert
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      })
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      })
      expect(mockStripe.prices.retrieve).toHaveBeenCalledWith(
        mockCreateSubscriptionDto.priceId
      )
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: mockUser.email,
        limit: 1,
      })
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
        metadata: { userId: mockUserId },
      })
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: mockCustomer.id,
        items: [{ price: mockCreateSubscriptionDto.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId: mockUserId },
      })
      expect(mockPrismaService.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          stripeCustomerId: mockCustomer.id,
          stripeSubscriptionId: mockStripeSubscription.id,
          status: mockStripeSubscription.status,
          currentPeriodEnd: expect.any(Date),
          cancelAtPeriodEnd: false,
        },
      })
      expect(result).toEqual(mockSubscription)
    })

    it('deve usar cliente existente quando já existe no Stripe', async () => {
      // Arrange
      const existingCustomer = { id: 'cus_existing_123', email: mockUser.email }
      mockStripe.customers.list.mockResolvedValue({
        data: [existingCustomer],
      })

      const mockSubscription = {
        id: 'sub_local_123',
        userId: mockUserId,
        stripeCustomerId: existingCustomer.id,
        stripeSubscriptionId: mockStripeSubscription.id,
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      }

      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription)

      // Act
      const result = await service.createSubscription(
        mockUserId,
        mockCreateSubscriptionDto
      )

      // Assert
      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: mockUser.email,
        limit: 1,
      })
      expect(mockStripe.customers.create).not.toHaveBeenCalled()
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: existingCustomer.id,
        })
      )
      expect(result).toEqual(mockSubscription)
    })

    it('deve lançar BadRequestException quando usuário já tem assinatura', async () => {
      // Arrange
      const existingSubscription = {
        id: 'sub_existing_123',
        userId: mockUserId,
        status: 'active',
      }
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        existingSubscription
      )

      // Act & Assert
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow('Usuário já possui uma assinatura ativa')

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled()
      expect(mockStripe.prices.retrieve).not.toHaveBeenCalled()
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow('Usuário não encontrado')

      expect(mockStripe.prices.retrieve).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando priceId é inválido', async () => {
      // Arrange
      mockStripe.prices.retrieve.mockRejectedValue(new Error('Price not found'))

      // Act & Assert
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow('Price ID inválido ou não encontrado no Stripe')

      expect(mockStripe.customers.list).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando há erro inesperado', async () => {
      // Arrange
      mockStripe.customers.create.mockRejectedValue(
        new Error('Stripe API error')
      )

      // Act & Assert
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.createSubscription(mockUserId, mockCreateSubscriptionDto)
      ).rejects.toThrow('Erro ao processar assinatura')
    })
  })

  describe('getSubscription', () => {
    it('deve retornar assinatura quando existe', async () => {
      // Arrange
      const userId = 'user-123'
      const mockSubscription = {
        id: 'sub-123',
        userId,
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      }

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription
      )

      // Act
      const result = await service.getSubscription(userId)

      // Assert
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId },
      })
      expect(plainToInstance).toHaveBeenCalledWith(
        SubscriptionResponseDto,
        mockSubscription
      )
      expect(result).toEqual(mockSubscription)
    })

    it('deve retornar null quando assinatura não existe', async () => {
      // Arrange
      const userId = 'user-123'
      mockPrismaService.subscription.findUnique.mockResolvedValue(null)

      // Act
      const result = await service.getSubscription(userId)

      // Assert
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId },
      })
      expect(plainToInstance).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('hasActiveSubscription', () => {
    it('deve retornar true quando usuário tem assinatura ativa', async () => {
      // Arrange
      const userId = 'user-123'
      const mockSubscription = {
        id: 'sub-123',
        userId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400000), // Amanhã
      }

      mockPrismaService.subscription.findFirst.mockResolvedValue(
        mockSubscription
      )

      // Act
      const result = await service.hasActiveSubscription(userId)

      // Assert
      expect(mockPrismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'active',
          currentPeriodEnd: { gt: expect.any(Date) },
        },
      })
      expect(result).toBe(true)
    })

    it('deve retornar false quando usuário não tem assinatura ativa', async () => {
      // Arrange
      const userId = 'user-123'
      mockPrismaService.subscription.findFirst.mockResolvedValue(null)

      // Act
      const result = await service.hasActiveSubscription(userId)

      // Assert
      expect(mockPrismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'active',
          currentPeriodEnd: { gt: expect.any(Date) },
        },
      })
      expect(result).toBe(false)
    })
  })

  describe('cancelSubscription', () => {
    it('deve cancelar assinatura com sucesso', async () => {
      // Arrange
      const userId = 'user-123'
      const mockSubscription = {
        id: 'sub-123',
        userId,
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
        cancelAtPeriodEnd: false,
      }

      const mockUpdatedSubscription = {
        ...mockSubscription,
        status: 'canceled',
        cancelAtPeriodEnd: true,
      }

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription
      )
      mockStripe.subscriptions.update.mockResolvedValue({})
      mockPrismaService.subscription.update.mockResolvedValue(
        mockUpdatedSubscription
      )

      // Act
      const result = await service.cancelSubscription(userId)

      // Assert
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId },
      })
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        { cancel_at_period_end: true }
      )
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          cancelAtPeriodEnd: true,
          status: 'canceled',
        },
      })
      expect(plainToInstance).toHaveBeenCalledWith(
        SubscriptionResponseDto,
        mockUpdatedSubscription
      )
      expect(result).toEqual(mockUpdatedSubscription)
    })

    it('deve lançar NotFoundException quando assinatura não existe', async () => {
      // Arrange
      const userId = 'user-123'
      mockPrismaService.subscription.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.cancelSubscription(userId)).rejects.toThrow(
        NotFoundException
      )
      await expect(service.cancelSubscription(userId)).rejects.toThrow(
        'Assinatura não encontrada'
      )

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled()
    })
  })

  describe('getSubscriptionStatus', () => {
    it('deve retornar status com assinatura ativa quando existe', async () => {
      // Arrange
      const userId = 'user-123'
      const mockSubscription = {
        id: 'sub-123',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400000), // Amanhã
        cancelAtPeriodEnd: false,
      }

      mockPrismaService.subscription.findFirst.mockResolvedValue(
        mockSubscription
      )

      const expectedStatus = {
        hasActiveSubscription: true,
        subscription: {
          id: mockSubscription.id,
          status: mockSubscription.status,
          currentPeriodEnd: mockSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: mockSubscription.cancelAtPeriodEnd,
        },
      }

      // Act
      const result = await service.getSubscriptionStatus(userId)

      // Assert
      expect(mockPrismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'active',
          currentPeriodEnd: { gt: expect.any(Date) },
        },
      })
      expect(plainToInstance).toHaveBeenCalledWith(
        SubscriptionStatusDto,
        expectedStatus
      )
      expect(result).toEqual(expectedStatus)
    })

    it('deve retornar status sem assinatura ativa quando não existe', async () => {
      // Arrange
      const userId = 'user-123'
      mockPrismaService.subscription.findFirst.mockResolvedValue(null)

      const expectedStatus = {
        hasActiveSubscription: false,
      }

      // Act
      const result = await service.getSubscriptionStatus(userId)

      // Assert
      expect(mockPrismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'active',
          currentPeriodEnd: { gt: expect.any(Date) },
        },
      })
      expect(plainToInstance).toHaveBeenCalledWith(
        SubscriptionStatusDto,
        expectedStatus
      )
      expect(result).toEqual(expectedStatus)
    })
  })

  describe('handleWebhook', () => {
    it('deve processar evento customer.subscription.created', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'active',
            current_period_end: 1672531200,
            metadata: { userId: 'user-123' },
          },
        },
      } as unknown

      mockPrismaService.subscription.update.mockResolvedValue({})

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.handleWebhook(mockEvent as any)

      // Assert
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe_123' },
        data: {
          status: 'active',
          currentPeriodEnd: new Date(1672531200 * 1000),
        },
      })
    })

    it('deve processar evento customer.subscription.updated', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            status: 'past_due',
            current_period_end: 1672531200,
            cancel_at_period_end: true,
            metadata: { userId: 'user-123' },
          },
        },
      } as unknown

      mockPrismaService.subscription.update.mockResolvedValue({})

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.handleWebhook(mockEvent as any)

      // Assert
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe_123' },
        data: {
          status: 'past_due',
          currentPeriodEnd: new Date(1672531200 * 1000),
          cancelAtPeriodEnd: true,
        },
      })
    })

    it('deve processar evento invoice.payment_succeeded', async () => {
      // Arrange
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_stripe_123',
          },
        },
      } as unknown

      const mockSubscription = {
        id: 'sub-123',
        stripeSubscriptionId: 'sub_stripe_123',
      }

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription
      )
      mockPrismaService.subscription.update.mockResolvedValue({})

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.handleWebhook(mockEvent as any)

      // Assert
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe_123' },
      })
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe_123' },
        data: { status: 'active' },
      })
    })

    it('deve logar evento não tratado', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.created',
        data: { object: {} },
      } as unknown

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.handleWebhook(mockEvent as any)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Evento não tratado: customer.created'
      )

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('deve relançar erro quando há falha no processamento', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_123',
            metadata: { userId: 'user-123' },
          },
        },
      } as unknown

      const mockError = new Error('Database error')
      mockPrismaService.subscription.update.mockRejectedValue(mockError)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.handleWebhook(mockEvent as any)).rejects.toThrow(
        mockError
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Erro ao processar webhook:',
        mockError
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    it('deve lidar com webhooks sem userId nos metadados', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_123',
            metadata: {}, // Sem userId
          },
        },
      } as unknown

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.handleWebhook(mockEvent as any)

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Subscription sem userId nos metadados'
      )
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled()

      // Cleanup
      consoleErrorSpy.mockRestore()
    })
  })

  describe('cenários de integração', () => {
    it('deve processar fluxo completo: criar -> cancelar assinatura', async () => {
      // Arrange - Criação
      const userId = 'user-123'
      const createDto: CreateSubscriptionDto = { priceId: 'price_test_123' }

      const mockUser = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
      }

      const mockCustomer = { id: 'cus_test_123' }
      const mockStripeSubscription = {
        id: 'sub_stripe_123',
        status: 'active',
        current_period_end: 1672531200,
      }

      const mockCreatedSubscription = {
        id: 'sub_local_123',
        userId,
        stripeCustomerId: mockCustomer.id,
        stripeSubscriptionId: mockStripeSubscription.id,
        status: 'active',
        cancelAtPeriodEnd: false,
      }

      // Setup para criação
      mockPrismaService.subscription.findUnique.mockResolvedValueOnce(null) // Não existe
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockStripe.prices.retrieve.mockResolvedValue({
        id: 'price_test_123',
      })
      mockStripe.customers.list.mockResolvedValue({ data: [] })
      mockStripe.customers.create.mockResolvedValue(mockCustomer)
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription)
      mockPrismaService.subscription.create.mockResolvedValue(
        mockCreatedSubscription
      )

      // Act 1 - Criar assinatura
      const createResult = await service.createSubscription(userId, createDto)

      // Assert 1
      expect(createResult).toEqual(mockCreatedSubscription)

      // Arrange - Cancelamento
      const mockCanceledSubscription = {
        ...mockCreatedSubscription,
        status: 'canceled',
        cancelAtPeriodEnd: true,
      }

      mockPrismaService.subscription.findUnique.mockResolvedValueOnce(
        mockCreatedSubscription
      )
      mockStripe.subscriptions.update.mockResolvedValue({})
      mockPrismaService.subscription.update.mockResolvedValue(
        mockCanceledSubscription
      )

      // Act 2 - Cancelar assinatura
      const cancelResult = await service.cancelSubscription(userId)

      // Assert 2
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        mockStripeSubscription.id,
        { cancel_at_period_end: true }
      )
      expect(cancelResult).toEqual(mockCanceledSubscription)
    })
  })
})
