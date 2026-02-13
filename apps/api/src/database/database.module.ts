import { Module, Global } from '@nestjs/common';
import { DATABASE_PROVIDER } from './database.provider';

@Global()
@Module({
  providers: [DATABASE_PROVIDER],
  exports: [DATABASE_PROVIDER],
})
export class DatabaseModule {}
