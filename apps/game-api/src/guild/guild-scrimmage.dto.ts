import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PostFriendlyChallengeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  message?: string;
}
