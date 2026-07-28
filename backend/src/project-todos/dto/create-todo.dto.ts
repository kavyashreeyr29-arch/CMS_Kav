import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTodoDto {
  @IsString()
  projectCode: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
