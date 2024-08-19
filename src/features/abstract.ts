import { ComfyApi } from "src/client";

export abstract class AbstractFeature extends EventTarget {
  protected client: ComfyApi;
  protected supported = false;

  constructor(client: ComfyApi) {
    super();
    this.client = client;
  }

  get isSupported() {
    return this.supported;
  }

  public on(
    type: string,
    callback: (event: any) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.addEventListener(type, callback as any, options);
    return () => this.off(type, callback);
  }

  public off(
    type: string,
    callback: (event: any) => void,
    options?: EventListenerOptions | boolean
  ): void {
    this.removeEventListener(type, callback as any, options);
  }

  /**
   * Check if this feature is supported by the current client
   */
  abstract checkSupported(): Promise<boolean>;
}
