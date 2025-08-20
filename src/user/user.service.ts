import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    async getUsers() {
        return this.prisma.user.findMany();
    }

    async createUser(user: CreateUserDto) {
        return this.prisma.user.create({
            data: user,
        });
    }
}
