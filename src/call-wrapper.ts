import type { NodeProgress } from "../types/api";
import type { ComfyApi } from "./client";
import type { PromptCaller } from "./prompt-builder";

export class CallWrapper<T extends PromptCaller<string, string>> {
  private client: ComfyApi;
  private prompt: T;
  private started = false;
  private promptId?: string;
  private output: Record<keyof T["mapOutputPath"], any> = {} as any;

  private onPreviewFn?: (ev: Blob, promptId?: string) => void;
  private onStartFn?: (promptId?: string) => void;
  private onFinishedFn?: (
    data: Record<keyof T["mapOutputPath"], any>,
    promptId?: string
  ) => void;
  private onFailedFn?: (err: Error, promptId?: string) => void;
  private onProgressFn?: (info: NodeProgress, promptId?: string) => void;

  private onDisconnectedHandlerOffFn: any;
  private checkExecutingOffFn: any;
  private checkExecutedOffFn: any;
  private progressHandlerOffFn: any;
  private previewHandlerOffFn: any;
  private executionHandlerOffFn: any;
  private errorHandlerOffFn: any;

  constructor(client: ComfyApi, workflow: T) {
    this.client = client;
    this.prompt = workflow;
    return this;
  }

  onPreview(fn: (ev: Blob, promptId?: string) => void) {
    this.onPreviewFn = fn;
    return this;
  }

  onStart(fn: (promptId?: string) => void) {
    this.onStartFn = fn;
    return this;
  }

  onFinished(
    fn: (data: Record<keyof T["mapOutputPath"], any>, promptId?: string) => void
  ) {
    this.onFinishedFn = fn;
    return this;
  }

  onFailed(fn: (err: Error, promptId?: string) => void) {
    this.onFailedFn = fn;
    return this;
  }

  onProgress(fn: (info: NodeProgress, promptId?: string) => void) {
    this.onProgressFn = fn;
    return this;
  }

  async run(): Promise<
    Record<keyof T["mapOutputPath"], any> | undefined | false
  > {
    const job = await this.enqueueJob();
    if (!job) return;

    const isCached = await this.checkIfCached(job.prompt_id);
    if (isCached) {
      const output = await this.handleCachedOutput(job.prompt_id);
      if (output) return output;
    }

    return this.handleJobExecution(job.prompt_id);
  }

  private async enqueueJob() {
    const job = await this.client.queuePrompt(-1, this.prompt.workflow);
    if (!job) {
      this.onFailedFn?.(new Error("Job could not be queued"));
      return;
    }

    this.promptId = job.prompt_id;
    this.onDisconnectedHandlerOffFn = this.client.on("disconnected", () =>
      this.onFailedFn?.(new Error("Disconnected"), this.promptId)
    );
    return job;
  }

  private async checkIfCached(promptId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let checked = false;

      const checkExecutingFn = (event: CustomEvent) => {
        if (event.detail && event.detail.prompt_id === promptId && !checked) {
          resolve(false);
        }
        this.client.off("executing", checkExecutingFn);
      };

      const checkExecutedFn = (event: CustomEvent) => {
        if (event.detail.prompt_id === promptId && !checked) {
          resolve(true);
        }
        this.client.off("executed", checkExecutedFn);
      };

      this.checkExecutingOffFn = this.client.on("executing", checkExecutingFn);
      this.checkExecutedOffFn = this.client.on(
        "execution_cached",
        checkExecutedFn
      );
    });
  }

  private async handleCachedOutput(
    promptId: string
  ): Promise<Record<keyof T["mapOutputPath"], any> | false> {
    const hisData = await this.client.getHistory(promptId);
    if (hisData?.status?.completed) {
      const output = this.mapOutput(hisData.outputs);
      this.onFinishedFn?.(output, this.promptId);
      return output;
    }
    return false;
  }

  private mapOutput(outputNodes: any): Record<keyof T["mapOutputPath"], any> {
    const outputMapped = this.prompt.mapOutputKeys;
    const output: Record<keyof T["mapOutputPath"], any> = {} as any;

    for (const key in outputMapped) {
      const node = outputMapped[key];
      if (node) {
        output[key as keyof T["mapOutputPath"]] = outputNodes[node];
      }
    }

    return output;
  }

  private handleJobExecution(
    promptId: string
  ): Promise<Record<keyof T["mapOutputPath"], any> | false> {
    const reverseOutputMapped = this.reverseMapOutputKeys();

    this.progressHandlerOffFn = this.client.on("progress", (ev) =>
      this.handleProgress(ev, promptId)
    );
    this.previewHandlerOffFn = this.client.on("b_preview", (ev) =>
      this.onPreviewFn?.(ev.detail, this.promptId)
    );

    return new Promise<Record<keyof T["mapOutputPath"], any> | false>(
      (resolve) => {
        let totalOutput = Object.keys(reverseOutputMapped).length;

        const executionHandler = (ev: CustomEvent) => {
          if (ev.detail.prompt_id !== promptId) return;

          const outputKey =
            reverseOutputMapped[
              ev.detail.node as keyof typeof this.prompt.mapOutputPath
            ];
          if (outputKey) {
            this.output[outputKey as keyof T["mapOutputPath"]] =
              ev.detail.output;
            totalOutput--;
          }

          if (totalOutput === 0) {
            this.cleanupListeners();
            this.onFinishedFn?.(this.output, this.promptId);
            resolve(this.output);
          }
        };

        this.executionHandlerOffFn = this.client.on(
          "executed",
          executionHandler
        );
        this.errorHandlerOffFn = this.client.on("execution_error", (ev) =>
          this.handleError(ev, promptId, resolve)
        );
      }
    );
  }

  private reverseMapOutputKeys(): Record<string, string> {
    const outputMapped = this.prompt.mapOutputKeys;
    return Object.entries(outputMapped).reduce((acc, [k, v]) => {
      if (v) acc[v] = k;
      return acc;
    }, {} as Record<string, string>);
  }

  private handleProgress(ev: CustomEvent, promptId: string) {
    if (ev.detail.prompt_id === promptId && !this.started) {
      this.started = true;
      this.onStartFn?.(this.promptId);
    }
    this.onProgressFn?.(ev.detail, this.promptId);
  }

  private handleError(
    ev: CustomEvent,
    promptId: string,
    resolve: (value: Record<keyof T["mapOutputPath"], any> | false) => void
  ) {
    if (ev.detail.prompt_id !== promptId) return;
    this.cleanupListeners();
    this.onFailedFn?.(new Error(ev.detail.exception_type), this.promptId);
    resolve(false);
  }

  private cleanupListeners() {
    this.onDisconnectedHandlerOffFn();
    this.checkExecutingOffFn();
    this.checkExecutedOffFn();
    this.progressHandlerOffFn();
    this.previewHandlerOffFn();
    this.executionHandlerOffFn();
    this.errorHandlerOffFn();
  }
}
