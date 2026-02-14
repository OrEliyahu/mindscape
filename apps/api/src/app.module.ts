import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    DatabaseModule,
    RedisModule,
    CanvasModule,
    NodesModule,
    CollaborationModule,
    AgentModule,
  ],
})
export class AppModule {}
