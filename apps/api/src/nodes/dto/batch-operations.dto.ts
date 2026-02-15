import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsObject, ValidateNested } from 'class-validator';

class NodeBatchOperationDto {
  @IsIn(['create', 'update', 'delete'])
  action!: 'create' | 'update' | 'delete';

  @IsObject()
  data!: Record<string, unknown>;
}

export class BatchOperationsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => NodeBatchOperationDto)
  operations!: NodeBatchOperationDto[];
}
