import { Expose, Exclude } from 'class-transformer'
import { UserRole } from '../../common/enums/user-role.enum'

export class UserResponseDto {
  @Expose()
  id: string

  @Expose()
  name: string

  @Expose()
  email: string

  @Expose()
  role: UserRole

  @Exclude()
  password?: string

  @Expose()
  createdAt: Date

  @Expose()
  updatedAt: Date
}
