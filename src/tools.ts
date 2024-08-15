export const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const seed = () => randomInt(10000000000, 999999999999);

/**
 * Encode POSIX path to NT path
 *
 * For example: `SDXL/realvisxlV40` -> `SDXL\\realvisxlV40`
 *
 * Useful for loading model with Windows's ComfyUI Client
 */
export const encodeNTPath = (path: string) => {
  return path.replace(/\//g, "\\");
};

export const encodePosixPath = (path: string) => {
  return path.replace(/\\/g, "/");
};
