import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { PG_POOL } from '../database/database.provider';
import type { AuthTokens, AuthenticatedUser } from './auth.types';
import type { SignOptions } from 'jsonwebtoken';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pg: Pool,
    private readonly config: ConfigService,
  ) {}

  async signup(email: string, name: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    const existing = await this.pg.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await hash(password, 10);

    const { rows } = await this.pg.query<UserRow>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, password_hash`,
      [normalizedEmail, normalizedName, passwordHash],
    );

    const user = rows[0];
    const tokens = await this.issueTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const { rows } = await this.pg.query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [normalizedEmail],
    );
    const user = rows[0];

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await compare(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    const hashed = this.hashToken(refreshToken);

    const { rows } = await this.pg.query<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM user_sessions
       WHERE refresh_token_hash = $1`,
      [hashed],
    );

    const session = rows[0];
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (session.user_id !== payload.sub) {
      throw new UnauthorizedException('Refresh token user mismatch');
    }

    await this.pg.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1', [session.id]);

    const user = await this.findUserById(payload.sub);
    const tokens = await this.issueTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async me(userId: string) {
    const user = await this.findUserById(userId);
    return this.toPublicUser(user);
  }

  private async findUserById(userId: string): Promise<UserRow> {
    const { rows } = await this.pg.query<UserRow>(
      'SELECT id, email, name, password_hash FROM users WHERE id = $1',
      [userId],
    );

    if (!rows.length) {
      throw new UnauthorizedException('User not found');
    }

    return rows[0];
  }

  private async issueTokens(user: UserRow): Promise<AuthTokens> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');

    const jwtPayload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = jwt.sign(jwtPayload, accessSecret, {
      expiresIn: accessTtl as SignOptions['expiresIn'],
    });
    const refreshToken = jwt.sign({ sub: user.id }, refreshSecret, {
      expiresIn: refreshTtl as SignOptions['expiresIn'],
    });

    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = this.getJwtExpiryDate(refreshToken, refreshSecret);

    await this.pg.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshTokenHash, expiresAt],
    );

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(token: string): { sub: string } {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');

    try {
      const decoded = jwt.verify(token, refreshSecret) as { sub: string };
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getJwtExpiryDate(token: string, secret: string): Date {
    const decoded = jwt.verify(token, secret) as { exp?: number };
    if (!decoded.exp) {
      throw new UnauthorizedException('Token expiry missing');
    }

    return new Date(decoded.exp * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: UserRow) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
