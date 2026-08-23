import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Length } from 'class-validator';

export class SaveRaidTeamDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  heroIds!: string[];
}

