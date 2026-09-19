import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TwoFactorRequiredGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (!user.twoFactorEnabled) return true;

    const twoFactorVerified = request.headers['x-2fa-verified'];
    if (twoFactorVerified !== 'true') {
      throw new UnauthorizedException('Two-factor authentication required');
    }

    return true;
  }
}
