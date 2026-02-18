import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminPasswordGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const configured = this.config.get<string>('ADMIN_PANEL_PASSWORD', '').trim();
    if (!configured) {
      throw new UnauthorizedException('Admin password is not configured');
    }

    const incoming = (request.headers['x-admin-password'] ?? '').trim();
    if (!incoming || incoming !== configured) {
      throw new UnauthorizedException('Invalid admin password');
    }

    return true;
  }
}
