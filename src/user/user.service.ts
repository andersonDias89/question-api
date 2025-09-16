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

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ Usuário só pode ver seu próprio perfil
  async getUserProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return plainToInstance(UserResponseDto, user)
  }

  // ✅ Registro público de novos usuários
  async createUser(user: CreateUserDto): Promise<UserResponseDto> {
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
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return plainToInstance(UserResponseDto, newUser)
  }

  // ✅ Usuário só pode atualizar seu próprio perfil
  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Usuário pode atualizar apenas nome e email
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateUserDto.name,
        email: updateUserDto.email,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return plainToInstance(UserResponseDto, updatedUser)
  }

  // ✅ Usuário só pode alterar sua própria senha
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

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

  // ✅ Usuário pode deletar sua própria conta
  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Deletar conta (cascade vai deletar subscription também)
    await this.prisma.user.delete({
      where: { id: userId },
    })

    console.log('✅ Account deleted for user:', user.email)

    return { message: 'Account deleted successfully' }
  }
}
