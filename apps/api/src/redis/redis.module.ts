import { Module, Global } from '@nestjs/common';
import { REDIS_PROVIDER } from './redis.provider';

@Global()
@Module({
  providers: [REDIS_PROVIDER],
  exports: [REDIS_PROVIDER],
})
export class RedisModule {}
