export type TEventStatus = {
  status: {
    exec_info: {
      queue_remaining: number;
    };
  };
  sid: string;
};

export type TExecution = {
  prompt_id: string;
};

export type TExecuting = TExecution & {
  node: string | null;
};

export type TProgress = TExecuting & {
  value: number;
  max: number;
};

export type TExecuted<T = unknown> = TExecution & {
  node: string;
  output: T;
};

export type TExecutionCached = TExecution & {
  node: string[];
};

export type TExecutionError = TExecution & {
  node_id: string;
  node_type: string;
  exception_message: srting;
  exception_type: string;
  traceback: string[];
};

export type TMonitorEvent = {
  cpu_utilization: number;
  ram_total: number;
  ram_used: number;
  ram_used_percent: number;
  hdd_total: number;
  hdd_used: number;
  hdd_used_percent: number;
  device_type: "cuda";
  gpus: Array<{
    gpu_utilization: number;
    gpu_temperature: number;
    vram_total: number;
    vram_used: number;
    vram_used_percent: number;
  }>;
};

export type TEventKey =
  | "all"
  | "status"
  | "progress"
  | "executing"
  | "executed"
  | "disconnected"
  | "execution_start"
  | "execution_error"
  | "execution_cached"
  | "crystools.monitor"
  | "reconnected"
  | "reconnecting"
  | "b_preview";

export type TComfyAPIEventMap = {
  all: CustomEvent<unknown>;
  status: CustomEvent<TEventStatus>;
  disconnected: CustomEvent<null>;
  reconnecting: CustomEvent<null>;
  reconnected: CustomEvent<null>;
  "crystools.monitor": CustomEvent<TMonitorEvent>;
  b_preview: CustomEvent<Blob>;
  execution_start: CustomEvent<TExecution>;
  executing: CustomEvent<TExecuting>;
  progress: CustomEvent<TProgress>;
  executed: CustomEvent<TExecuted>;
  execution_error: CustomEvent<TExecutionError>;
  execution_cached: CustomEvent<TExecutionCached>;
};
