import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ParamId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.params.id;
});