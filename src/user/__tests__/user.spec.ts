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

  describe('getUsers', () => {
    it('deve retornar todos os usuários quando executado por ADMIN', async () => {
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
      const result = await service.getUsers(UserRole.ADMIN)

      // Assert
      expect(prismaService.user.findMany).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('João')
      expect(result[1].name).toBe('Maria')
    })

    it('deve lançar UnauthorizedException quando USER tenta listar usuários', async () => {
      // Act & Assert
      await expect(service.getUsers(UserRole.USER)).rejects.toThrow(
        UnauthorizedException
      )
      await expect(service.getUsers(UserRole.USER)).rejects.toThrow(
        'Only administrators can list all users'
      )
    })

    it('deve retornar array vazio quando não há usuários (ADMIN)', async () => {
      // Arrange
      mockPrismaService.user.findMany.mockResolvedValue([])

      // Act
      const result = await service.getUsers(UserRole.ADMIN)

      // Assert
      expect(result).toHaveLength(0)
    })
  })

  describe('getUserById', () => {
    it('deve retornar um usuário pelo ID quando ADMIN acessa qualquer perfil', async () => {
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
      const currentUserId = '2' // Admin diferente
      const currentUserRole = UserRole.ADMIN
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      // Act
      const result = await service.getUserById(
        userId,
        currentUserId,
        currentUserRole
      )

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

    it('deve retornar usuário quando USER acessa seu próprio perfil', async () => {
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
      const currentUserId = '1' // Mesmo usuário
      const currentUserRole = UserRole.USER
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      // Act
      const result = await service.getUserById(
        userId,
        currentUserId,
        currentUserRole
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.name).toBe('João')
    })

    it('deve lançar UnauthorizedException quando USER tenta acessar perfil de outro', async () => {
      // Arrange
      const userId = '2'
      const currentUserId = '1' // Usuário diferente
      const currentUserRole = UserRole.USER

      // Act & Assert
      await expect(
        service.getUserById(userId, currentUserId, currentUserRole)
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.getUserById(userId, currentUserId, currentUserRole)
      ).rejects.toThrow('Users can only view their own profile')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      const currentUserId = '999'
      const currentUserRole = UserRole.USER
      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.getUserById(userId, currentUserId, currentUserRole)
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.getUserById(userId, currentUserId, currentUserRole)
      ).rejects.toThrow('user not found')
    })
  })

  describe('createUser', () => {
    it('deve criar um novo usuário quando executado por ADMIN', async () => {
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
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockHashedPassword = 'hashedPassword123'
      ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword)
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser)

      // Act
      const result = await service.createUser(createUserDto, UserRole.ADMIN)

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
          createdAt: true,
          updatedAt: true,
        },
      })
      expect(result).toBeDefined()
    })

    it('deve lançar UnauthorizedException quando USER tenta criar usuário', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Novo Usuário',
        email: 'novo@email.com',
        password: 'senha123',
      }

      // Act & Assert
      await expect(
        service.createUser(createUserDto, UserRole.USER)
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.createUser(createUserDto, UserRole.USER)
      ).rejects.toThrow('Only administrators can create users')
    })

    it('deve lançar ConflictException quando email já existe (ADMIN)', async () => {
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
      await expect(
        service.createUser(createUserDto, UserRole.ADMIN)
      ).rejects.toThrow(ConflictException)
      await expect(
        service.createUser(createUserDto, UserRole.ADMIN)
      ).rejects.toThrow('Email already exists')
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      })
      expect(prismaService.user.create).not.toHaveBeenCalled()
    })
  })

  describe('updateUser', () => {
    it('deve permitir ADMIN atualizar qualquer usuário com todos os campos', async () => {
      // Arrange
      const userId = '1'
      const currentUserId = '2' // Admin diferente
      const currentUserRole = UserRole.ADMIN
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
        email: 'novo@email.com',
        role: UserRole.ADMIN,
      }

      const existingUser = {
        id: '1',
        name: 'Nome Original',
        email: 'usuario@email.com',
        password: 'hash123',
        role: UserRole.USER,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }

      const updatedUser = {
        id: '1',
        name: 'Nome Atualizado',
        email: 'novo@email.com',
        role: UserRole.ADMIN,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      // Act
      const result = await service.updateUser(
        userId,
        updateUserDto,
        currentUserId,
        currentUserRole
      )

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

    it('deve permitir USER atualizar apenas seu próprio nome', async () => {
      // Arrange
      const userId = '1'
      const currentUserId = '1' // Mesmo usuário
      const currentUserRole = UserRole.USER
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
      }

      const existingUser = {
        id: '1',
        name: 'Nome Original',
        email: 'usuario@email.com',
        password: 'hash123',
        role: UserRole.USER,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      }

      const updatedUser = {
        id: '1',
        name: 'Nome Atualizado',
        email: 'usuario@email.com',
        role: UserRole.USER,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue(updatedUser)

      // Act
      const result = await service.updateUser(
        userId,
        updateUserDto,
        currentUserId,
        currentUserRole
      )

      // Assert
      expect(result).toBeDefined()
      expect(result.name).toBe('Nome Atualizado')
    })

    it('deve lançar UnauthorizedException quando USER tenta atualizar outro usuário', async () => {
      // Arrange
      const userId = '2'
      const currentUserId = '1' // Usuário diferente
      const currentUserRole = UserRole.USER
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
      }

      const existingUser = {
        id: '2',
        name: 'Nome Original',
        email: 'usuario@email.com',
        password: 'hash123',
        role: UserRole.USER,
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow('Users can only update their own profile')
    })

    it('deve lançar UnauthorizedException quando USER tenta alterar email ou role', async () => {
      // Arrange
      const userId = '1'
      const currentUserId = '1' // Mesmo usuário
      const currentUserRole = UserRole.USER
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
        email: 'novo@email.com', // USER não pode alterar email
      }

      const existingUser = {
        id: '1',
        name: 'Nome Original',
        email: 'usuario@email.com',
        password: 'hash123',
        role: UserRole.USER,
      }

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow('Users can only update their name')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      const currentUserId = '999'
      const currentUserRole = UserRole.USER
      const updateUserDto: UpdateUserDto = {
        name: 'Nome Atualizado',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.updateUser(
          userId,
          updateUserDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow('User not found')
    })
  })

  describe('changePassword', () => {
    it('deve alterar própria senha com sucesso (USER)', async () => {
      // Arrange
      const userId = '1'
      const currentUserId = '1' // Mesmo usuário
      const currentUserRole = UserRole.USER
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
      const result = await service.changePassword(
        userId,
        changePasswordDto,
        currentUserId,
        currentUserRole
      )

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

    it('deve permitir ADMIN resetar senha de outro usuário sem verificar senha atual', async () => {
      // Arrange
      const userId = '2'
      const currentUserId = '1' // Admin diferente
      const currentUserRole = UserRole.ADMIN
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'qualquerSenha', // Será ignorada
        newPassword: 'novaSenha456',
      }

      const existingUser = {
        id: '2',
        name: 'Usuário',
        email: 'usuario@email.com',
        password: 'hashSenhaAtual',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockHashedNewPassword = 'hashNovaSenha'
      ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedNewPassword)
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        password: mockHashedNewPassword,
      })

      // Act
      const result = await service.changePassword(
        userId,
        changePasswordDto,
        currentUserId,
        currentUserRole
      )

      // Assert
      expect(hashPassword).toHaveBeenCalledWith(changePasswordDto.newPassword)
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: mockHashedNewPassword,
          updatedAt: expect.any(Date),
        },
      })
      expect(result).toEqual({ message: 'Password reset successfully!' })
      // Não deve verificar senha atual quando admin reseta
      expect(comparePassword).not.toHaveBeenCalled()
    })

    it('deve lançar UnauthorizedException quando USER tenta alterar senha de outro', async () => {
      // Arrange
      const userId = '2'
      const currentUserId = '1' // Usuário diferente
      const currentUserRole = UserRole.USER
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'novaSenha456',
      }

      // Act & Assert
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow('Users can only change their own password')
    })

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999'
      const currentUserId = '999'
      const currentUserRole = UserRole.USER
      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'senhaAtual123',
        newPassword: 'novaSenha456',
      }

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow('User not found')
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      })
      expect(prismaService.user.update).not.toHaveBeenCalled()
    })

    it('deve lançar UnauthorizedException quando senha atual está incorreta', async () => {
      // Arrange
      const userId = '1'
      const currentUserId = '1'
      const currentUserRole = UserRole.USER
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
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(UnauthorizedException)
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
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
      const currentUserId = '1'
      const currentUserRole = UserRole.USER
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
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.changePassword(
          userId,
          changePasswordDto,
          currentUserId,
          currentUserRole
        )
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
        expect(dto.email).toBeUndefined()
        expect(dto.role).toBeUndefined()
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
      await service.createUser(createUserDto, UserRole.ADMIN)

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
          createdAt: true,
          updatedAt: true,
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
      await service.changePassword(
        userId,
        changePasswordDto,
        userId,
        UserRole.USER
      )

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
      const result = await service.getUserById('1', '1', UserRole.USER)

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe('1')
      expect(result.name).toBe('João')
      expect(result.email).toBe('joao@email.com')
      expect(result.password).toBeUndefined()
    })
  })

  describe('Administrative Features', () => {
    describe('createAdmin', () => {
      it('deve criar um administrador quando executado por ADMIN', async () => {
        // Arrange
        const createUserDto: CreateUserDto = {
          name: 'Admin User',
          email: 'admin@email.com',
          password: 'admin123',
        }

        const mockCreatedAdmin = {
          id: '1',
          name: 'Admin User',
          email: 'admin@email.com',
          role: UserRole.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const mockHashedPassword = 'hashedAdminPassword123'
        ;(hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword)
        mockPrismaService.user.findUnique.mockResolvedValue(null)
        mockPrismaService.user.create.mockResolvedValue(mockCreatedAdmin)

        // Act
        const result = await service.createAdmin(createUserDto, UserRole.ADMIN)

        // Assert
        expect(prismaService.user.create).toHaveBeenCalledWith({
          data: {
            name: createUserDto.name,
            email: createUserDto.email,
            password: mockHashedPassword,
            role: UserRole.ADMIN,
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
        expect(result.role).toBe(UserRole.ADMIN)
      })

      it('deve lançar UnauthorizedException quando USER tenta criar admin', async () => {
        // Arrange
        const createUserDto: CreateUserDto = {
          name: 'Admin User',
          email: 'admin@email.com',
          password: 'admin123',
        }

        // Act & Assert
        await expect(
          service.createAdmin(createUserDto, UserRole.USER)
        ).rejects.toThrow(UnauthorizedException)
        await expect(
          service.createAdmin(createUserDto, UserRole.USER)
        ).rejects.toThrow('Only administrators can create administrators')
      })

      it('deve lançar ConflictException quando email do admin já existe', async () => {
        // Arrange
        const createUserDto: CreateUserDto = {
          name: 'Admin Existente',
          email: 'admin.existente@email.com',
          password: 'admin123',
        }

        const existingUser = {
          id: '1',
          name: 'Admin Existente',
          email: 'admin.existente@email.com',
          role: UserRole.USER,
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

        // Act & Assert
        await expect(
          service.createAdmin(createUserDto, UserRole.ADMIN)
        ).rejects.toThrow(ConflictException)
        await expect(
          service.createAdmin(createUserDto, UserRole.ADMIN)
        ).rejects.toThrow('Email already exists')
      })
    })

    describe('promoteToAdmin', () => {
      it('deve promover usuário a administrador quando executado por admin', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.ADMIN

        const existingUser = {
          id: '2',
          name: 'User Normal',
          email: 'user@email.com',
          role: UserRole.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const promotedUser = {
          ...existingUser,
          role: UserRole.ADMIN,
          updatedAt: new Date(),
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
        mockPrismaService.user.update.mockResolvedValue(promotedUser)

        // Act
        const result = await service.promoteToAdmin(userId, currentUserRole)

        // Assert
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: {
            role: UserRole.ADMIN,
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
        expect(result.role).toBe(UserRole.ADMIN)
      })

      it('deve lançar UnauthorizedException quando usuário comum tenta promover', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.USER

        // Act & Assert
        await expect(
          service.promoteToAdmin(userId, currentUserRole)
        ).rejects.toThrow(UnauthorizedException)
        await expect(
          service.promoteToAdmin(userId, currentUserRole)
        ).rejects.toThrow('Only administrators can promote users to admin')
      })

      it('deve lançar BadRequestException quando usuário já é admin', async () => {
        // Arrange
        const userId = '1'
        const currentUserRole = UserRole.ADMIN

        const existingAdmin = {
          id: '1',
          name: 'Admin Existente',
          email: 'admin@email.com',
          role: UserRole.ADMIN,
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingAdmin)

        // Act & Assert
        await expect(
          service.promoteToAdmin(userId, currentUserRole)
        ).rejects.toThrow(BadRequestException)
        await expect(
          service.promoteToAdmin(userId, currentUserRole)
        ).rejects.toThrow('User is already an administrator')
      })
    })

    describe('demoteFromAdmin', () => {
      it('deve rebaixar administrador para usuário comum quando executado por admin', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.ADMIN

        const existingAdmin = {
          id: '2',
          name: 'Admin User',
          email: 'admin@email.com',
          role: UserRole.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const demotedUser = {
          ...existingAdmin,
          role: UserRole.USER,
          updatedAt: new Date(),
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingAdmin)
        mockPrismaService.user.update.mockResolvedValue(demotedUser)

        // Act
        const result = await service.demoteFromAdmin(userId, currentUserRole)

        // Assert
        expect(prismaService.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: {
            role: UserRole.USER,
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
        expect(result.role).toBe(UserRole.USER)
      })

      it('deve lançar UnauthorizedException quando usuário comum tenta rebaixar', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.USER

        // Act & Assert
        await expect(
          service.demoteFromAdmin(userId, currentUserRole)
        ).rejects.toThrow(UnauthorizedException)
        await expect(
          service.demoteFromAdmin(userId, currentUserRole)
        ).rejects.toThrow('Only administrators can demote other administrators')
      })

      it('deve lançar BadRequestException quando usuário já é comum', async () => {
        // Arrange
        const userId = '1'
        const currentUserRole = UserRole.ADMIN

        const existingUser = {
          id: '1',
          name: 'User Comum',
          email: 'user@email.com',
          role: UserRole.USER,
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingUser)

        // Act & Assert
        await expect(
          service.demoteFromAdmin(userId, currentUserRole)
        ).rejects.toThrow(BadRequestException)
        await expect(
          service.demoteFromAdmin(userId, currentUserRole)
        ).rejects.toThrow('User is already a regular user')
      })
    })

    describe('deleteUser', () => {
      it('deve deletar usuário quando executado por administrador', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.ADMIN

        const existingUser = {
          id: '2',
          name: 'User Para Deletar',
          email: 'delete@email.com',
          role: UserRole.USER,
        }

        mockPrismaService.user.findUnique.mockResolvedValue(existingUser)
        mockPrismaService.user.delete.mockResolvedValue(existingUser)

        // Act
        const result = await service.deleteUser(userId, currentUserRole)

        // Assert
        expect(prismaService.user.delete).toHaveBeenCalledWith({
          where: { id: userId },
        })
        expect(result).toEqual({ message: 'User deleted successfully' })
      })

      it('deve lançar UnauthorizedException quando usuário comum tenta deletar', async () => {
        // Arrange
        const userId = '2'
        const currentUserRole = UserRole.USER

        // Act & Assert
        await expect(
          service.deleteUser(userId, currentUserRole)
        ).rejects.toThrow(UnauthorizedException)
        await expect(
          service.deleteUser(userId, currentUserRole)
        ).rejects.toThrow('Only administrators can delete users')
      })

      it('deve lançar NotFoundException quando usuário não existe', async () => {
        // Arrange
        const userId = '999'
        const currentUserRole = UserRole.ADMIN

        mockPrismaService.user.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(
          service.deleteUser(userId, currentUserRole)
        ).rejects.toThrow(NotFoundException)
        await expect(
          service.deleteUser(userId, currentUserRole)
        ).rejects.toThrow('User not found')
      })
    })

    describe('getUsersByRole', () => {
      it('deve retornar apenas usuários com role USER quando executado por ADMIN', async () => {
        // Arrange
        const mockUsers = [
          {
            id: '1',
            name: 'User 1',
            email: 'user1@email.com',
            role: UserRole.USER,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            name: 'User 2',
            email: 'user2@email.com',
            role: UserRole.USER,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]

        mockPrismaService.user.findMany.mockResolvedValue(mockUsers)

        // Act
        const result = await service.getUsersByRole(
          UserRole.USER,
          UserRole.ADMIN
        )

        // Assert
        expect(prismaService.user.findMany).toHaveBeenCalledWith({
          where: { role: UserRole.USER },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        })
        expect(result).toHaveLength(2)
        expect(result[0].role).toBe(UserRole.USER)
        expect(result[1].role).toBe(UserRole.USER)
      })

      it('deve retornar apenas usuários com role ADMIN quando executado por ADMIN', async () => {
        // Arrange
        const mockAdmins = [
          {
            id: '1',
            name: 'Admin 1',
            email: 'admin1@email.com',
            role: UserRole.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]

        mockPrismaService.user.findMany.mockResolvedValue(mockAdmins)

        // Act
        const result = await service.getUsersByRole(
          UserRole.ADMIN,
          UserRole.ADMIN
        )

        // Assert
        expect(prismaService.user.findMany).toHaveBeenCalledWith({
          where: { role: UserRole.ADMIN },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        })
        expect(result).toHaveLength(1)
        expect(result[0].role).toBe(UserRole.ADMIN)
      })

      it('deve lançar UnauthorizedException quando USER tenta buscar por role', async () => {
        // Act & Assert
        await expect(
          service.getUsersByRole(UserRole.USER, UserRole.USER)
        ).rejects.toThrow(UnauthorizedException)
        await expect(
          service.getUsersByRole(UserRole.USER, UserRole.USER)
        ).rejects.toThrow('Only administrators can search users by role')
      })

      it('deve retornar array vazio quando não há usuários com o role especificado (ADMIN)', async () => {
        // Arrange
        mockPrismaService.user.findMany.mockResolvedValue([])

        // Act
        const result = await service.getUsersByRole(
          UserRole.ADMIN,
          UserRole.ADMIN
        )

        // Assert
        expect(result).toHaveLength(0)
      })
    })
  })

  describe('Role Validation Tests', () => {
    it('deve criar usuário comum com role USER por padrão', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Novo Usuário',
        email: 'novo@email.com',
        password: 'senha123',
      }

      const mockCreatedUser = {
        id: '1',
        name: 'Novo Usuário',
        email: 'novo@email.com',
        role: UserRole.USER,
      }

      ;(hashPassword as jest.Mock).mockResolvedValue('hashedPassword')
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser)

      // Act
      const result = await service.createUser(createUserDto, UserRole.ADMIN)

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.USER,
          }),
        })
      )
      expect(result.role).toBe(UserRole.USER)
    })

    it('deve validar que operações administrativas só são permitidas para ADMIN', async () => {
      // Test promoteToAdmin com usuário comum
      await expect(
        service.promoteToAdmin('user1', UserRole.USER)
      ).rejects.toThrow(UnauthorizedException)

      // Test demoteFromAdmin com usuário comum
      await expect(
        service.demoteFromAdmin('admin1', UserRole.USER)
      ).rejects.toThrow(UnauthorizedException)

      // Test deleteUser com usuário comum
      await expect(service.deleteUser('user1', UserRole.USER)).rejects.toThrow(
        UnauthorizedException
      )
    })

    it('deve permitir operações administrativas apenas para ADMIN', async () => {
      // Arrange - Setup para promoteToAdmin
      const userToPromote = {
        id: '2',
        name: 'User',
        email: 'user@email.com',
        role: UserRole.USER,
      }

      const promotedUser = { ...userToPromote, role: UserRole.ADMIN }

      mockPrismaService.user.findUnique.mockResolvedValue(userToPromote)
      mockPrismaService.user.update.mockResolvedValue(promotedUser)

      // Act & Assert - promoteToAdmin deve funcionar para ADMIN
      const result = await service.promoteToAdmin('2', UserRole.ADMIN)
      expect(result.role).toBe(UserRole.ADMIN)

      // Verify que foi chamado
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '2' },
      })
    })
  })
})
