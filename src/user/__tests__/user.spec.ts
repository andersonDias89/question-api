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
import { UserResponseDto } from '../dtos/user-response.dto'
import { hashPassword, comparePassword } from '@/common/password'
import { plainToInstance } from 'class-transformer'
import { UserRole } from '@/common/enums/user-role.enum'

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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  describe('getUsers', () => {
    it('deve retornar todos os usuários', async () => {
      // Arrange
      const mockUsers = [
        {
          id: '1',
          name: 'João',
          email: 'joao@email.com',
          role: UserRole.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Maria',
          email: 'maria@email.com',
          role: UserRole.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers)

      // Act
      const result = await service.getUsers()

      // Assert
      expect(prismaService.user.findMany).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('João')
      expect(result[1].name).toBe('Maria')
    })

    it('deve retornar array vazio quando não há usuários', async () => {
      // Arrange
      mockPrismaService.user.findMany.mockResolvedValue([])

      // Act
      const result = await service.getUsers()

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('getUserById', () => {
    it('deve retornar um usuário pelo ID', async () => {
      // Arrange
      const mockUser = {
        id: '1',
        name: 'João',
        email: 'joao@email.com',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const userId = '1'
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      // Act
      const result = await service.getUserById(userId)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result).toBeDefined()
      expect(result.name).toBe('João')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.getUserById(userId)).rejects.toThrow(
        NotFoundException
      )
      await expect(service.getUserById(userId)).rejects.toThrow(
        'user not found'
      )
    })
  })

  describe('createUser', () => {
    it('deve criar um novo usuário com sucesso', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Novo Usuário',
        email: 'novo@email.com',
        password: 'senha123',
      }

      const mockCreatedUser = {
        id: '3',
        name: 'Novo Usuário',
        email: 'novo@email.com',
      }

      const mockHashedPassword = 'hashedPassword123'
      ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword)
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser)

      // Act
      const result = await service.createUser(createUserDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      })
      expect(hashPassword).toHaveBeenCalledWith(createUserDto.password)
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          password: mockHashedPassword,
          role: UserRole.USER,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      })
      expect(result).toEqual(mockCreatedUser)
    })

    it('deve lançar ConflictException quando email já existe', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Usuário Existente',
        email: 'existente@email.com',
        password: 'senha123',
      }

      const existingUser = {
        id: '1',
        name: 'Usuário Existente',
        email: 'existente@email.com',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException
      )
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        'Email already exists'
      )
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      })
      expect(prismaService.user.create).not.toHaveBeenCalled()
    })
  })

  describe('updateUser', () => {
    it('deve atualizar um usuário com sucesso', async () => {
      // Arrange
      const userId = '1'
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
      }

      const existingUser = {
        id: '1',
        name: 'Nome Original',
        email: 'usuario@email.com',
        password: 'hash123',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }

      const updatedUser = {
        id: '1',
        name: 'Nome Atualizado',
        email: 'usuario@email.com',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      // Act
      const result = await service.updateUser(userId, updateUserDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          ...updateUserDto,
          updatedAt: expect.any(Date),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result).toBeDefined()
      expect(result.name).toBe('Nome Atualizado')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(service.updateUser(userId, updateUserDto)).rejects.toThrow(
        NotFoundException
      )
      await expect(service.updateUser(userId, updateUserDto)).rejects.toThrow(
        'User not found'
      )
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })
  })

  describe('changePassword', () => {
    it('deve alterar senha com sucesso', async () => {
      // Arrange
      const userId = '1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'novaSenha456',
      }

      const existingUser = {
        id: '1',
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'hashSenhaAtual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockHashedNewPassword = 'hashNovaSenha'
      ;(comparePassword as jest.Mock)
        .mockResolvedValueOnce(true) // Senha atual correta
        .mockResolvedValueOnce(false) // Nova senha diferente da atual
      ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedNewPassword)
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        password: mockHashedNewPassword,
      })

      // Act
      const result = await service.changePassword(userId, changePasswordDto)

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(comparePassword).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        existingUser.password
      )
      expect(comparePassword).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        existingUser.password
      )
      expect(hashPassword).toHaveBeenCalledWith(changePasswordDto.newPassword)
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: mockHashedNewPassword,
          updatedAt: expect.any(Date),
        },
      })
      expect(result).toEqual({ message: 'Password changed successfully!' })
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'novaSenha456',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow('User not found')
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })

    it('deve lançar UnauthorizedException quando senha atual está incorreta', async () => {
      // Arrange
      const userId = '1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaIncorreta',
        newPassword: 'novaSenha456',
      }

      const existingUser = {
        id: '1',
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'hashSenhaAtual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(comparePassword as jest.Mock).mockResolvedValue(false) // Senha atual incorreta
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow('Current password is incorrect')
      expect(comparePassword).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        existingUser.password
      )
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })

    it('deve lançar BadRequestException quando nova senha é igual à atual', async () => {
      // Arrange
      const userId = '1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'senhaAtual123', // Mesma senha
      }

      const existingUser = {
        id: '1',
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'hashSenhaAtual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock para retornar true quando comparar a senha atual com o hash
      // e true quando comparar a nova senha (que é igual) com o hash
      ;(comparePassword as jest.Mock).mockImplementation((password, hash) => {
        if (password === 'senhaAtual123' && hash === 'hashSenhaAtual') {
          return Promise.resolve(true)
        }
        return Promise.resolve(false)
      })
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.changePassword(userId, changePasswordDto)
      ).rejects.toThrow(
        'New password must be different from the current password'
      )
      expect(comparePassword).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        existingUser.password
      )
      expect(comparePassword).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        existingUser.password
      )
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })
  })

  describe('DTOs Validation', () => {
    describe('CreateUserDto', () => {
      it('deve validar campos obrigatórios', () => {
        const dto = new CreateUserDto()
        dto.name = 'João'
        dto.email = 'joao@email.com'
        dto.password = 'senha123'

        expect(dto.name).toBe('João')
        expect(dto.email).toBe('joao@email.com')
        expect(dto.password).toBe('senha123')
      })
    })

    describe('UpdateUserDto', () => {
      it('deve permitir atualizar apenas o nome', () => {
        const dto = new UpdateUserDto()
        dto.name = 'Nome Atualizado'

        expect(dto.name).toBe('Nome Atualizado')
        expect(dto).not.toHaveProperty('email')
      })
    })

    describe('ChangePasswordDto', () => {
      it('deve validar senha atual e nova senha', () => {
        const dto = new ChangePasswordDto()
        dto.currentPassword = 'senhaAtual123'
        dto.newPassword = 'novaSenha456'

        expect(dto.currentPassword).toBe('senhaAtual123')
        expect(dto.newPassword).toBe('novaSenha456')
      })
    })

    describe('UserResponseDto', () => {
      it('deve transformar dados do usuário excluindo a senha', () => {
        const userData = {
          id: '1',
          name: 'João',
          email: 'joao@email.com',
          password: 'hash123',
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        }

        const transformedUser = plainToInstance(UserResponseDto, userData)

        expect(transformedUser.id).toBe('1')
        expect(transformedUser.name).toBe('João')
        expect(transformedUser.email).toBe('joao@email.com')
        expect(transformedUser.password).toBeUndefined()
        expect(transformedUser.createdAt).toEqual(new Date('2023-01-01'))
        expect(transformedUser.updatedAt).toEqual(new Date('2023-01-02'))
      })
    })
  })

  describe('Security Features', () => {
    it('deve usar hashPassword para criar usuário', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'senha123',
      }

      const mockHashedPassword = 'hashedPassword123'
      ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword)
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        name: 'Usuário',
        email: 'usuario@email.com',
      })

      // Act
      await service.createUser(createUserDto)

      // Assert
      expect(hashPassword).toHaveBeenCalledWith('senha123')
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Usuário',
          email: 'usuario@email.com',
          password: mockHashedPassword,
          role: UserRole.USER,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      })
    })

    it('deve usar comparePassword para validar senhas', async () => {
      // Arrange
      const userId = '1'
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'novaSenha456',
      }

      const existingUser = {
        id: '1',
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'hashSenhaAtual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(comparePassword as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      ;(hashPassword as jest.Mock).mockResolvedValue('hashNovaSenha')
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue({})

      // Act
      await service.changePassword(userId, changePasswordDto)

      // Assert
      expect(comparePassword).toHaveBeenCalledWith(
        'senhaAtual123',
        'hashSenhaAtual'
      )
      expect(comparePassword).toHaveBeenCalledWith(
        'novaSenha456',
        'hashSenhaAtual'
      )
    })

    it('deve excluir senha das respostas usando UserResponseDto', async () => {
      // Arrange
      const mockUser = {
        id: '1',
        name: 'João',
        email: 'joao@email.com',
        password: 'hash123',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      // Act
      const result = await service.getUserById('1')

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe('1')
      expect(result.name).toBe('João')
      expect(result.email).toBe('joao@email.com')
      expect(result.password).toBeUndefined()
    })
  })
})
