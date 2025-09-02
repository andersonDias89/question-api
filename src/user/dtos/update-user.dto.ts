import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string
}
