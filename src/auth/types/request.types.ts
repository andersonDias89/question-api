import { Request } from 'express'
import { UserRole } from '../../common/enums/user-role.enum'

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string
    email: string
    name?: string
    role: UserRole
  }
}

export interface LoginRequest extends Request {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    createdAt: Date
    updatedAt: Date
  }
}
