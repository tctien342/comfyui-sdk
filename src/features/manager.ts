import {
  TDefaultUI,
  TExtensionNodeItem,
  EExtensionUpdateCheckResult,
  EUpdateResult,
  IExtensionInfo,
  TPreviewMethod,
} from "src/types/manager";
import { AbstractFeature } from "./abstract";

export interface FetchOptions extends RequestInit {
  headers?: {
    [key: string]: string;
  };
}

export class ManagerFeature extends AbstractFeature {
  async checkSupported() {
    const data = await this.defaultUi();
    if (data !== false) {
      this.supported = true;
    }
    return this.supported;
  }

  async fetchApi(path: string, options?: FetchOptions) {
    if (!this.supported) {
      return false;
    }
    return this.client.fetchApi(path, options);
  }

  /**
   * Set the default state to be displayed in the main menu when the browser starts.
   *
   * We use this api to checking if the manager feature is supported.
   *
   * Default will return the current state.
   */
  async defaultUi(setUi?: TDefaultUI): Promise<TDefaultUI | false> {
    let callURL = "/manager/default_ui";
    if (setUi) {
      callURL += `?value=${setUi}`;
    }
    const data = await this.client.fetchApi(callURL);
    if (data && data.ok) {
      return data.text() as Promise<TDefaultUI>;
    }
    return false;
  }

  /**
   * Retrieves a list of extension's nodes based on the specified mode.
   *
   * Use full to find the node suitable for the current workflow.
   *
   * @param mode - The mode to determine the source of the nodes. Defaults to "local".
   * @returns A promise that resolves to an array of extension nodes.
   */
  async getNodeMapList(mode: "local" | "nickname" = "local"): Promise<any> {
    const listNodes: TExtensionNodeItem[] = [];
    const data = await this.fetchApi(`/customnode/getmappings?mode=${mode}`);
    if (data && data.ok) {
      const nodes: { [key: string]: [string[], any] } = await data.json();
      for (const url in nodes) {
        const [nodeNames, nodeData] = nodes[url];
        listNodes.push({
          url,
          nodeNames,
          title_aux: nodeData.title_aux,
          title: nodeData.title,
          author: nodeData.author,
          nickname: nodeData.nickname,
          description: nodeData.description,
        });
      }
    }
    return listNodes;
  }

  /**
   * Checks for extension updates.
   *
   * @param mode - The mode to use for checking updates. Defaults to "local".
   * @returns The result of the extension update check.
   */
  async checkExtensionUpdate(mode: "local" | "cache" = "local") {
    const data = await this.fetchApi(`/customnode/fetch_updates?mode=${mode}`);
    if (data && data.ok) {
      if (data.status === 201) {
        return EExtensionUpdateCheckResult.UPDATE_AVAILABLE;
      }
      return EExtensionUpdateCheckResult.NO_UPDATE;
    }
    return EExtensionUpdateCheckResult.FAILED;
  }

  /**
   * Updates all extensions.
   * @param mode - The update mode. Can be "local" or "cache". Defaults to "local".
   * @returns An object representing the result of the extension update.
   */
  async updataAllExtensions(mode: "local" | "cache" = "local") {
    const data = await this.fetchApi(`/customnode/update_all?mode=${mode}`);
    if (data && data.ok) {
      if (data.status === 200) {
        return { type: EUpdateResult.UNCHANGED };
      }
      return {
        type: EUpdateResult.SUCCESS,
        data: (await data.json()) as { updated: number; failed: number },
      } as const;
    }
    return { type: EUpdateResult.FAILED };
  }

  /**
   * Updates the ComfyUI.
   *
   * @returns The result of the update operation.
   */
  async updateComfyUI() {
    const data = await this.fetchApi("/comfyui_manager/update_comfyui");
    if (data) {
      switch (data.status) {
        case 200:
          return EUpdateResult.UNCHANGED;
        case 201:
          return EUpdateResult.SUCCESS;
        default:
          return EUpdateResult.FAILED;
      }
    }
    return EUpdateResult.FAILED;
  }

  /**
   * Retrieves the list of extensions.
   *
   * @param mode - The mode to retrieve the extensions from. Can be "local" or "cache". Defaults to "local".
   * @param skipUpdate - Indicates whether to skip updating the extensions. Defaults to true.
   * @returns A promise that resolves to an object containing the channel and custom nodes, or false if the retrieval fails.
   */
  async getExtensionList(
    mode: "local" | "cache" = "local",
    skipUpdate: boolean = true
  ): Promise<
    | {
        channel: "local" | "default";
        custom_nodes: IExtensionInfo[];
      }
    | false
  > {
    const data = await this.fetchApi(
      `/customnode/getlist?mode=${mode}&skip_update=${skipUpdate}`
    );
    if (data && data.ok) {
      return data.json();
    }
    return false;
  }

  /**
   * Reboots the instance.
   *
   * @returns A promise that resolves to `true` if the instance was successfully rebooted, or `false` otherwise.
   */
  async rebootInstance() {
    const data = await this.fetchApi("/manager/reboot").catch((e) => {
      return true;
    });
    if (data !== true) return false;
    return true;
  }

  /**
   * Return the current preview method. Will set to `mode` if provided.
   *
   * @param mode - The preview method mode.
   * @returns The result of the preview method.
   */
  async previewMethod(mode?: TPreviewMethod) {
    let callURL = "/manager/default_ui";
    if (mode) {
      callURL += `?value=${mode}`;
    }
    const data = await this.fetchApi(callURL);
    if (data && data.ok) {
      const result = await data.text();
      if (!result) return mode;
      return result as TPreviewMethod;
    }
    return false;
  }
}
