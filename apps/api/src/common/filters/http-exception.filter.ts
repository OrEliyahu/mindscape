import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  type ValidationError,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ValidationErrorDetail {
  field: string;
  constraints: Record<string, string>;
  children: ValidationErrorDetail[];
}

function normalizeValidationErrors(errors: ValidationError[]): ValidationErrorDetail[] {
  return errors.map((err) => ({
    field: err.property,
    constraints: (err.constraints ?? {}) as Record<string, string>,
    children: err.children?.length ? normalizeValidationErrors(err.children) : [],
  }));
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let details: unknown;

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const typedResponse = exceptionResponse as {
          message?: string | string[] | ValidationError[];
          error?: string;
        };

        if (Array.isArray(typedResponse.message)) {
          const isValidationErrorArray = typedResponse.message.every((item) => typeof item === 'object');
          if (isValidationErrorArray) {
            details = normalizeValidationErrors(typedResponse.message as ValidationError[]);
            message = 'Validation failed';
          } else {
            details = typedResponse.message;
            message = typedResponse.message.join('; ');
          }
        } else {
          message = typedResponse.message ?? typedResponse.error ?? message;
        }
      }
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        details,
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
