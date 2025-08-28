import { Expose, Exclude } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Exclude()
  password?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
