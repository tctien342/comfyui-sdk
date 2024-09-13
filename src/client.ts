import { WebSocketClient } from "./socket";

import {
  BasicCredentials,
  HistoryEntry,
  HistoryResponse,
  ImageInfo,
  NodeDefsResponse,
  OSType,
  QueuePromptResponse,
  QueueResponse,
  QueueStatus,
  SystemStatsResponse,
} from "./types/api";

import {
  LOAD_CHECKPOINTS_EXTENSION,
  LOAD_KSAMPLER_EXTENSION,
  LOAD_LORAS_EXTENSION,
} from "./contansts";
import { TComfyAPIEventMap } from "./types/event";
import { delay } from "./tools";
import { ManagerFeature } from "./features/manager";
import { MonitoringFeature } from "./features/monitoring";

interface FetchOptions extends RequestInit {
  headers?: {
    [key: string]: string;
  };
}

export class ComfyApi extends EventTarget {
  public apiHost: string;
  public osType: OSType;
  public isReady: boolean = false;

  private apiBase: string;
  private clientId: string | null;
  private socket: WebSocketClient | null = null;
  private listeners: {
    event: keyof TComfyAPIEventMap;
    options?: AddEventListenerOptions | boolean;
    handler: (event: TComfyAPIEventMap[keyof TComfyAPIEventMap]) => void;
  }[] = [];
  private credentials: BasicCredentials | null = null;

  public ext = {
    /**
     * Interact with ComfyUI-Manager Extension
     */
    manager: new ManagerFeature(this),
    /**
     * Interact with ComfyUI-Crystools Extension for track system resouces
     */
    monitor: new MonitoringFeature(this),
  };

