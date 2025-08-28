import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig: JwtModuleOptions = {
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: '1h' },
};

export const refreshTokenConfig: JwtModuleOptions = {
  secret: process.env.REFRESH_TOKEN_SECRET,
  signOptions: { expiresIn: '7d' },
};
