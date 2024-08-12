import { ComfyApi } from "../src/client";

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
  | "auth_error"
  | "auth_success"
  | "status"
  | "progress"
  | "executing"
  | "executed"
  | "disconnected"
  | "execution_success"
  | "execution_start"
  | "execution_error"
  | "execution_cached"
  | "crystools.monitor"
  | "reconnected"
  | "reconnecting"
  | "b_preview";

export type TComfyAPIEventMap = {
  all: CustomEvent<unknown>;
  auth_error: CustomEvent<Response>;
  auth_success: CustomEvent<null>;
  execution_success: CustomEvent<TExecution>;
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

export type TComfyPoolEventKey =
  | "init"
  | "init_client"
  | "auth_error"
  | "auth_success"
  | "added"
  | "removed"
  | "add_job"
  | "change_mode"
  | "connected"
  | "disconnected"
  | "reconnected"
  | "executing"
  | "executed"
  | "execution_error";

export type TComfyPoolEventMap = {
  init: CustomEvent<null>;
  auth_error: CustomEvent<{
    client: ComfyApi;
    clientIdx: number;
    res: Response;
  }>;
  auth_success: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  loading_client: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  change_mode: CustomEvent<{ mode: EQueueMode }>;
  added: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  removed: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  connected: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  disconnected: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  reconnected: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  add_job: CustomEvent<{ jobIdx: number; weight: number }>;
  executing: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  executed: CustomEvent<{ client: ComfyApi; clientIdx: number }>;
  execution_error: CustomEvent<{
    client: ComfyApi;
    clientIdx: number;
    error: Error;
  }>;
};
