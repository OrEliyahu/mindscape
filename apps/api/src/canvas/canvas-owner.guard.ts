import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.provider';

interface AuthRequest {
  params: Record<string, string | undefined>;
  user?: { sub: string };
}

@Injectable()
export class CanvasOwnerGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const canvasId = req.params.canvasId ?? req.params.id;
    if (!canvasId) {
      throw new ForbiddenException('Canvas id is required');
    }

    const { rows } = await this.pg.query<{ owner_id: string | null }>(
      'SELECT owner_id FROM canvases WHERE id = $1',
      [canvasId],
    );

    if (!rows.length) {
      throw new ForbiddenException('Canvas not found');
    }

    if (!rows[0].owner_id || rows[0].owner_id !== userId) {
      throw new ForbiddenException('Only the canvas owner can perform this action');
    }

    return true;
  }
}
