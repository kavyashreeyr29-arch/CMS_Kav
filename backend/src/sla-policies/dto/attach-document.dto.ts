import { IsIn, IsNumber, IsString } from 'class-validator';

export class AttachDocumentDto {
  @IsString()
  fileName: string;

  @IsNumber()
  fileSize: number;

  @IsIn(['image', 'video', 'doc'])
  mimeKind: 'image' | 'video' | 'doc';

  @IsString()
  storageKey: string;
}
