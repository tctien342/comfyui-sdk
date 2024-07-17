import type { KeysUnion } from "../types/tool";

export class PromptCaller<I extends string = "", O extends string = ""> {
  prompt: object;
  mapInputPath: Record<I, string | undefined>;
  mapOutputPath: Record<O, string | undefined>;

  constructor(
    prompt: object,
    mapIn: Record<string, string | undefined>,
    mapOut: Record<string, string | undefined>
  ) {
    this.prompt = JSON.parse(JSON.stringify(prompt));
    this.mapInputPath = mapIn;
    this.mapOutputPath = mapOut;
    return this;
  }

  input<T = string | number>(key: I, value: T) {
    const path = this.mapInputPath[key] as string;
    if (!path) {
      throw new Error(`Key ${key} not found`);
    }
    const keys = path.split(".");
    let current = this.prompt as any;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return this;
  }

  get mapOutputKeys(): Record<O, string | undefined> {
    return this.mapOutputPath;
  }

  get mapInputKeys() {
    return this.mapOutputPath;
  }

  get workflow() {
    return this.prompt;
  }
}

export class PromptBuilder<I extends string, O extends string, T = object> {
  prompt: T;
  mapInputKeys: Record<I, KeysUnion<T> | undefined> = {} as any;
  mapOutputKeys: Record<O, KeysUnion<T> | undefined> = {} as any;

  constructor(prompt: T, inputKeys: I[], outputKeys: O[]) {
    this.prompt = prompt;
    inputKeys.forEach((key) => {
      this.mapInputKeys[key] = undefined;
    });
    outputKeys.forEach((key) => {
      this.mapOutputKeys[key] = undefined;
    });
    return this;
  }

  setInputNode(input: I, key: KeysUnion<T>) {
    this.mapInputKeys[input] = key;
    return this;
  }

  setOutputNode(output: O, key: KeysUnion<T>) {
    this.mapOutputKeys[output] = key;
    return this;
  }

  get caller() {
    return new PromptCaller<I, O>(
      this.prompt as object,
      this.mapInputKeys,
      this.mapOutputKeys
    );
  }
}
