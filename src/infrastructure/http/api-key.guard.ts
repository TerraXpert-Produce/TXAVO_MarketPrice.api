import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.config.get<string>('API_WRITE_KEY', '');
    if (!configuredKey) return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (request.header('x-api-key') !== configuredKey) {
      throw new UnauthorizedException('A valid API write key is required');
    }
    return true;
  }
}
