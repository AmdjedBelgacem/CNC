import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_req: any, _reply: any, next: () => void) {
    next();
  }
}
