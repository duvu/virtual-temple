import { DomainError, RuntimeNotFoundError } from '@vtl/domain';
import { RuntimeAlreadyExistsError, RuntimeWorldMismatchError } from '@vtl/application';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class EntityNotFoundError extends Error {
  constructor(readonly entity: 'Channel' | 'Runtime') { super(`${entity} not found`); }
}

export class ChannelEngineMismatchError extends Error {
  constructor() { super('Channel engine does not match configured adapter'); }
}

export class UnsupportedMediaTypeError extends Error {
  constructor() { super('Unsupported content type'); }
}

export function requireJsonContentType(contentType: string | undefined): void {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(mediaType ?? '')) {
    throw new UnsupportedMediaTypeError();
  }
}

const parserErrors: Readonly<Record<string, { readonly status: 400 | 413 | 415; readonly code: string; readonly message: string }>> = {
  FST_ERR_CTP_INVALID_JSON_BODY: { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON request' },
  FST_ERR_CTP_EMPTY_JSON_BODY: { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON request' },
  FST_ERR_CTP_INVALID_CONTENT_LENGTH: { status: 400, code: 'INVALID_CONTENT_LENGTH', message: 'Invalid request content length' },
  FST_ERR_CTP_BODY_TOO_LARGE: { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request payload too large' },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content type' },
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, _request, reply) => {
    const parserError = 'code' in error && typeof error.code === 'string' ? parserErrors[error.code] : undefined;
    if (parserError !== undefined) {
      return reply.code(parserError.status).send({ error: { code: parserError.code, message: parserError.message } });
    }
    if (error instanceof ZodError || ('validation' in error && error.validation)) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    }
    if (error instanceof EntityNotFoundError || error instanceof RuntimeNotFoundError) {
      const entity = error instanceof EntityNotFoundError ? error.entity : 'Runtime';
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `${entity} not found` } });
    }
    if (error instanceof DomainError && ['INVALID_RUNTIME_TRANSITION', 'UNSUPPORTED_CAPABILITY'].includes(error.code)) {
      return reply.code(409).send({ error: { code: error.code, message: error.code === 'INVALID_RUNTIME_TRANSITION' ? 'Invalid runtime transition' : 'Unsupported capability' } });
    }
    if (error instanceof DomainError && error.code === 'ADAPTER_FAILURE') {
      return reply.code(502).send({ error: { code: 'ADAPTER_FAILURE', message: 'Adapter operation failed' } });
    }
    if (error instanceof RuntimeAlreadyExistsError || error instanceof RuntimeWorldMismatchError) {
      return reply.code(409).send({ error: { code: error instanceof RuntimeAlreadyExistsError ? 'RUNTIME_ALREADY_EXISTS' : 'RUNTIME_WORLD_MISMATCH', message: 'Runtime request conflicts with existing state' } });
    }
    if (error instanceof ChannelEngineMismatchError) {
      return reply.code(409).send({ error: { code: 'ENGINE_MISMATCH', message: 'Channel engine does not match configured adapter' } });
    }
    if (error instanceof UnsupportedMediaTypeError) {
      return reply.code(415).send({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content type' } });
    }
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });
}
