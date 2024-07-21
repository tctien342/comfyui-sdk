import type { NodeProgress } from "../types/api";
import type { ComfyApi } from "./client";
import type { PromptCaller } from "./prompt-builder";

export class CallWrapper<T extends PromptCaller<string, string>> {
  private client: ComfyApi;
  private prompt: T;
  private started = false;
  private output: Record<keyof T["mapOutputPath"], any> = {} as any;

  private onPreviewFn?: (ev: Blob) => void;
  private onStartFn?: () => void;
  private onFinishedFn?: (data: Record<keyof T["mapOutputPath"], any>) => void;
  private onFailedFn?: (err: Error) => void;
  private onProgressFn?: (info: NodeProgress) => void;

  private onDisconnectedHandler: any;
  private checkExecutingFn: any;
  private checkExecutedFn: any;
  private progressHandler: any;
  private previewHandler: any;
  private executionHandler: any;
  private errorHandler: any;

  constructor(client: ComfyApi, workflow: T) {
    this.client = client;
    this.prompt = workflow;
    return this;
  }

  onPreview(fn: (ev: Blob) => void) {
    this.onPreviewFn = fn;
    return this;
  }

  onStart(fn: () => void) {
    this.onStartFn = fn;
    return this;
  }

  onFinished(fn: (data: Record<keyof T["mapOutputPath"], any>) => void) {
    this.onFinishedFn = fn;
    return this;
  }

  onFailed(fn: (err: Error) => void) {
    this.onFailedFn = fn;
    return this;
  }

  onProgress(fn: (info: NodeProgress) => void) {
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

    this.onDisconnectedHandler = this.client.on("disconnected", () =>
      this.onFailedFn?.(new Error("Disconnected"))
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

      this.checkExecutingFn = this.client.on("executing", checkExecutingFn);
      this.checkExecutedFn = this.client.on(
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
      this.onFinishedFn?.(output);
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

    this.progressHandler = this.client.on("progress", (ev) =>
      this.handleProgress(ev, promptId)
    );
    this.previewHandler = this.client.on("b_preview", (ev) =>
      this.onPreviewFn?.(ev.detail)
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
            this.onFinishedFn?.(this.output);
            resolve(this.output);
          }
        };

        this.executionHandler = this.client.on("executed", executionHandler);
        this.errorHandler = this.client.on("execution_error", (ev) =>
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
      this.onStartFn?.();
    }
    this.onProgressFn?.(ev.detail);
  }

  private handleError(
    ev: CustomEvent,
    promptId: string,
    resolve: (value: Record<keyof T["mapOutputPath"], any> | false) => void
  ) {
    if (ev.detail.prompt_id !== promptId) return;
    this.cleanupListeners();
    console.log(ev.detail);
    this.onFailedFn?.(new Error(ev.detail.exception_type));
    resolve(false);
  }

  private cleanupListeners() {
    // Implement cleanup of listeners to avoid memory leaks
    this.client.off("disconnected", this.onDisconnectedHandler);
    this.client.off("executing", this.checkExecutingFn);
    this.client.off("execution_cached", this.checkExecutedFn);
    this.client.off("progress", this.progressHandler);
    this.client.off("b_preview", this.previewHandler);
    this.client.off("executed", this.executionHandler);
    this.client.off("execution_error", this.errorHandler);
  }
}
