import { Controller, Get, Body, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dtos/create-user.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    async getUsers() {
        return this.userService.getUsers();
    }
    
    @Post()
    async createUser(@Body() user: CreateUserDto) {
        return this.userService.createUser(user);
    }
}
