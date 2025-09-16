import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator'

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string
}
