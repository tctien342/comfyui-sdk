export const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const seed = () => randomInt(10000000000, 999999999999);
