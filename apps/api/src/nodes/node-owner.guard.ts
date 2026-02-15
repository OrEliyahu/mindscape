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
export class NodeOwnerGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pg: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const nodeId = req.params.id;
    if (!nodeId) {
      throw new ForbiddenException('Node id is required');
    }

    const { rows } = await this.pg.query<{ owner_id: string | null }>(
      `SELECT c.owner_id
       FROM nodes n
       JOIN canvases c ON c.id = n.canvas_id
       WHERE n.id = $1`,
      [nodeId],
    );

    if (!rows.length || !rows[0].owner_id || rows[0].owner_id !== userId) {
      throw new ForbiddenException('Only the canvas owner can modify this node');
    }

    return true;
  }
}
