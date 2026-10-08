import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
    };
    let code = codes[status] ?? 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    if (status < 500 && typeof payload === 'string') message = payload;
    else if (status < 500 && payload && typeof payload === 'object') {
      if ('code' in payload && typeof payload.code === 'string')
        code = payload.code;
      if ('message' in payload) {
        if (typeof payload.message === 'string') message = payload.message;
        else if (Array.isArray(payload.message))
          message = payload.message
            .filter((entry) => typeof entry === 'string')
            .join('; ');
      }
    }
    response.status(status).json({ code, message });
  }
}
