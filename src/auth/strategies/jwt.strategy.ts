import { ExtractJwt, Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'
import { jwtConfig } from 'src/config/jwt.config'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret || 'fallback-secret',
    })
  }

  validate(payload: any) {
    console.log('🔍 JWT Strategy - Payload recebido:', payload)
    console.log('🔍 JWT Strategy - payload.sub:', payload.sub)
    console.log('🔍 JWT Strategy - payload.email:', payload.email)

    const user = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    }

    console.log('✅ JWT Strategy - Usuário validado:', user)
    console.log('✅ JWT Strategy - user.userId:', user.userId)
    return user
  }
}
