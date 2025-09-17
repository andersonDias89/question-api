import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from '../auth.service'
import { PrismaService } from '@/prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import { BadRequestException } from '@nestjs/common'
import { ForgotPasswordDto } from '../dtos/forgot-password.dto'
import { ResetPasswordDto } from '../dtos/reset-password.dto'
import { UserResponseDto } from '@/user/dtos/user-response.dto'
import { hashPassword, comparePassword } from '@/common/password'
import * as crypto from 'crypto'

// Mock das funções de password
jest.mock('@/common/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('mocked-hashed-password'),
  comparePassword: jest.fn(),
}))

// Mock do crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}))

describe('AuthService', () => {
  let service: AuthService
  let prismaService: PrismaService
  let jwtService: JwtService

  // Mock do PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  }

  // Mock do JwtService
  const mockJwtService = {
    sign: jest.fn(),
  }

  // Mock do crypto
  const mockCrypto = {
    randomBytes: jest.fn(),
    createHash: jest.fn(),
  }

  beforeEach(async () => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks()

    // Resetar implementações do crypto
    ;(crypto.randomBytes as jest.Mock) = mockCrypto.randomBytes
    ;(crypto.createHash as jest.Mock) = mockCrypto.createHash

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    prismaService = module.get<PrismaService>(PrismaService)
    jwtService = module.get<JwtService>(JwtService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateUser', () => {
    it('deve retornar UserResponseDto quando credenciais são válidas', async () => {
      // Arrange
      const email = 'user@test.com'
      const password = 'password123'
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.com',
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      ;(comparePassword as jest.Mock).mockResolvedValue(true)

      // Act
      const result = await service.validateUser(email, password)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(comparePassword).toHaveBeenCalledWith(password, 'hashed-password')
      expect(result).toEqual({
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.com',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })
      expect(result).not.toHaveProperty('password')
    })

    it('deve retornar null quando usuário não existe', async () => {
      // Arrange
      const email = 'nonexistent@test.com'
      const password = 'password123'

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act
      const result = await service.validateUser(email, password)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(comparePassword).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('deve retornar null quando senha é inválida', async () => {
      // Arrange
      const email = 'user@test.com'
      const password = 'wrong-password'
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.com',
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      ;(comparePassword as jest.Mock).mockResolvedValue(false)

      // Act
      const result = await service.validateUser(email, password)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(comparePassword).toHaveBeenCalledWith(password, 'hashed-password')
      expect(result).toBeNull()
    })
  })

  describe('login', () => {
    it('deve retornar access_token e dados do usuário', () => {
      // Arrange
      const user: UserResponseDto = {
        id: 'user-1',
        name: 'Test User',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const mockToken = 'mock-jwt-token'

      mockJwtService.sign.mockReturnValue(mockToken)

      // Act
      const result = service.login(user)

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user.id,
        name: user.name,
      })
      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
    })
  })

  describe('forgotPassword', () => {
    it('deve processar solicitação de reset quando usuário existe', async () => {
      // Arrange
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'user@test.com',
      }
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
      }
      const mockToken = 'mock-reset-token'
      const mockTokenHash = 'mock-token-hash'

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockCrypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      })
      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })

      // Act
      const result = await service.forgotPassword(forgotPasswordDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: forgotPasswordDto.email },
      })
      expect(crypto.randomBytes).toHaveBeenCalledWith(32)
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          resetPasswordToken: mockTokenHash,
          resetPasswordExpires: expect.any(Date),
        },
      })
      expect(result).toEqual({
        message:
          'If the email exists, you will receive instructions to reset your password.',
      })
    })

    it('deve retornar mensagem genérica quando usuário não existe', async () => {
      // Arrange
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'nonexistent@test.com',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act
      const result = await service.forgotPassword(forgotPasswordDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: forgotPasswordDto.email },
      })
      expect(crypto.randomBytes).not.toHaveBeenCalled()
      expect(prismaService.user.update).not.toHaveBeenCalled()
      expect(result).toEqual({
        message:
          'If the email exists, you will receive instructions to reset your password.',
      })
    })
  })

  describe('resetPassword', () => {
    it('deve resetar senha com token válido', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        token: 'reset-token',
        newPassword: 'new-password-123',
      }
      const mockTokenHash = 'hashed-token'
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
      }

      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser)

      // Act
      const result = await service.resetPassword(resetPasswordDto)

      // Assert
      expect(crypto.createHash).toHaveBeenCalledWith('sha256')
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          resetPasswordToken: mockTokenHash,
          resetPasswordExpires: {
            gt: expect.any(Date),
          },
        },
      })
      expect(hashPassword).toHaveBeenCalledWith(resetPasswordDto.newPassword)
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'mocked-hashed-password',
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      })
      expect(result).toEqual({
        message: 'Password reset successfully!',
      })
    })

    it('deve lançar BadRequestException com token inválido', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        token: 'invalid-token',
        newPassword: 'new-password-123',
      }
      const mockTokenHash = 'hashed-invalid-token'

      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })
      mockPrismaService.user.findFirst.mockResolvedValue(null)

      // Act & Assert
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException
      )
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Invalid or expired token'
      )
      expect(hashPassword).not.toHaveBeenCalled()
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException com token expirado', async () => {
      // Arrange
      const resetPasswordDto: ResetPasswordDto = {
        token: 'expired-token',
        newPassword: 'new-password-123',
      }
      const mockTokenHash = 'hashed-expired-token'

      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })
      mockPrismaService.user.findFirst.mockResolvedValue(null) // Simulando token expirado

      // Act & Assert
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        BadRequestException
      )
      await expect(service.resetPassword(resetPasswordDto)).rejects.toThrow(
        'Invalid or expired token'
      )
      expect(hashPassword).not.toHaveBeenCalled()
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredTokens (método privado)', () => {
    it('deve limpar tokens expirados', async () => {
      // Arrange
      const mockUpdateResult = { count: 3 }
      mockPrismaService.user.updateMany.mockResolvedValue(mockUpdateResult)

      // Mock console.log para verificar se foi chamado
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Act - Como o método é privado, vamos testá-lo indiretamente
      // chamando um método que potencialmente pode disparar a limpeza
      await service.forgotPassword({ email: 'test@test.com' })

      // Simular que a limpeza foi executada manualmente para testar a lógica
      await (service as any).cleanupExpiredTokens()

      // Assert
      expect(prismaService.user.updateMany).toHaveBeenCalledWith({
        where: {
          resetPasswordExpires: {
            lt: expect.any(Date),
          },
        },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      })
      expect(consoleSpy).toHaveBeenCalledWith(
        '🧹 Cleaned up 3 expired password reset tokens'
      )

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('deve lidar com erro na limpeza de tokens', async () => {
      // Arrange
      const mockError = new Error('Database error')
      mockPrismaService.user.updateMany.mockRejectedValue(mockError)

      // Mock console.error para verificar se foi chamado
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act
      await (service as any).cleanupExpiredTokens()

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error cleaning up expired tokens:',
        mockError
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    it('não deve logar quando nenhum token foi limpo', async () => {
      // Arrange
      const mockUpdateResult = { count: 0 }
      mockPrismaService.user.updateMany.mockResolvedValue(mockUpdateResult)

      // Mock console.log para verificar se NÃO foi chamado
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Act
      await (service as any).cleanupExpiredTokens()

      // Assert
      expect(prismaService.user.updateMany).toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      )

      // Cleanup
      consoleSpy.mockRestore()
    })
  })

  describe('integração de cenários', () => {
    it('deve processar um fluxo completo de reset de senha', async () => {
      // Arrange - Forgot Password
      const email = 'user@test.com'
      const mockUser = { id: 'user-1', email }
      const mockToken = 'reset-token-123'
      const mockTokenHash = 'hashed-reset-token'

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      mockCrypto.randomBytes.mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      })
      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })

      // Act 1 - Forgot Password
      const forgotResult = await service.forgotPassword({ email })

      // Assert 1
      expect(forgotResult.message).toContain('If the email exists')
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          resetPasswordToken: mockTokenHash,
          resetPasswordExpires: expect.any(Date),
        },
      })

      // Arrange - Reset Password
      const newPassword = 'new-secure-password'
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser)
      jest.clearAllMocks() // Limpar mocks para a segunda parte

      mockCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(mockTokenHash),
      })

      // Act 2 - Reset Password
      const resetResult = await service.resetPassword({
        token: mockToken,
        newPassword,
      })

      // Assert 2
      expect(resetResult.message).toBe('Password reset successfully!')
      expect(hashPassword).toHaveBeenCalledWith(newPassword)
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'mocked-hashed-password',
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      })
    })

    it('deve validar usuário após reset de senha bem-sucedido', async () => {
      // Arrange
      const email = 'user@test.com'
      const newPassword = 'new-password-123'
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        email,
        password: 'mocked-hashed-password', // Nova senha após reset
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)
      ;(comparePassword as jest.Mock).mockResolvedValue(true)

      // Act
      const validateResult = await service.validateUser(email, newPassword)

      // Assert
      expect(validateResult).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })
      expect(comparePassword).toHaveBeenCalledWith(
        newPassword,
        'mocked-hashed-password'
      )
    })
  })
})
