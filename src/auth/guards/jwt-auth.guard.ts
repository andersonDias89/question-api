import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('🛡️ JwtAuthGuard - Verificando autenticação...');
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    console.log('🛡️ JwtAuthGuard - Authorization header:', authHeader);

    if (!authHeader) {
      console.log('❌ JwtAuthGuard - Header Authorization não encontrado');
      throw new UnauthorizedException('Authorization header not found');
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ JwtAuthGuard - Header não começa com Bearer');
      throw new UnauthorizedException('Invalid token format');
    }

    const token = authHeader.substring(7);
    if (!token || token.length === 0) {
      console.log('❌ JwtAuthGuard - Token vazio após Bearer');
      throw new UnauthorizedException('Token not provided');
    }

    console.log(
      '✅ JwtAuthGuard - Token encontrado:',
      token.substring(0, 20) + '...',
    );

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    console.log('🔍 JwtAuthGuard - handleRequest');
    console.log('🔍 Error:', err);
    console.log('🔍 User:', user);
    console.log('🔍 Info:', info);

    if (err || !user) {
      console.log('❌ JwtAuthGuard - Falha na autenticação');
      throw err || new UnauthorizedException('Token invalid');
    }

    console.log('✅ JwtAuthGuard - Usuário autenticado com sucesso');
    return user;
  }
}
