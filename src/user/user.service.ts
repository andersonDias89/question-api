import { ConflictException, Get, Injectable, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { hashPassword } from '../common/password';
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
}
