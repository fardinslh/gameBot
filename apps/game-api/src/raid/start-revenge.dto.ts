import { IsString, Length } from 'class-validator';

export class StartRevengeDto {
  @IsString()
  @Length(8, 100)
  revengeTargetId!: string;
}
