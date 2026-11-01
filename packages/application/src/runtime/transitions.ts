import { InvalidRuntimeTransitionError, type RuntimeStatus } from '@vtl/domain';

const legal: Readonly<Record<RuntimeStatus, readonly RuntimeStatus[]>> = {
  CREATED: ['INITIALIZING'],
  INITIALIZING: ['READY', 'ERROR'],
  READY: ['RUNNING', 'STOPPING', 'STOPPED', 'ERROR'],
  RUNNING: ['PAUSED', 'STOPPING', 'STOPPED', 'ERROR'],
  PAUSED: ['RUNNING', 'STOPPING', 'STOPPED', 'ERROR'],
  STOPPING: ['STOPPED', 'ERROR'],
  STOPPED: [],
  ERROR: [],
};

export function assertRuntimeTransition(from: RuntimeStatus, to: RuntimeStatus): void {
  if (!legal[from].includes(to)) throw new InvalidRuntimeTransitionError(from, to);
}
