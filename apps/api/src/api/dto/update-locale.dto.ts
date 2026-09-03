import { IsIn } from 'class-validator';

export class UpdateLocaleDto {
  @IsIn(['en', 'tr'])
  locale: 'en' | 'tr';
}
