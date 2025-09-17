import { Test, TestingModule } from '@nestjs/testing'
import { UserService } from '../user.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { CreateUserDto } from '../dtos/create-user.dto'
import { UpdateUserDto } from '../dtos/update-user.dto'
import { ChangePasswordDto } from '../dtos/change-password.dto'
import { hashPassword, comparePassword } from '@/common/password'

// Mock das funções de password
jest.mock('@/common/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('mocked-hashed-password'),
  comparePassword: jest.fn().mockResolvedValue(true),
}))

describe('UserService', () => {
  let service: UserService
  let prismaService: PrismaService

  // Mock do PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeEach(async () => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<UserService>(UserService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserProfile', () => {
    it('deve retornar o perfil do usuário com subscription', async () => {
      // Arrange
      const userId = 'user-1'
      const mockUser = {
        id: userId,
        name: 'João',
        email: 'joao@email.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        subscription: {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        },
      }
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      // Act
      const result = await service.getUserProfile(userId)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              id: true,
              status: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
            },
          },
        },
      })
      expect(result.id).toBe(userId)
      expect(result.name).toBe('João')
      expect(result.subscription).toBeDefined()
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = 'nonexistent-user'
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.getUserProfile(userId)).rejects.toThrow(
        NotFoundException
      )
      await expect(service.getUserProfile(userId)).rejects.toThrow(
        'User not found'
      )
    })
  })

  describe('createUser', () => {
    it('deve criar um novo usuário com sucesso', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'João',
        email: 'joao@email.com',
        password: 'password123',
      }
      const mockCreatedUser = {
        id: 'user-1',
        name: 'João',
        email: 'joao@email.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null) // Email não existe
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser)

      // Act
      const result = await service.createUser(createUserDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      })
      expect(hashPassword).toHaveBeenCalledWith('password123')
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'João',
          email: 'joao@email.com',
          password: 'mocked-hashed-password',
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result.name).toBe('João')
      expect(result.email).toBe('joao@email.com')
    })

    it('deve lançar ConflictException quando email já existe', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'João',
        email: 'joao@email.com',
        password: 'password123',
      }
      const existingUser = {
        id: 'existing-user',
        email: 'joao@email.com',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException
      )
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        'Email already exists'
      )
      expect(prismaService.user.create).not.toHaveBeenCalled()
    })
  })

  describe('updateProfile', () => {
    it('deve atualizar o perfil do usuário com sucesso', async () => {
      // Arrange
      const userId = 'user-1'
      const updateUserDto: UpdateUserDto = {
        name: 'João Silva',
        email: 'joao.silva@email.com',
      }
      const existingUser = {
        id: userId,
        name: 'João',
        email: 'joao@email.com',
      }
      const updatedUser = {
        id: userId,
        name: 'João Silva',
        email: 'joao.silva@email.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      // Act
      const result = await service.updateProfile(userId, updateUserDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          name: 'João Silva',
          email: 'joao.silva@email.com',
          updatedAt: expect.any(Date),
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result.name).toBe('João Silva')
      expect(result.email).toBe('joao.silva@email.com')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = 'nonexistent-user'
      const updateUserDto: UpdateUserDto = {
        name: 'João Silva',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.updateProfile(userId, updateUserDto)
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.updateProfile(userId, updateUserDto)
      ).rejects.toThrow('User not found')
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })
  })

  describe('changePassword', () => {
    it('deve alterar a senha com sucesso', async () => {
      // Arrange
      const userId = 'user-1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'oldPassword',
        newPassword: 'newPassword',
      }
      const existingUser = {
        id: userId,
        email: 'joao@email.com',
        password: 'hashed-old-password',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      ;(comparePassword as jest.Mock)
        .mockResolvedValueOnce(true) // Para verificação da senha atual
        .mockResolvedValueOnce(false) // Para verificar se nova senha é diferente

      // Act
      const result = await service.changePassword(userId, changePasswordDto)

      // Assert
      expect(comparePassword).toHaveBeenCalledWith(
        'oldPassword',
        'hashed-old-password'
      )
      expect(comparePassword).toHaveBeenCalledWith(
        'newPassword',
        'hashed-old-password'
      )
      expect(hashPassword).toHaveBeenCalledWith('newPassword')
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: 'mocked-hashed-password',
          updatedAt: expect.any(Date),
        },
      })
      expect(result.message).toBe('Password changed successfully!')
    })

    it('deve lançar UnauthorizedException quando senha atual está incorreta', async () => {
      // Arrange
      const userId = 'user-1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword',
      }
      const existingUser = {
        id: userId,
        email: 'joao@email.com',
        password: 'hashed-old-password',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      ;(comparePassword as jest.Mock).mockResolvedValue(false)

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow('Current password is incorrect')
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando nova senha é igual à atual', async () => {
      // Arrange
      const userId = 'user-1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'samePassword',
        newPassword: 'samePassword',
      }
      const existingUser = {
        id: userId,
        email: 'joao@email.com',
        password: 'hashed-password',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      ;(comparePassword as jest.Mock).mockResolvedValue(true) // Ambas iguais

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(
        'New password must be different from the current password'
      )
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteAccount', () => {
    it('deve deletar a conta do usuário com sucesso', async () => {
      // Arrange
      const userId = 'user-1'
      const existingUser = {
        id: userId,
        email: 'joao@email.com',
        name: 'João',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.delete.mockResolvedValue(existingUser)

      // Act
      const result = await service.deleteAccount(userId)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(result.message).toBe('Account deleted successfully')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = 'nonexistent-user'

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.deleteAccount(userId)).rejects.toThrow(
        NotFoundException
      )
      await expect(service.deleteAccount(userId)).rejects.toThrow(
        'User not found'
      )
      expect(prismaService.user.delete).not.toHaveBeenCalled()
    })
  })
})
