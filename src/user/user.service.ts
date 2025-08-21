import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { hashPassword } from 'src/common/password';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    async getUsers() {
        return this.prisma.user.findMany();
    }

    async createUser(user: CreateUserDto) {
        const userExists = await this.prisma.user.findUnique({
            where: { email: user.email }
        });
        if (userExists) {
            throw new ConflictException('User already exists');
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
