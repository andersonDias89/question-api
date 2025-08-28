import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('🛡️ JwtAuthGuard - Verificando autenticação...');
    const request = context.switchToHttp().getRequest();
    console.log('🛡️ JwtAuthGuard - Authorization header:', request.headers.authorization);
    console.log('🛡️ JwtAuthGuard - Headers completos:', request.headers);
    return super.canActivate(context);
  }
}
