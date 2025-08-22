import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword } from 'src/common/password';
import { JwtService } from '@nestjs/jwt';
import { UserResponseDto } from 'src/user/dtos/user-response.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) {}

    async validateUser(email: string, password: string): Promise<UserResponseDto | null> {
        console.log('Validando usuário:', email); // Debug
        
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        
        console.log('�� Usuário encontrado:', !!user); // Debug
        
        if (!user) {
            console.log('❌ Usuário não encontrado');
            return null;
        }

        const isPasswordValid = await comparePassword(password, user.password);
        console.log('�� Senha válida:', isPasswordValid); // Debug
        
        if (isPasswordValid) {
            const { password, ...result } = user;
            console.log('✅ Usuário validado com sucesso');
            return result as UserResponseDto;
        }
        
        console.log('❌ Senha inválida');
        return null;
    }

    async login(user: UserResponseDto) { // Mudar para receber 'user' em vez de 'loginDto'
        const payload = { email: user.email, sub: user.id };
        
        return {
            access_token: this.jwtService.sign(payload), // AQUI o token é criado!
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        };
    }
}
