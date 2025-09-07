import {
  Controller,
  Get,
  Body,
  Post,
  Put,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { UserService } from './user.service'
import { CreateUserDto } from './dtos/create-user.dto'
import { UpdateUserDto } from './dtos/update-user.dto'
import { ChangePasswordDto } from './dtos/change-password.dto'
import { ParamId } from 'src/decorators/param-id.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { AuthenticatedRequest } from '../auth/types/request.types'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Proteger listagem de usuários - apenas admins
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async getUsers(@Request() req: AuthenticatedRequest) {
    return this.userService.getUsers(req.user.role)
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(@Request() req: AuthenticatedRequest) {
    return this.userService.getUserById(
      req.user.userId,
      req.user.userId,
      req.user.role
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  async getUserById(
    @ParamId() id: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.userService.getUserById(id, req.user.userId, req.user.role)
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateUserProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.userService.updateUser(
      req.user.userId,
      updateUserDto,
      req.user.userId,
      req.user.role
    )
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.userService.changePassword(
      req.user.userId,
      changePasswordDto,
      req.user.userId,
      req.user.role
    )
  }

  // Endpoint público para registro de novos usuários
  @Post('register')
  async registerUser(@Body() user: CreateUserDto) {
    return this.userService.createUser(user, null) // null = registro público
  }

  // Endpoint protegido para admins criarem usuários
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async createUser(
    @Body() user: CreateUserDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.userService.createUser(user, req.user.role)
  }

  // Endpoint protegido para admins criarem outros admins
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin')
  async createAdmin(
    @Body() user: CreateUserDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.userService.createAdmin(user, req.user.role)
  }
}
