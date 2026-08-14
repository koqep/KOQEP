import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, INVALID_TOKEN_CODE } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException({
        code: INVALID_TOKEN_CODE,
        message: 'Authorization header eksik.',
      });
    }

    request.user = await this.authService.verifyAccessToken(token);
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}
