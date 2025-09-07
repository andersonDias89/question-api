import { ExtractJwt, Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { jwtConfig } from 'src/config/jwt.config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!jwtConfig.secret) {
      throw new InternalServerErrorException('JWT_SECRET não configurado')
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
    })
  }

  validate(payload: any) {
    const user = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    }
    return user
  }
}
