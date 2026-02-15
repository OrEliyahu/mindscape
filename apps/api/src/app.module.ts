import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { CanvasModule } from './canvas/canvas.module';
import { NodesModule } from './nodes/nodes.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get<number>('THROTTLE_TTL_MS', 60000),
        limit: config.get<number>('THROTTLE_LIMIT', 120),
      }],
    }),
    DatabaseModule,
    RedisModule,
    CanvasModule,
    NodesModule,
    CollaborationModule,
    AgentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
