import { NodeProgress } from "./types/api";
import { ComfyApi } from "./client";
import { PromptBuilder } from "./prompt-builder";

/**
 * Represents a wrapper class for making API calls using the ComfyApi client.
 * Provides methods for setting callback functions and executing the job.
 */
export class CallWrapper<T extends PromptBuilder<string, string, object>> {
  private client: ComfyApi;
  private prompt: T;
  private started = false;
  private promptId?: string;
  private output: Record<keyof T["mapOutputKeys"], any> = {} as any;

  private onPreviewFn?: (ev: Blob, promptId?: string) => void;
  private onPendingFn?: (promptId?: string) => void;
  private onStartFn?: (promptId?: string) => void;
  private onFinishedFn?: (
    data: Record<keyof T["mapOutputKeys"], any>,
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

  /**
   * Constructs a new CallWrapper instance.
   * @param client The ComfyApi client.
   * @param workflow The workflow object.
   */
  constructor(client: ComfyApi, workflow: T) {
    this.client = client;
    this.prompt = workflow;
    return this;
  }

  /**
   * Set the callback function to be called when a preview event occurs.
   *
   * @param fn - The callback function to be called. It receives a Blob object representing the event and an optional promptId string.
   * @returns The current instance of the CallWrapper.
   */
  onPreview(fn: (ev: Blob, promptId?: string) => void) {
    this.onPreviewFn = fn;
    return this;
  }

  /**
   * Set a callback function to be executed when the job is queued.
   * @param {Function} fn - The callback function to be executed.
   * @returns The current instance of the CallWrapper.
   */
  onPending(fn: (promptId?: string) => void) {
    this.onPendingFn = fn;
    return this;
  }

  /**
   * Set the callback function to be executed when the job start.
   *
   * @param fn - The callback function to be executed. It can optionally receive a `promptId` parameter.
   * @returns The current instance of the CallWrapper.
   */
  onStart(fn: (promptId?: string) => void) {
    this.onStartFn = fn;
    return this;
  }

  /**
   * Set the callback function to be executed when the asynchronous operation is finished.
   *
   * @param fn - The callback function to be executed. It receives the data returned by the operation
   *             and an optional promptId parameter.
   * @returns The current instance of the CallWrapper.
   */
  onFinished(
    fn: (data: Record<keyof T["mapOutputKeys"], any>, promptId?: string) => void
  ) {
    this.onFinishedFn = fn;
    return this;
  }

  /**
   * Set the callback function to be executed when the API call fails.
   *
   * @param fn - The callback function to be executed when the API call fails.
   *             It receives an `Error` object as the first parameter and an optional `promptId` as the second parameter.
   * @returns The current instance of the CallWrapper.
   */
  onFailed(fn: (err: Error, promptId?: string) => void) {
    this.onFailedFn = fn;
    return this;
  }

  /**
   * Set a callback function to be called when progress information is available.
   * @param fn - The callback function to be called with the progress information.
   * @returns The current instance of the CallWrapper.
   */
  onProgress(fn: (info: NodeProgress, promptId?: string) => void) {
    this.onProgressFn = fn;
    return this;
  }

  /**
   * Run the call wrapper and returns the output of the executed job.
   * If the job is already cached, it returns the cached output.
   * If the job is not cached, it executes the job and returns the output.
   *
   * @returns A promise that resolves to the output of the executed job,
   *          or `undefined` if the job is not found,
   *          or `false` if the job execution fails.
   */
  async run(): Promise<
    Record<keyof T["mapOutputKeys"], any> | undefined | false
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
    this.onPendingFn?.(this.promptId);
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
  ): Promise<Record<keyof T["mapOutputKeys"], any> | false> {
    const hisData = await this.client.getHistory(promptId);
    if (hisData?.status?.completed) {
      const output = this.mapOutput(hisData.outputs);
      this.onFinishedFn?.(output, this.promptId);
      return output;
    }
    return false;
  }

  private mapOutput(outputNodes: any): Record<keyof T["mapOutputKeys"], any> {
    const outputMapped = this.prompt.mapOutputKeys;
    const output: Record<keyof T["mapOutputKeys"], any> = {} as any;

    for (const key in outputMapped) {
      const node = outputMapped[key];
      if (node) {
        output[key as keyof T["mapOutputKeys"]] = outputNodes[node];
      }
    }

    return output;
  }

  private handleJobExecution(
    promptId: string
  ): Promise<Record<keyof T["mapOutputKeys"], any> | false> {
    const reverseOutputMapped = this.reverseMapOutputKeys();

    this.progressHandlerOffFn = this.client.on("progress", (ev) =>
      this.handleProgress(ev, promptId)
    );
    this.previewHandlerOffFn = this.client.on("b_preview", (ev) =>
      this.onPreviewFn?.(ev.detail, this.promptId)
    );

    return new Promise<Record<keyof T["mapOutputKeys"], any> | false>(
      (resolve) => {
        let totalOutput = Object.keys(reverseOutputMapped).length;

        const executionHandler = (ev: CustomEvent) => {
          if (ev.detail.prompt_id !== promptId) return;

          const outputKey =
            reverseOutputMapped[
              ev.detail.node as keyof typeof this.prompt.mapOutputKeys
            ];
          if (outputKey) {
            this.output[outputKey as keyof T["mapOutputKeys"]] =
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
    resolve: (value: Record<keyof T["mapOutputKeys"], any> | false) => void
  ) {
    if (ev.detail.prompt_id !== promptId) return;
    this.cleanupListeners();
    this.onFailedFn?.(
      new Error(ev.detail.exception_type, { cause: ev.detail }),
      this.promptId
    );
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
