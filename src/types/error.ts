export class CallWrapperError extends Error {
  name = 'CallWrapperError';
}

export class WentMissingError extends CallWrapperError {
  name = 'WentMissingError';
}

export class FailedCacheError extends CallWrapperError {
  name = 'FailedCacheError';
}

export class EnqueueFailedError extends CallWrapperError {
  name = 'EnqueueFailedError';
}

export class DisconnectedError extends CallWrapperError {
  name = 'DisconnectedError';
}

export class ExecutionFailedError extends CallWrapperError {
  name = 'ExecutionFailedError';
}

export class CustomEventError extends CallWrapperError {
  name = 'CustomEventError';
}

export class ExecutionInterruptedError extends CallWrapperError {
  name = ' ExecutionInterruptedError';
}