  static generateId(): string {
    return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  public on<K extends keyof TComfyAPIEventMap>(
    type: K,
    callback: (event: TComfyAPIEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean
  ) {
    this.log("on", "Add listener", { type, callback, options });
    this.addEventListener(type, callback as any, options);
    this.listeners.push({ event: type, handler: callback, options });
    const clr = () => this.off(type, callback, options);
    return clr;
  }

  public off<K extends keyof TComfyAPIEventMap>(
    type: K,
    callback: (event: TComfyAPIEventMap[K]) => void,
    options?: EventListenerOptions | boolean
  ): void {
    this.log("off", "Remove listener", { type, callback, options });
    this.listeners = this.listeners.filter(
      (listener) => listener.event !== type && listener.handler !== callback
    );
    this.removeEventListener(type, callback as any, options);
  }

  public removeAllListeners() {
    this.log("removeAllListeners", "Triggered");
    this.listeners.forEach((listener) => {
      this.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
    });
    this.listeners = [];
  }

  get id(): string {
    return this.clientId ?? this.apiBase;
  }

  /**
   * Retrieves the available features of the client.
   *
   * @returns An object containing the available features, where each feature is a key-value pair.
   */
  get availabeFeatures() {
    return Object.keys(this.ext).reduce(
      (acc, key) => ({
        ...acc,
        [key]: this.ext[key as keyof typeof this.ext].isSupported,
      }),
      {}
    );
  }

  constructor(
    host: string,
    clientId: string = ComfyApi.generateId(),
    opts?: {
      /**
       * Do not fallback to HTTP if WebSocket is not available.
       * This will retry to connect to WebSocket on error.
       */
      forceWs?: boolean;
      credentials?: BasicCredentials;
    }
  ) {
    super();
    this.apiHost = host;
    this.apiBase = host.split("://")[1];
    this.clientId = clientId;
    if (opts?.credentials) {
      this.credentials = opts?.credentials;
      this.testCredentials();
    }
    this.log("constructor", "Initialized", {
      host,
      clientId,
      opts,
    });
    return this;
  }

  destroy() {
    this.socket?.client.removeAllListeners();
    this.socket?.close();
    this.removeAllListeners();
  }

  private log(fnName: string, message: string, data?: any) {
    this.dispatchEvent(
      new CustomEvent("log", { detail: { fnName, message, data } })
    );
  }

  private apiURL(route: string): string {
    return `${this.apiHost}${route}`;
  }

  private getCredentialHeaders(): Record<string, string> {
    if (!this.credentials) return {};
    switch (this.credentials?.type) {
      case "basic":
        return {
          Authorization: `Basic ${btoa(
            `${this.credentials.username}:${this.credentials.password}`
          )}`,
        };
      default:
        return {};
    }
  }

  private async testCredentials() {
    try {
      if (!this.credentials) return false;
      await this.pollStatus(2000);
      this.dispatchEvent(new CustomEvent("auth_success"));
      return true;
    } catch (e) {
      this.log("testCredentials", "Failed", e);
      if (e instanceof Response) {
        if (e.status === 401) {
          this.dispatchEvent(new CustomEvent("auth_error", { detail: e }));
        }
      }
      return false;
    }
  }

  private async testFeatures() {
    const exts = Object.values(this.ext);
    await Promise.all(exts.map((ext) => ext.checkSupported()));
    /**
     * Mark the client is ready to use the API.
     */
    this.isReady = true;
  }

  /**
   * Fetches data from the API.
   *
   * @param route - The route to fetch data from.
   * @param options - The options for the fetch request.
   * @returns A promise that resolves to the response from the API.
   */
  public async fetchApi(
    route: string,
    options?: FetchOptions
  ): Promise<Response> {
    if (!options) {
      options = {};
    }
    options.headers = {
      ...this.getCredentialHeaders(),
    };
    options.mode = "cors";
    return fetch(this.apiURL(route), options);
  }

  /**
   * Polls the status for colab and other things that don't support websockets.
   * @returns {Promise<QueueStatus>} The status information.
   */
  async pollStatus(timeout = 1000): Promise<QueueStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetchApi("/prompt", {
        signal: controller.signal,
      });
      if (response.status === 200) {
        return response.json();
      } else {
        throw response;
      }
    } catch (error: any) {
      this.log("pollStatus", "Failed", error);
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Queues a prompt for processing.
   * @param {number} number The index at which to queue the prompt.
   * @param {object} workflow Additional workflow data.
   * @returns {Promise<QueuePromptResponse>} The response from the API.
   */
  async queuePrompt(
    number: number,
    workflow: object
  ): Promise<QueuePromptResponse> {
    const body = {
      client_id: this.clientId,
      prompt: workflow,
    } as any;

    if (number === -1) {
      body["front"] = true;
    } else if (number !== 0) {
      body["number"] = number;
    }

    try {
      const response = await this.fetchApi("/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status !== 200) {
        throw {
          response,
        };
      }

      return response.json();
    } catch (e) {
      this.log("queuePrompt", "Can't queue prompt", e);
      throw e.response as Response;
    }
  }

  /**
   * Retrieves the current state of the queue.
   * @returns {Promise<QueueResponse>} The queue state.
   */
  async getQueue(): Promise<QueueResponse> {
    const response = await this.fetchApi("/queue");
    return response.json();
  }

  /**
   * Retrieves the prompt execution history.
   * @param {number} [maxItems=200] The maximum number of items to retrieve.
   * @returns {Promise<HistoryResponse>} The prompt execution history.
   */
  async getHistories(maxItems: number = 200): Promise<HistoryResponse> {
    const response = await this.fetchApi(`/history?max_items=${maxItems}`);
    return response.json();
  }

  /**
   * Retrieves the history entry for a given prompt ID.
   * @param promptId - The ID of the prompt.
   * @returns A Promise that resolves to the HistoryEntry object.
   */
  async getHistory(promptId: string): Promise<HistoryEntry | undefined> {
    const response = await this.fetchApi(`/history/${promptId}`);
    const history: HistoryResponse = await response.json();
    return history[promptId];
  }

  /**
   * Retrieves system and device stats.
   * @returns {Promise<SystemStatsResponse>} The system stats.
   */
  async getSystemStats(): Promise<SystemStatsResponse> {
    const response = await this.fetchApi("/system_stats");
    return response.json();
  }

  /**
   * Retrieves a list of extension URLs.
   * @returns {Promise<string[]>} A list of extension URLs.
   */
  async getExtensions(): Promise<string[]> {
    const response = await this.fetchApi("/extensions");
    return response.json();
  }

  /**
   * Retrieves a list of embedding names.
   * @returns {Promise<string[]>} A list of embedding names.
   */
  async getEmbeddings(): Promise<string[]> {
    const response = await this.fetchApi("/embeddings");
    return response.json();
  }

  /**
   * Retrieves the checkpoints from the server.
   * @returns A promise that resolves to an array of strings representing the checkpoints.
   */
  async getCheckpoints(): Promise<string[]> {
    const nodeInfo = await this.getNodeDefs(LOAD_CHECKPOINTS_EXTENSION);
    if (!nodeInfo) return [];
    const output =
      nodeInfo[LOAD_CHECKPOINTS_EXTENSION].input.required?.ckpt_name?.[0];
    if (!output) return [];
    return output as string[];
  }

  /**
   * Retrieves the Loras from the node definitions.
   * @returns A Promise that resolves to an array of strings representing the Loras.
   */
  async getLoras(): Promise<string[]> {
    const nodeInfo = await this.getNodeDefs(LOAD_LORAS_EXTENSION);
    if (!nodeInfo) return [];
    const output =
      nodeInfo[LOAD_LORAS_EXTENSION].input.required?.lora_name?.[0];
    if (!output) return [];
    return output as string[];
  }

  /**
   * Retrieves the sampler information.
   * @returns An object containing the sampler and scheduler information.
   */
  async getSamplerInfo() {
    const nodeInfo = await this.getNodeDefs(LOAD_KSAMPLER_EXTENSION);
    if (!nodeInfo) return {};
    return {
      sampler:
        nodeInfo[LOAD_KSAMPLER_EXTENSION].input.required.sampler_name ?? [],
      scheduler:
        nodeInfo[LOAD_KSAMPLER_EXTENSION].input.required.scheduler ?? [],
    };
  }

  /**
   * Retrieves node object definitions for the graph.
   * @returns {Promise<NodeDefsResponse>} The node definitions.
   */
  async getNodeDefs(nodeName?: string): Promise<NodeDefsResponse | null> {
    const response = await this.fetchApi(
      `/object_info${nodeName ? `/${nodeName}` : ""}`
    );
    const result = await response.json();
    if (Object.keys(result).length === 0) {
      return null;
    }
    return result;
  }

  /**
   * Retrieves user configuration data.
   * @returns {Promise<any>} The user configuration data.
   */
  async getUserConfig(): Promise<any> {
    const response = await this.fetchApi("/users");
    return response.json();
  }

  /**
   * Creates a new user.
   * @param {string} username The username of the new user.
   * @returns {Promise<Response>} The response from the API.
   */
  async createUser(username: string): Promise<Response> {
    const response = await this.fetchApi("/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });
    return response;
  }

  /**
   * Retrieves all setting values for the current user.
   * @returns {Promise<any>} A dictionary of setting id to value.
   */
  async getSettings(): Promise<any> {
    const response = await this.fetchApi("/settings");
    return response.json();
  }

  /**
   * Retrieves a specific setting for the current user.
   * @param {string} id The id of the setting to fetch.
   * @returns {Promise<any>} The setting value.
   */
  async getSetting(id: string): Promise<any> {
    const response = await this.fetchApi(`/settings/${encodeURIComponent(id)}`);
    return response.json();
  }

  /**
   * Stores a dictionary of settings for the current user.
   * @param {Record<string, unknown>} settings Dictionary of setting id to value to save.
   * @returns {Promise<void>}
   */
  async storeSettings(settings: Record<string, unknown>): Promise<void> {
    await this.fetchApi(`/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
  }

  /**
   * Stores a specific setting for the current user.
   * @param {string} id The id of the setting to update.
   * @param {unknown} value The value of the setting.
   * @returns {Promise<void>}
   */
  async storeSetting(id: string, value: unknown): Promise<void> {
    await this.fetchApi(`/settings/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
    });
  }

  /**
   * Uploads an image file to the server.
   * @param file - The image file to upload.
   * @param fileName - The name of the image file.
   * @param override - Optional. Specifies whether to override an existing file with the same name. Default is true.
   * @returns A Promise that resolves to an object containing the image information and the URL of the uploaded image,
   *          or false if the upload fails.
   */
  async uploadImage(
    file: Buffer | Blob,
    fileName: string,
    config?: {
      override?: boolean;
      subfolder?: string;
    }
  ): Promise<{ info: ImageInfo; url: string } | false> {
    const formData = new FormData();
    if (file instanceof Buffer) {
      formData.append("image", new Blob([file]), fileName);
    } else {
      formData.append("image", file, fileName);
    }
    formData.append("subfolder", config?.subfolder ?? "");
    formData.append("overwrite", config?.override?.toString() ?? "false");

    try {
      const response = await this.fetchApi("/upload/image", {
        method: "POST",
        body: formData,
      });
      const imgInfo = await response.json();
      const mapped = { ...imgInfo, filename: imgInfo.name };

      // Check if the response is successful
      if (!response.ok) {
        this.log("uploadImage", "Upload failed", response);
        return false;
      }

      return {
        info: mapped,
        url: this.getPathImage(mapped),
      };
    } catch (e) {
      this.log("uploadImage", "Upload failed", e);
      return false;
    }
  }

  /**
   * Uploads a mask file to the server.
   *
   * @param file - The mask file to upload, can be a Buffer or Blob.
   * @param originalRef - The original reference information for the file.
   * @returns A Promise that resolves to an object containing the image info and URL if the upload is successful, or false if the upload fails.
   */
  async uploadMask(
    file: Buffer | Blob,
    originalRef: ImageInfo
  ): Promise<{ info: ImageInfo; url: string } | false> {
    const formData = new FormData();

    // Append the image file to the form data
    if (file instanceof Buffer) {
      formData.append("image", new Blob([file]), "mask.png");
    } else {
      formData.append("image", file, "mask.png");
    }

    // Append the original reference as a JSON string
    formData.append("original_ref", JSON.stringify(originalRef));

    try {
      // Send the POST request to the /upload/mask endpoint
      const response = await this.fetchApi("/upload/mask", {
        method: "POST",
        body: formData,
      });

      // Check if the response is successful
      if (!response.ok) {
        this.log("uploadMask", "Upload failed", response);
        return false;
      }

      const imgInfo = await response.json();
      const mapped = { ...imgInfo, filename: imgInfo.name };
      return {
        info: mapped,
        url: this.getPathImage(mapped),
      };
    } catch (error) {
      this.log("uploadMask", "Upload failed", error);
      return false;
    }
  }

  /**
   * Frees memory by unloading models and freeing memory.
   *
   * @param unloadModels - A boolean indicating whether to unload models.
   * @param freeMemory - A boolean indicating whether to free memory.
   * @returns A promise that resolves to a boolean indicating whether the memory was successfully freed.
   */
  async freeMemory(
    unloadModels: boolean,
    freeMemory: boolean
  ): Promise<boolean> {
    const payload = {
      unload_models: unloadModels,
      free_memory: freeMemory,
    };

    try {
      const response = await this.fetchApi("/free", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Check if the response is successful
      if (!response.ok) {
        this.log("freeMemory", "Free memory failed", response);
        return false;
      }

      // Return the response object
      return true;
    } catch (error) {
      this.log("freeMemory", "Free memory failed", error);
      return false;
    }
  }

  /**
   * Returns the path to an image based on the provided image information.
   * @param imageInfo - The information of the image.
   * @returns The path to the image.
   */
  getPathImage(imageInfo: ImageInfo): string {
    return this.apiURL(
      `/view?filename=${imageInfo.filename}&type=${imageInfo.type}&subfolder=${
        imageInfo.subfolder ?? ""
      }`
    );
  }

  /**
   * Get blob of image based on the provided image information. Use when the server have credential.
   */
  async getImage(imageInfo: ImageInfo): Promise<Blob> {
    return this.fetchApi(
      `/view?filename=${imageInfo.filename}&type=${imageInfo.type}&subfolder=${
        imageInfo.subfolder ?? ""
      }`
    ).then((res) => res.blob());
  }

  /**
   * Retrieves a user data file for the current user.
   * @param {string} file The name of the userdata file to load.
   * @returns {Promise<Response>} The fetch response object.
   */
  async getUserData(file: string): Promise<Response> {
    return this.fetchApi(`/userdata/${encodeURIComponent(file)}`);
  }

  /**
   * Stores a user data file for the current user.
   * @param {string} file The name of the userdata file to save.
   * @param {unknown} data The data to save to the file.
   * @param {RequestInit & { overwrite?: boolean, stringify?: boolean, throwOnError?: boolean }} [options] Additional options for storing the file.
   * @returns {Promise<Response>}
   */
  async storeUserData(
    file: string,
    data: unknown,
    options: RequestInit & {
      overwrite?: boolean;
      stringify?: boolean;
      throwOnError?: boolean;
    } = { overwrite: true, stringify: true, throwOnError: true }
  ): Promise<Response> {
    const response = await this.fetchApi(
      `/userdata/${encodeURIComponent(file)}?overwrite=${options.overwrite}`,
      {
        method: "POST",
        headers: {
          "Content-Type": options.stringify
            ? "application/json"
            : "application/octet-stream",
        } as any,
        body: options.stringify ? JSON.stringify(data) : (data as any),
        ...options,
      }
    );

    if (response.status !== 200 && options.throwOnError !== false) {
      this.log("storeUserData", "Error storing user data file", response);
      throw new Error(
        `Error storing user data file '${file}': ${response.status} ${response.statusText}`
      );
    }

    return response;
  }

  /**
   * Deletes a user data file for the current user.
   * @param {string} file The name of the userdata file to delete.
   * @returns {Promise<void>}
   */
  async deleteUserData(file: string): Promise<void> {
    const response = await this.fetchApi(
      `/userdata/${encodeURIComponent(file)}`,
      {
        method: "DELETE",
      }
    );

    if (response.status !== 204) {
      this.log("deleteUserData", "Error deleting user data file", response);
      throw new Error(
        `Error removing user data file '${file}': ${response.status} ${response.statusText}`
      );
    }
  }

  /**
   * Moves a user data file for the current user.
   * @param {string} source The userdata file to move.
   * @param {string} dest The destination for the file.
   * @param {RequestInit & { overwrite?: boolean }} [options] Additional options for moving the file.
   * @returns {Promise<Response>}
   */
  async moveUserData(
    source: string,
    dest: string,
    options: RequestInit & { overwrite?: boolean } = { overwrite: false }
  ): Promise<Response> {
    return this.fetchApi(
      `/userdata/${encodeURIComponent(source)}/move/${encodeURIComponent(
        dest
      )}?overwrite=${options.overwrite}`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Lists user data files for the current user.
   * @param {string} dir The directory in which to list files.
   * @param {boolean} [recurse] If the listing should be recursive.
   * @param {boolean} [split] If the paths should be split based on the OS path separator.
   * @returns {Promise<string[]>} The list of files.
   */
  async listUserData(
    dir: string,
    recurse?: boolean,
    split?: boolean
  ): Promise<string[]> {
    const response = await this.fetchApi(
      `/userdata?${new URLSearchParams({
        dir,
        recurse: recurse?.toString() ?? "",
        split: split?.toString() ?? "",
      })}`
    );

    if (response.status === 404) return [];
    if (response.status !== 200) {
      this.log("listUserData", "Error getting user data list", response);
      throw new Error(
        `Error getting user data list '${dir}': ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Interrupts the execution of the running prompt.
   * @returns {Promise<void>}
   */
  async interrupt(): Promise<void> {
    await this.fetchApi("/interrupt", {
      method: "POST",
    });
  }

  /**
   * Initializes the client.
   *
   * @param maxTries - The maximum number of ping tries.
   * @param delayTime - The delay time between ping tries in milliseconds.
   * @returns The initialized client instance.
   */
  init(maxTries = 10, delayTime = 1000) {
    this.createSocket();
    this.pingSuccess(maxTries, delayTime).then(() => {
      /**
       * Get system OS type on initialization.
       */
      this.pullOsType();
      /**
       * Test features on initialization.
       */
      this.testFeatures();
    });

    return this;
  }

  private async pingSuccess(maxTries = 10, delayTime = 1000) {
    let tries = 0;
    let ping = await this.ping();
    while (!ping.status) {
      if (tries > maxTries) {
        throw new Error("Can't connect to the server");
      }
      await delay(delayTime); // Wait for 1s before trying again
      ping = await this.ping();
      tries++;
    }
  }

  async waitForReady() {
    while (!this.isReady) {
      await delay(100);
    }
    return this;
  }

  private async pullOsType() {
    this.getSystemStats().then((data) => {
      this.osType = data.system.os;
    });
  }

  /**
   * Sends a ping request to the server and returns a boolean indicating whether the server is reachable.
   * @returns A promise that resolves to `true` if the server is reachable, or `false` otherwise.
   */
  async ping() {
    const start = performance.now();
    return this.pollStatus(5000)
      .then(() => {
        return { status: true, time: performance.now() - start };
      })
      .catch((error) => {
        this.log("ping", "Can't connect to the server", error);
        return { status: false };
      });
  }

  private async reconnectWs(opened: boolean) {
    if (opened) {
      this.dispatchEvent(new CustomEvent("disconnected"));
      this.dispatchEvent(new CustomEvent("reconnecting"));
    }
    setTimeout(() => {
      this.socket?.client.terminate();
      this.socket?.close();
      this.socket = null;
      this.createSocket(true);
    }, 500);
  }

  /**
   * Creates and connects a WebSocket for real-time updates.
   * @param {boolean} isReconnect If the socket connection is a reconnect attempt.
   */
  private createSocket(isReconnect: boolean = false) {
    if (this.socket) {
      return;
    }
    const headers = {
      ...this.getCredentialHeaders(),
    };
    let opened = false;
    let existingSession = "?clientId=" + this.clientId;
    this.socket = new WebSocketClient(
      `ws${this.apiHost.includes("https:") ? "s" : ""}://${
        this.apiBase
      }/ws${existingSession}`,
      {
        headers,
      }
    );
    this.socket.client.onclose = () => {
      this.log("socket", "Socket closed -> Reconnecting");
      this.reconnectWs(opened);
    };
    this.socket.client.onopen = () => {
      this.log("socket", "Socket opened");
      opened = true;
      if (isReconnect) {
        this.dispatchEvent(new CustomEvent("reconnected"));
      } else {
        this.dispatchEvent(new CustomEvent("connected"));
      }
    };
    this.socket.client.onmessage = (event) => {
      try {
        if (event.data instanceof Buffer) {
          const buffer = event.data;
          const view = new DataView(buffer.buffer);
          const eventType = view.getUint32(0);
          switch (eventType) {
            case 1:
              const imageType = view.getUint32(0);
              let imageMime;
              switch (imageType) {
                case 1:
                default:
                  imageMime = "image/jpeg";
                  break;
                case 2:
                  imageMime = "image/png";
              }
              const imageBlob = new Blob([buffer.slice(4)], {
                type: imageMime,
              });
              this.dispatchEvent(
                new CustomEvent("b_preview", { detail: imageBlob })
              );
              break;
            default:
              throw new Error(
                `Unknown binary websocket message of type ${eventType}`
              );
          }
        } else if (typeof event.data === "string") {
          const msg = JSON.parse(event.data);
          if (!msg.data || !msg.type) return;
          this.dispatchEvent(new CustomEvent("all", { detail: msg }));
          this.dispatchEvent(new CustomEvent(msg.type, { detail: msg.data }));
          if (msg.data.sid) {
            this.clientId = msg.data.sid;
          }
        } else {
          this.log("socket", "Unhandled message", event);
        }
      } catch (error) {
        this.log("socket", "Unhandled message", { event, error });
      }
    };

    this.socket.client.onerror = (e) => {
      this.log("socket", "Socket error", e);
    };
  }
}
