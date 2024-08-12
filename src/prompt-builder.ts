import { DeepKeys, Simplify } from "../types/tool";

export class PromptBuilder<I extends string, O extends string, T = unknown> {
  prompt: T;
  mapInputKeys: Partial<Record<I, string>> = {};
  mapOutputKeys: Partial<Record<O, string>> = {};

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

  /**
   * Creates a new instance of the PromptBuilder with the same prompt, input keys, and output keys.
   *
   * @returns A new instance of the PromptBuilder.
   */
  clone(): PromptBuilder<I, O, T> {
    const newBuilder = new PromptBuilder<I, O, T>(
      this.prompt,
      Object.keys(this.mapInputKeys) as I[],
      Object.keys(this.mapOutputKeys) as O[]
    );
    newBuilder.mapInputKeys = { ...this.mapInputKeys };
    newBuilder.mapOutputKeys = { ...this.mapOutputKeys };
    return newBuilder;
  }

  /**
   * Sets the input node for a given key.
   *
   * @param input - The input node to set.
   * @param key - The key to associate with the input node.
   * @returns This builder instance.
   */
  setInputNode(input: I, key: DeepKeys<T>) {
    this.mapInputKeys[input] = key;
    return this;
  }

  /**
   * Sets the output node for a given key.
   *
   * @param output - The output node to set.
   * @param key - The key to associate with the output node.
   * @returns This builder instance.
   */
  setOutputNode(output: O, key: DeepKeys<T>) {
    this.mapOutputKeys[output] = key;
    return this;
  }

  /**
   * Sets the value for a specific input key in the prompt builder.
   *
   * @template V - The type of the value being set.
   * @param {I} key - The input key.
   * @param {V} value - The value to set.
   * @returns A new prompt builder with the updated value.
   * @throws {Error} - If the key is not found.
   */
  input<V = string | number | undefined>(key: I, value: V) {
    const newBuilder = this.clone();
    if (value !== undefined) {
      const path = newBuilder.mapInputKeys[key] as string;
      if (!path) {
        throw new Error(`Key ${key} not found`);
      }
      const keys = path.split(".");
      let current = newBuilder.prompt as any;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          throw new Error(`Key ${keys[i]} not found`);
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }
    return newBuilder as Simplify<PromptBuilder<I, O, object>>;
  }

  /**
   * @deprecated Please call `input` directly instead
   */
  get caller() {
    return this;
  }

  /**
   * Gets the workflow object of the prompt builder.
   */
  get workflow() {
    return this.prompt as Simplify<T>;
  }
}
