import { IsString } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  projectCode: string;

  @IsString()
  body: string;
}
