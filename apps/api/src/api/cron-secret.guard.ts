import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const CRON_SECRET_HEADER = 'x-cron-secret';

@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[CRON_SECRET_HEADER];
    const expected = this.config.get<string>('CRON_SECRET');

    if (!expected || provided !== expected) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
