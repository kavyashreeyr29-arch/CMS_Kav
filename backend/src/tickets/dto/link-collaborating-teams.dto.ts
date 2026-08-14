import { IsArray, IsString } from 'class-validator';

export class LinkCollaboratingTeamsDto {
  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}
