import { Controller, Get, Body, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { ParamId } from 'src/decorators/param-id.decorator';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    async getUsers() {
        return this.userService.getUsers();
    }

    @Get(':id')
    async getUserById(@ParamId() id: string) {
        return this.userService.getUserById(id);
    }
    
    @Post()
    async createUser(@Body() user: CreateUserDto) {
        return this.userService.createUser(user);
    }
}
