import type { NodeProgress } from "../types/api";
import type { ComfyApi } from "./client";
import type { PromptCaller } from "./prompt-builder";

export class CallWrapper<T extends PromptCaller<string, string>> {
  private client: ComfyApi;
  private prompt: T;
  private started = false;

  private onPreviewFn?: (ev: Blob) => void;
  private onStartFn?: () => void;
  private onFinishedFn?: (data: Record<keyof T["mapOutputPath"], any>) => void;
  private onFailedFn?: () => void;
  private onProgressFn?: (info: NodeProgress) => void;

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

  onFailed(fn: () => void) {
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
    const job = await this.client.queuePrompt(-1, this.prompt.workflow);
    if (job) {
      const outputMapped = this.prompt.mapOutputKeys;
      const reverseOutputMapped = Object.entries(outputMapped).reduce(
        (acc, [k, v]) => {
          if (v) {
            acc[v] = k;
          }
          return acc;
        },
        {} as Record<string, string>
      );
      const { prompt_id } = job;
      const output: Record<keyof T["mapOutputPath"], any> = {} as any;

      // Try to get history if it's already cached
      const hisData = await this.client.getHistory(prompt_id);
      if (hisData?.status?.completed) {
        const outputNodes = hisData.outputs;
        for (const key in outputMapped) {
          const node = outputMapped[key];
          if (node) {
            output[key as keyof T["mapOutputPath"]] = outputNodes[node];
          }
        }
        this.onFinishedFn?.(output);
        return output;
      }

      const executingFn = (ev: CustomEvent) => {
        if (ev.detail.prompt_id === prompt_id && !this.started) {
          this.started = true;
          this.onStartFn?.();
        }
        this.onProgressFn?.(ev.detail);
      };
      const previewFn = (ev: CustomEvent<Blob>) => {
        if (this.onPreviewFn) {
          this.onPreviewFn(ev.detail);
        }
      };

      this.client.on("progress", executingFn);
      this.client.on("b_preview", previewFn);

      let totalOutput = Object.keys(reverseOutputMapped).length;
      return new Promise<Record<keyof T["mapOutputPath"], any> | false>(
        (resolve) => {
          const fn = (ev: CustomEvent) => {
            const data = ev.detail;
            if (data.prompt_id !== prompt_id) return;
            const node = data.node as keyof typeof this.prompt.mapOutputPath;
            if (reverseOutputMapped[node]) {
              const outputKey = reverseOutputMapped[node];
              if (outputKey) {
                output[outputKey as keyof T["mapOutputPath"]] = data.output;
              }
              totalOutput--;
            }
            if (totalOutput === 0) {
              this.client.off("progress", executingFn);
              this.client.off("executed", fn);
              this.client.off("b_preview", previewFn);
              this.onFinishedFn?.(output);
              resolve(output);
            }
          };
          this.client.on("executed", fn);

          // Failed FN
          const failedFn = (ev: CustomEvent) => {
            if (ev.detail.prompt_id !== prompt_id) return;
            this.client.off("progress", executingFn);
            this.client.off("executed", fn);
            this.client.off("b_preview", previewFn);
            this.client.off("execution_error", failedFn);
            this.onFailedFn?.();
            resolve(false);
          };
          this.client.on("execution_error", failedFn);
        }
      );
    }
  }
}
