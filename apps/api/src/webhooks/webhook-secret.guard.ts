import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const supplied = context.switchToHttp().getRequest<Request>().headers[
      'x-webhook-secret'
    ];
    if (
      typeof supplied !== 'string' ||
      !timingSafeEqual(
        createHash('sha256').update(supplied).digest(),
        createHash('sha256')
          .update(this.config.getOrThrow<string>('WEBHOOK_SECRET'))
          .digest(),
      )
    )
      throw new UnauthorizedException('Invalid webhook secret.');
    return true;
  }
}
