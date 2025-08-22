import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dtos/create-user.dto';
import { hashPassword } from '../common/password';

// Mock da função hashPassword
jest.mock('../common/password', () => ({
  hashPassword: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  // Mock do PrismaService
  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('deve retornar todos os usuários', async () => {
      // Arrange
      const mockUsers = [
        { id: '1', name: 'João', email: 'joao@email.com', password: 'hash123', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Maria', email: 'maria@email.com', password: 'hash456', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      // Act
      const result = await service.getUsers();

      // Assert
      expect(prismaService.user.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('João');
      expect(result[1].name).toBe('Maria');
    });

    it('deve retornar array vazio quando não há usuários', async () => {
      // Arrange
      mockPrismaService.user.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getUsers();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getUserById', () => {
    it('deve retornar um usuário pelo ID', async () => {
      // Arrange
      const mockUser = { 
        id: '1', 
        name: 'João', 
        email: 'joao@email.com', 
        password: 'hash123',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const userId = '1';
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserById(userId);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toBeDefined();
      expect(result.name).toBe('João');
    });

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      // Arrange
      const userId = '999';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserById(userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserById(userId)).rejects.toThrow(
        'user not found',
      );
    });
  });

  describe('createUser', () => {
    it('deve criar um novo usuário com sucesso', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Novo Usuário',
        email: 'novo@email.com',
        password: 'senha123',
      };

      const mockCreatedUser = {
        id: '3',
        name: 'Novo Usuário',
        email: 'novo@email.com',
      };

      const mockHashedPassword = 'hashedPassword123';
      (hashPassword as jest.Mock).mockResolvedValue(mockHashedPassword);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await service.createUser(createUserDto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(hashPassword).toHaveBeenCalledWith(createUserDto.password);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          password: mockHashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      expect(result).toEqual(mockCreatedUser);
    });

    it('deve lançar ConflictException quando email já existe', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        name: 'Usuário Existente',
        email: 'existente@email.com',
        password: 'senha123',
      };

      const existingUser = {
        id: '1',
        name: 'Usuário Existente',
        email: 'existente@email.com',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        'Email already exists',
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });
});