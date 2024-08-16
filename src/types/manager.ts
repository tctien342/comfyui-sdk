export type TDefaultUI = "none" | "history" | "queue";
export enum EExtensionUpdateCheckResult {
  NO_UPDATE = 0,
  UPDATE_AVAILABLE = 1,
  FAILED = 2,
}
export enum TExtensionUpdateResult {
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
  install_type: "git-clone" | "copy";
  description: string;
  stars: number;
  last_update: string;
  trust: boolean;
  installed: boolean;
}
