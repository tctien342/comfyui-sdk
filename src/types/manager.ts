export type TDefaultUI = "none" | "history" | "queue";
export type TExtensionActive = "Enabled" | "Disabled";
export type TPreviewMethod = "auto" | "latent2rgb" | "taesd" | "none";

enum EModelType {
  CHECKPOINT = "checkpoint",
  UNCLIP = "unclip",
  CLIP = "clip",
  VAE = "VAE",
  LORA = "lora",
  T2I_ADAPTER = "T2I-Adapter",
  T2I_STYLE = "T2I-Style",
  CONTROLNET = "controlnet",
  CLIP_VISION = "clip_vision",
  GLIGEN = "gligen",
  UPSCALE = "upscale",
  EMBEDDINGS = "embeddings",
  ETC = "etc",
}

export enum EInstallType {
  GIT_CLONE = "git-clone",
  COPY = "copy",
  UNZIP = "unzip",
}

export enum EExtensionUpdateCheckResult {
  NO_UPDATE = 0,
  UPDATE_AVAILABLE = 1,
  FAILED = 2,
}
export enum EUpdateResult {
  UNCHANGED = 0,
  SUCCESS = 1,
  FAILED = 2,
}
export type TExtensionNodeItem = {
  url: string;
  /**
   * Included nodes
   */
  nodeNames: string[];
  title_aux: string;
  title?: string;
  author?: string;
  description?: string;
  nickname?: string;
};

export interface IExtensionInfo {
  author: string;
  title: string;
  id: string;
  reference: string;
  files: string[];
  install_type: EInstallType;
  description: string;
  stars: number;
  last_update: string;
  trust: boolean;
  installed: boolean;
}

export interface IExtensionBaseRequest {
  /**
   * Custom Node name
   */
  title?: string;
  /**
   * Install method
   */
  install_type: EInstallType;
  /**
   * Files to download, clone or copy (can be git url, file url or file path)
   */
  files: string[];
}

export interface IInstallExtensionRequest extends IExtensionBaseRequest {
  /**
   * Destination path for copying files when install_type is "copy", default is custom_node folder
   */
  js_path?: string;
  /**
   * Python packages to be installed
   */
  pip?: string[];
}

export interface IExtensionUninstallRequest extends IExtensionBaseRequest {
  /**
   * Install method
   */
  install_type: EInstallType.GIT_CLONE | EInstallType.COPY;
  /**
   * Destination path for remove files when install_type is "copy", default is custom_node folder
   */
  js_path?: string;
}

export interface IExtensionUpdateRequest extends IExtensionBaseRequest {
  /**
   * Install method
   */
  install_type: EInstallType.GIT_CLONE;
}

export interface IExtensionActiveRequest extends IExtensionBaseRequest {
  /**
   * Install method
   */
  install_type: EInstallType.GIT_CLONE | EInstallType.COPY;
  /**
   * Active status
   */
  installed: TExtensionActive;
  /**
   * Destination path of extension when install_type is "copy". Default is custom_node folder
   */
  js_path?: string;
}

export interface IModelInstallRequest {
  /**
   * Model name
   */
  name?: string;
  /**
   * Place to save the model, set to `default` to use type instead
   */
  save_path: string;
  /**
   * Type of model
   */
  type: EModelType;
  /**
   * Model filename
   */
  filename: string;
  /**
   * Model url to be downloaded
   */
  url: string;
}
