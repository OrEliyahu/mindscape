import { Module } from '@nestjs/common';
import { EdgesService } from './edges.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [EdgesService],
  exports: [EdgesService],
})
export class EdgesModule {}
