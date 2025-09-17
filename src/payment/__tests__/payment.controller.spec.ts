import { Test, TestingModule } from '@nestjs/testing'
import { PaymentController } from '../payment.controller'
import { PaymentService } from '../payment.service'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto'
import { SubscriptionResponseDto } from '../dtos/subscription-response.dto'
import { SubscriptionStatusDto } from '../dtos/subscription-status.dto'
import { AuthenticatedRequest } from '../../auth/types/request.types'
import { Request as ExpressRequest } from 'express'
import { RawBodyRequest } from '@nestjs/common'
import Stripe from 'stripe'

// Mock do Stripe
jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: jest.fn(),
      },
    })),
  }
})

describe('PaymentController', () => {
  let controller: PaymentController
  let paymentService: PaymentService
  let mockStripe: any

  // Mock do PaymentService
  const mockPaymentService = {
    createSubscription: jest.fn(),
    createSubscriptionWithTestPaymentMethod: jest.fn(),
    getSubscription: jest.fn(),
    getSubscriptionStatus: jest.fn(),
    cancelSubscription: jest.fn(),
    handleWebhook: jest.fn(),
  }

  // Mock do ConfigService
  const mockConfigService = {
    get: jest.fn(),
  }

  beforeEach(async () => {
    // Resetar mocks
    jest.clearAllMocks()

    // Configurar retorno padrão do ConfigService
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'payment.secretKey') return 'sk_test_123'
      if (key === 'payment.webhookSecret') return 'whsec_test_123'
      return null
    })

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    controller = module.get<PaymentController>(PaymentController)
    paymentService = module.get<PaymentService>(PaymentService)

    // Acessar a instância do Stripe mockada
    mockStripe = (controller as any).stripe
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
        new PaymentController(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          mockPaymentService as any,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          mockConfigServiceWithoutKey as any
        )
      }).toThrow('STRIPE_SECRET_KEY não configurada')
    })

    it('deve inicializar Stripe corretamente com configurações válidas', () => {
      // Arrange & Act já foram feitos no beforeEach

      // Assert
      expect(mockConfigService.get).toHaveBeenCalledWith('payment.secretKey')
      expect(controller).toBeDefined()
    })
  })

  describe('createSubscription', () => {
    it('deve criar assinatura com sucesso', async () => {
      // Arrange
      const userId = 'user-123'
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      const expectedResponse: SubscriptionResponseDto = {
        id: 'sub-123',
        userId,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPaymentService.createSubscription.mockResolvedValue(expectedResponse)

      // Act
      const result = await controller.createSubscription(
        mockRequest,
        createSubscriptionDto
      )

      // Assert
      expect(paymentService.createSubscription).toHaveBeenCalledWith(
        userId,
        createSubscriptionDto
      )
      expect(result).toEqual(expectedResponse)
    })

    it('deve lançar BadRequestException quando usuário não está autenticado', async () => {
      // Arrange
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }
      const mockRequest: AuthenticatedRequest = {
        user: null,
      } as any

      // Act & Assert
      await expect(
        controller.createSubscription(mockRequest, createSubscriptionDto)
      ).rejects.toThrow(
        new BadRequestException('Usuário não autenticado ou ID não encontrado')
      )

      expect(paymentService.createSubscription).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando userId não está presente', async () => {
      // Arrange
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }
      const mockRequest: AuthenticatedRequest = {
        user: { userId: '', email: 'test@test.com', name: 'Test User' },
      } as any

      // Act & Assert
      await expect(
        controller.createSubscription(mockRequest, createSubscriptionDto)
      ).rejects.toThrow(
        new BadRequestException('Usuário não autenticado ou ID não encontrado')
      )

      expect(paymentService.createSubscription).not.toHaveBeenCalled()
    })
  })

  describe('createSubscriptionWithTestPayment', () => {
    it('deve criar assinatura de teste com sucesso', async () => {
      // Arrange
      const userId = 'user-123'
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      const expectedResponse: SubscriptionResponseDto = {
        id: 'sub-123',
        userId,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPaymentService.createSubscriptionWithTestPaymentMethod.mockResolvedValue(
        expectedResponse
      )

      // Act
      const result = await controller.createSubscriptionWithTestPayment(
        mockRequest,
        createSubscriptionDto
      )

      // Assert
      expect(
        paymentService.createSubscriptionWithTestPaymentMethod
      ).toHaveBeenCalledWith(userId, createSubscriptionDto)
      expect(result).toEqual(expectedResponse)
    })

    it('deve lançar BadRequestException quando usuário não está autenticado', async () => {
      // Arrange
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }
      const mockRequest: AuthenticatedRequest = {
        user: null,
      } as any

      // Act & Assert
      await expect(
        controller.createSubscriptionWithTestPayment(
          mockRequest,
          createSubscriptionDto
        )
      ).rejects.toThrow(
        new BadRequestException('Usuário não autenticado ou ID não encontrado')
      )

      expect(
        paymentService.createSubscriptionWithTestPaymentMethod
      ).not.toHaveBeenCalled()
    })
  })

  describe('getSubscription', () => {
    it('deve retornar assinatura quando existe', async () => {
      // Arrange
      const userId = 'user-123'
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      const expectedResponse: SubscriptionResponseDto = {
        id: 'sub-123',
        userId,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPaymentService.getSubscription.mockResolvedValue(expectedResponse)

      // Act
      const result = await controller.getSubscription(mockRequest)

      // Assert
      expect(paymentService.getSubscription).toHaveBeenCalledWith(userId)
      expect(result).toEqual(expectedResponse)
    })

    it('deve retornar null quando assinatura não existe', async () => {
      // Arrange
      const userId = 'user-123'
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      mockPaymentService.getSubscription.mockResolvedValue(null)

      // Act
      const result = await controller.getSubscription(mockRequest)

      // Assert
      expect(paymentService.getSubscription).toHaveBeenCalledWith(userId)
      expect(result).toBeNull()
    })
  })

  describe('getSubscriptionStatus', () => {
    it('deve retornar status da assinatura', async () => {
      // Arrange
      const userId = 'user-123'
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      const expectedStatus: SubscriptionStatusDto = {
        hasActiveSubscription: true,
        subscription: {
          id: 'sub-123',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      }

      mockPaymentService.getSubscriptionStatus.mockResolvedValue(expectedStatus)

      // Act
      const result = await controller.getSubscriptionStatus(mockRequest)

      // Assert
      expect(paymentService.getSubscriptionStatus).toHaveBeenCalledWith(userId)
      expect(result).toEqual(expectedStatus)
    })
  })

  describe('cancelSubscription', () => {
    it('deve cancelar assinatura com sucesso', async () => {
      // Arrange
      const userId = 'user-123'
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any

      const expectedResponse: SubscriptionResponseDto = {
        id: 'sub-123',
        userId,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'canceled',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPaymentService.cancelSubscription.mockResolvedValue(expectedResponse)

      // Act
      const result = await controller.cancelSubscription(mockRequest)

      // Assert
      expect(paymentService.cancelSubscription).toHaveBeenCalledWith(userId)
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('handleWebhook', () => {
    it('deve processar webhook com sucesso', async () => {
      // Arrange
      const rawBody = Buffer.from('webhook payload')
      const signature = 'stripe_signature_123'
      const mockEvent: Stripe.Event = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: {} },
      } as any

      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody,
      } as any

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPaymentService.handleWebhook.mockResolvedValue(undefined)

      // Act
      await controller.handleWebhook(mockRequest, signature)

      // Assert
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        'whsec_test_123'
      )
      expect(paymentService.handleWebhook).toHaveBeenCalledWith(mockEvent)
    })

    it('deve lançar erro quando STRIPE_WEBHOOK_SECRET não está configurada', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'payment.secretKey') return 'sk_test_123'
        if (key === 'payment.webhookSecret') return null // Sem webhook secret
        return null
      })

      // Recriar controller com nova configuração
      const module = await Test.createTestingModule({
        controllers: [PaymentController],
        providers: [
          { provide: PaymentService, useValue: mockPaymentService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile()

      const newController = module.get<PaymentController>(PaymentController)

      const rawBody = Buffer.from('webhook payload')
      const signature = 'stripe_signature_123'
      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody,
      } as any

      // Act & Assert
      await expect(
        newController.handleWebhook(mockRequest, signature)
      ).rejects.toThrow('STRIPE_WEBHOOK_SECRET não configurada')
    })

    it('deve lançar BadRequestException quando rawBody não está disponível', async () => {
      // Arrange
      const signature = 'stripe_signature_123'
      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody: undefined,
      } as any

      // Act & Assert
      await expect(
        controller.handleWebhook(mockRequest, signature)
      ).rejects.toThrow(new BadRequestException('Raw body não disponível'))

      expect(mockStripe.webhooks.constructEvent).not.toHaveBeenCalled()
      expect(paymentService.handleWebhook).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando assinatura é inválida', async () => {
      // Arrange
      const rawBody = Buffer.from('webhook payload')
      const signature = 'invalid_signature'
      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody,
      } as any

      const signatureError = new Error('Invalid signature')
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw signatureError
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      await expect(
        controller.handleWebhook(mockRequest, signature)
      ).rejects.toThrow(new BadRequestException('Assinatura inválida'))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Erro na assinatura do webhook:',
        signatureError
      )
      expect(paymentService.handleWebhook).not.toHaveBeenCalled()

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    it('deve propagar erro do PaymentService', async () => {
      // Arrange
      const rawBody = Buffer.from('webhook payload')
      const signature = 'stripe_signature_123'
      const mockEvent: Stripe.Event = {
        id: 'evt_123',
        type: 'customer.subscription.created',
        data: { object: {} },
      } as any

      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody,
      } as any

      const serviceError = new Error('Payment service error')
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)
      mockPaymentService.handleWebhook.mockRejectedValue(serviceError)

      // Act & Assert
      await expect(
        controller.handleWebhook(mockRequest, signature)
      ).rejects.toThrow(serviceError)

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        'whsec_test_123'
      )
      expect(paymentService.handleWebhook).toHaveBeenCalledWith(mockEvent)
    })
  })

  describe('cenários de integração', () => {
    it('deve processar fluxo completo: criar -> obter -> cancelar assinatura', async () => {
      // Arrange
      const userId = 'user-123'
      const mockRequest: AuthenticatedRequest = {
        user: { userId, email: 'test@test.com', name: 'Test User' },
      } as any
      const createSubscriptionDto: CreateSubscriptionDto = {
        priceId: 'price_test_123',
      }

      const activeSubscription: SubscriptionResponseDto = {
        id: 'sub-123',
        userId,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const canceledSubscription: SubscriptionResponseDto = {
        ...activeSubscription,
        status: 'canceled',
        cancelAtPeriodEnd: true,
      }

      // Mock das respostas em sequência
      mockPaymentService.createSubscription.mockResolvedValue(
        activeSubscription
      )
      mockPaymentService.getSubscription.mockResolvedValue(activeSubscription)
      mockPaymentService.cancelSubscription.mockResolvedValue(
        canceledSubscription
      )

      // Act & Assert - Criar assinatura
      const createdResult = await controller.createSubscription(
        mockRequest,
        createSubscriptionDto
      )
      expect(createdResult.status).toBe('active')

      // Act & Assert - Obter assinatura
      const getResult = await controller.getSubscription(mockRequest)
      expect(getResult?.status).toBe('active')

      // Act & Assert - Cancelar assinatura
      const canceledResult = await controller.cancelSubscription(mockRequest)
      expect(canceledResult.status).toBe('canceled')
      expect(canceledResult.cancelAtPeriodEnd).toBe(true)
    })

    it('deve lidar com múltiplos webhooks em sequência', async () => {
      // Arrange
      const rawBody = Buffer.from('webhook payload')
      const signature = 'stripe_signature_123'
      const mockRequest: RawBodyRequest<ExpressRequest> = {
        rawBody,
      } as any

      const events: Stripe.Event[] = [
        { id: 'evt_1', type: 'customer.subscription.created', data: {} } as any,
        { id: 'evt_2', type: 'customer.subscription.updated', data: {} } as any,
        { id: 'evt_3', type: 'invoice.payment_succeeded', data: {} } as any,
      ]

      mockPaymentService.handleWebhook.mockResolvedValue(undefined)

      // Act & Assert - Processar cada webhook
      for (const event of events) {
        mockStripe.webhooks.constructEvent.mockReturnValue(event)
        await controller.handleWebhook(mockRequest, signature)
        expect(paymentService.handleWebhook).toHaveBeenCalledWith(event)
      }

      expect(paymentService.handleWebhook).toHaveBeenCalledTimes(3)
    })
  })
})
