import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found')
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format')
    }

    const token = authHeader.substring(7)
    if (!token || token.length === 0) {
      throw new UnauthorizedException('Token not provided')
    }

    return super.canActivate(context)
  }

  handleRequest(err, user, _info) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token invalid')
    }
    return user
  }
}
