import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Impersonating = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.impersonating || null;
  },
);
