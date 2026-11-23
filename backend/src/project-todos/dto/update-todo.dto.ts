import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateTodoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
