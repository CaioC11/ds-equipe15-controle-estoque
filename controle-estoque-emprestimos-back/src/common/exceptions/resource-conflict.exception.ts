import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code.enum';

export class ResourceConflictException extends AppException {
  constructor(message = 'Conflito com um recurso existente.') {
    super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
  }
}
