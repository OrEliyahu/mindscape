import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that restricts endpoints to internal / server-to-server calls.
 *
 * Requires an `x-internal-key` header matching the INTERNAL_API_KEY
 * environment variable. If no key is configured, the guard rejects
 * all requests (fail-closed).
 *
 * Viewers never call these endpoints — agents are triggered by
 * backend processes, cron jobs, or admin tooling.
 */
@Injectable()
export class InternalApiGuard implements CanActivate {
  private readonly internalKey: string;

  constructor(private readonly config: ConfigService) {
    this.internalKey = this.config.get<string>('INTERNAL_API_KEY', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const provided = request.headers['x-internal-key'] as string | undefined;

    if (!this.internalKey || provided !== this.internalKey) {
      throw new ForbiddenException('Internal endpoint — not accessible to viewers');
    }

    return true;
  }
}
