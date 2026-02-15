import { IsUUID } from 'class-validator';

export class UuidParamDto {
  @IsUUID()
  id!: string;
}

export class CanvasIdParamDto {
  @IsUUID()
  canvasId!: string;
}

export class SessionIdParamDto {
  @IsUUID()
  sessionId!: string;
}

export class CanvasSessionParamDto {
  @IsUUID()
  canvasId!: string;

  @IsUUID()
  sessionId!: string;
}

export class CanvasSnapshotParamDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  snapshotId!: string;
}
