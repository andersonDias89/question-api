import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword, hashPassword } from 'src/common/password';
import { JwtService } from '@nestjs/jwt';
import { UserResponseDto } from 'src/user/dtos/user-response.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import * as crypto from 'crypto';

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

    async login(user: UserResponseDto) { 
        const payload = { email: user.email, sub: user.id };
        const token = this.jwtService.sign(payload);
        
        console.log('🔑 AuthService - Payload do token:', payload);
        console.log('🔑 AuthService - Token gerado:', token);
        
        return {
            access_token: token, 
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        };
    }

    async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
        const { email } = forgotPasswordDto;
        
        const user = await this.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Por segurança, sempre retorna sucesso mesmo se o email não existir
            return { message: 'If the email exists, you will receive instructions to reset your password.' };
        }

        // Gerar token de reset
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

        // Salvar token no banco
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpires: resetTokenExpires
            }
        });

        // TODO: Aqui você enviaria o email com o token
        // Para desenvolvimento, vou logar o token
        console.log('🔑 Reset Password Token para', email, ':', resetToken);
        console.log('🔗 Link de reset: http://localhost:3000/auth/reset-password?token=' + resetToken);

        return { message: 'If the email exists, you will receive instructions to reset your password.' };
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
        const { token, newPassword } = resetPasswordDto;

        const user = await this.prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date() // Token não expirado
                }
            }
        });

        if (!user) {
            throw new BadRequestException('Invalid or expired token');
        }

        // Hash da nova senha
        const hashedPassword = await hashPassword(newPassword);

        // Atualizar senha e limpar tokens
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        console.log('✅ Senha redefinida com sucesso para:', user.email);

        return { message: 'Password reset successfully!' };
    }
}
