import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class CancelOrderBodyPipe implements PipeTransform {
  transform(value: unknown): Record<string, never> {
    if (
      value === undefined ||
      (value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0)
    )
      return {};
    throw new BadRequestException('Cancellation requires an empty body.');
  }
}
