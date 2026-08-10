import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
const MAX_INVITE_CODE_LENGTH = 100;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 24;

export class SignupDto {
  @IsString()
  @Length(1, MAX_INVITE_CODE_LENGTH)
  inviteCode: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  username: string;

  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password: string;

  // M6 Slice A: kanıtlanabilir onay - checkbox zaten client-side required +
  // disabled ile engelliyor, bu server-side backstop.
  @IsBoolean()
  @Equals(true)
  acceptedTerms: boolean;
}
