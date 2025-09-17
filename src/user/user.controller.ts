import {
  Controller,
  Get,
  Body,
  Post,
  Put,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { UserService } from './user.service'
import { CreateUserDto } from './dtos/create-user.dto'
import { UpdateUserDto } from './dtos/update-user.dto'
import { ChangePasswordDto } from './dtos/change-password.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AuthenticatedRequest } from '../auth/types/request.types'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ✅ Endpoint público para registro de novos usuários
  @Post('register')
  async registerUser(@Body() user: CreateUserDto) {
    return this.userService.createUser(user)
  }

  // ✅ Usuário vê apenas seu próprio perfil
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(@Request() req: AuthenticatedRequest) {
    return this.userService.getUserProfile(req.user.userId)
  }

  // ✅ Usuário atualiza apenas seu próprio perfil
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateUserProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.userService.updateProfile(req.user.userId, updateUserDto)
  }

  // ✅ Usuário altera apenas sua própria senha
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.userService.changePassword(req.user.userId, changePasswordDto)
  }

  // ✅ Usuário pode deletar sua própria conta
  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Request() req: AuthenticatedRequest) {
    return this.userService.deleteAccount(req.user.userId)
  }
}
