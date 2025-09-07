import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dtos/create-user.dto'
import { UpdateUserDto } from './dtos/update-user.dto'
import { ChangePasswordDto } from './dtos/change-password.dto'
import { UserResponseDto } from './dtos/user-response.dto'
import { hashPassword, comparePassword } from '../common/password'
import { plainToInstance } from 'class-transformer'
import { UserRole } from '../common/enums/user-role.enum'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(currentUserRole: UserRole) {
    // Apenas ADMINs podem listar todos os usuários
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException('Only administrators can list all users')
    }

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return users.map(user => plainToInstance(UserResponseDto, user))
  }

  async getUserById(
    id: string,
    currentUserId: string,
    currentUserRole: UserRole
  ) {
    // USER só pode ver seu próprio perfil, ADMIN pode ver qualquer perfil
    if (currentUserRole === UserRole.USER && currentUserId !== id) {
      throw new UnauthorizedException('Users can only view their own profile')
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('user not found')
    }

    return plainToInstance(UserResponseDto, user)
  }

  async createUser(user: CreateUserDto, currentUserRole: UserRole | null) {
    // Se currentUserRole for null, é um registro público
    // Se não for null, apenas ADMINs podem criar usuários
    if (currentUserRole !== null && currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException('Only administrators can create users')
    }

    const emailExist = await this.prisma.user.findUnique({
      where: { email: user.email },
    })

    if (emailExist) {
      throw new ConflictException('Email already exists')
    }

    const hashedPassword = await hashPassword(user.password)

    const newUser = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: UserRole.USER, // Define role padrão como USER
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

    return plainToInstance(UserResponseDto, newUser)
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    currentUserId: string,
    currentUserRole: UserRole
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // USER só pode atualizar seu próprio nome
    if (currentUserRole === UserRole.USER) {
      if (currentUserId !== userId) {
        throw new UnauthorizedException(
          'Users can only update their own profile'
        )
      }
      // USER só pode alterar o nome
      if (updateUserDto.email || updateUserDto.role) {
        throw new UnauthorizedException('Users can only update their name')
      }
    }

    // ADMIN pode atualizar tudo de qualquer usuário
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateUserDto,
        updatedAt: new Date(),
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

    return plainToInstance(UserResponseDto, updatedUser)
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    currentUserId: string,
    currentUserRole: UserRole
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto

    // USER só pode alterar sua própria senha, ADMIN pode alterar qualquer senha
    if (currentUserRole === UserRole.USER && currentUserId !== userId) {
      throw new UnauthorizedException(
        'Users can only change their own password'
      )
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Se for ADMIN alterando senha de outro usuário, não precisa verificar senha atual
    if (currentUserRole === UserRole.ADMIN && currentUserId !== userId) {
      // ADMIN pode resetar senha diretamente
      const hashedNewPassword = await hashPassword(newPassword)

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      })

      console.log('✅ Password reset by admin for user:', user.email)
      return { message: 'Password reset successfully!' }
    }

    // Para alteração da própria senha (USER ou ADMIN)
    // Verificar senha atual
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.password
    )
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    // Verificar se a nova senha é diferente da atual
    const isSamePassword = await comparePassword(newPassword, user.password)
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password'
      )
    }

    // Hash da nova senha
    const hashedNewPassword = await hashPassword(newPassword)

    // Atualizar senha
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    })

    console.log('✅ Password changed successfully for user:', user.email)

    return { message: 'Password changed successfully!' }
  }

  // Métodos administrativos
  async createAdmin(
    user: CreateUserDto,
    currentUserRole: UserRole
  ): Promise<UserResponseDto> {
    // Apenas ADMINs podem criar outros ADMINs
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        'Only administrators can create administrators'
      )
    }

    const emailExist = await this.prisma.user.findUnique({
      where: { email: user.email },
    })

    if (emailExist) {
      throw new ConflictException('Email already exists')
    }

    const hashedPassword = await hashPassword(user.password)

    const newAdmin = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
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

    return plainToInstance(UserResponseDto, newAdmin)
  }

  async promoteToAdmin(
    userId: string,
    currentUserRole: UserRole
  ): Promise<UserResponseDto> {
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        'Only administrators can promote users to admin'
      )
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('User is already an administrator')
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: UserRole.ADMIN,
        updatedAt: new Date(),
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

    return plainToInstance(UserResponseDto, updatedUser)
  }

  async demoteFromAdmin(
    userId: string,
    currentUserRole: UserRole
  ): Promise<UserResponseDto> {
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        'Only administrators can demote other administrators'
      )
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role === UserRole.USER) {
      throw new BadRequestException('User is already a regular user')
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: UserRole.USER,
        updatedAt: new Date(),
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

    return plainToInstance(UserResponseDto, updatedUser)
  }

  async deleteUser(
    userId: string,
    currentUserRole: UserRole
  ): Promise<{ message: string }> {
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException('Only administrators can delete users')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    await this.prisma.user.delete({
      where: { id: userId },
    })

    return { message: 'User deleted successfully' }
  }

  async getUsersByRole(
    role: UserRole,
    currentUserRole: UserRole
  ): Promise<UserResponseDto[]> {
    // Apenas ADMINs podem buscar usuários por role
    if (currentUserRole !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        'Only administrators can search users by role'
      )
    }

    const users = await this.prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return users.map(user => plainToInstance(UserResponseDto, user))
  }
}
