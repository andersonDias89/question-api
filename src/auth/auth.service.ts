import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { comparePassword, hashPassword } from 'src/common/password'
import { JwtService } from '@nestjs/jwt'
import { UserResponseDto } from 'src/user/dtos/user-response.dto'
import { ForgotPasswordDto } from './dtos/forgot-password.dto'
import { ResetPasswordDto } from './dtos/reset-password.dto'
import * as crypto from 'crypto'

@Injectable()
export class AuthService {
  // Rate limiting storage (em produção, usar Redis)
  private readonly loginAttempts = new Map<
    string,
    { count: number; lastAttempt: Date }
  >()
  private readonly forgotPasswordAttempts = new Map<
    string,
    { count: number; lastAttempt: Date }
  >()

  // Configurações de rate limiting
  private readonly MAX_LOGIN_ATTEMPTS = 5
  private readonly MAX_FORGOT_PASSWORD_ATTEMPTS = 3
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutos

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {
    // Limpeza automática de tokens expirados a cada hora
    setInterval(
      () => {
        this.cleanupExpiredTokens().catch(error => {
          console.error('Error in cleanup interval:', error)
        })
      },
      60 * 60 * 1000
    )
  }

  async validateUser(
    email: string,
    password: string
  ): Promise<UserResponseDto | null> {
    console.log('Validando usuário:', email) // Debug

    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    console.log('�� Usuário encontrado:', !!user) // Debug

    if (!user) {
      console.log('❌ Usuário não encontrado')
      return null
    }

    const isPasswordValid = await comparePassword(password, user.password)
    console.log('�� Senha válida:', isPasswordValid) // Debug

    if (isPasswordValid) {
      const { password: _, ...result } = user
      console.log('✅ Usuário validado com sucesso')
      return result as UserResponseDto
    }

    console.log('❌ Senha inválida')
    return null
  }

  login(user: UserResponseDto) {
    const payload = { email: user.email, sub: user.id }
    const token = this.jwtService.sign(payload)

    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto

    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Por segurança, sempre retorna sucesso mesmo se o email não existir
      return {
        message:
          'If the email exists, you will receive instructions to reset your password.',
      }
    }

    // Gerar token de reset (plain) e hash para armazenar
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

    // Salvar hash do token no banco
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: resetTokenExpires,
      },
    })

    // TODO: Enviar email com o resetToken (não armazenado em logs)

    return {
      message:
        'If the email exists, you will receive instructions to reset your password.',
    }
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          gt: new Date(), // Token não expirado
        },
      },
    })

    if (!user) {
      throw new BadRequestException('Invalid or expired token')
    }

    // Hash da nova senha
    const hashedPassword = await hashPassword(newPassword)

    // Atualizar senha e limpar tokens
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    })

    return { message: 'Password reset successfully!' }
  }

  // Limpeza automática de tokens expirados
  private async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await this.prisma.user.updateMany({
        where: {
          resetPasswordExpires: {
            lt: new Date(),
          },
        },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      })

      if (result.count > 0) {
        console.log(
          `🧹 Cleaned up ${result.count} expired password reset tokens`
        )
      }
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error)
    }
  }
}
