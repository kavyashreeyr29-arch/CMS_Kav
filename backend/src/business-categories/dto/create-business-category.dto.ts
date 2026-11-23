import { IsString, MinLength } from 'class-validator';

export class CreateBusinessCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;
}
