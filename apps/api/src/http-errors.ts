import { DomainError, RuntimeNotFoundError } from '@vtl/domain';
import { RuntimeAlreadyExistsError, RuntimeWorldMismatchError } from '@vtl/application';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class EntityNotFoundError extends Error {
  constructor(readonly entity: 'Channel' | 'Runtime') { super(`${entity} not found`); }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, _request, reply) => {
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
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });
}
