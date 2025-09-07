import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum } from 'class-validator'
import { UserRole } from '@/common/enums/user-role.enum'

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole
}
