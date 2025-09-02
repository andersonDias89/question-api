import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common'

export const ParamId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const id: string = request.params.id

    // ✅ Validação UUID
    if (!isValidUUID(id)) {
      throw new BadRequestException('ID must be a valid UUID')
    }

    return id
  }
)

function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
