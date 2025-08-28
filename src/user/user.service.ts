import { ConflictException, Get, Injectable, NotFoundException, Param, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { hashPassword, comparePassword } from '../common/password';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    async getUsers() {
        const users = await this.prisma.user.findMany();
        return users.map(user => plainToInstance(UserResponseDto, user));
    }

    async getUserById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            throw new NotFoundException('user not found');
        }

        return plainToInstance(UserResponseDto, user);
    }
    
       
    async createUser(user: CreateUserDto) {
        const emailExist = await this.prisma.user.findUnique({
            where: { email: user.email }
        });

        if (emailExist) {
            throw new ConflictException('Email already exists');
        }

        const hashedPassword = await hashPassword(user.password);

        const newUser = await this.prisma.user.create({
            data: {
                name: user.name,
                email: user.email,
                password: hashedPassword
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        });

        return newUser;
    }

    async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...updateUserDto,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return plainToInstance(UserResponseDto, updatedUser);
    }

    async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
        const { currentPassword, newPassword } = changePasswordDto;

        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verificar senha atual
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Verificar se a nova senha é diferente da atual
        const isSamePassword = await comparePassword(newPassword, user.password);
        if (isSamePassword) {
            throw new BadRequestException('New password must be different from the current password');
        }

        // Hash da nova senha
        const hashedNewPassword = await hashPassword(newPassword);

        // Atualizar senha
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedNewPassword,
                updatedAt: new Date()
            }
        });

        console.log('✅ Password changed successfully for user:', user.email);

        return { message: 'Password changed successfully!' };
    }
}
