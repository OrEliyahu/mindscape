import { Transform } from 'class-transformer';
import { IsOptional, Matches } from 'class-validator';

export class ViewportQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
    { message: 'viewport must be x,y,width,height numeric values' },
  )
  viewport?: string;
}
