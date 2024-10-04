import { encodeNTPath, encodePosixPath } from "./tools";
import { OSType } from "./types/api";
import { DeepKeys, Simplify } from "./types/tool";

export class PromptBuilder<I extends string, O extends string, T = unknown> {
  prompt: T;
  mapInputKeys: Partial<Record<I, string | string[]>> = {};
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
   * Sets the input node for a given key. Can be map multiple keys to the same input.
   *
   * @param input - The input node to set.
   * @param key - The key(s) to associate with the input node. Can be array of keys.
   * @returns This builder instance.
   */
  setInputNode(input: I, key: DeepKeys<T> | Array<DeepKeys<T>>) {
    return this.setRawInputNode(input, key);
  }

  /**
   * Sets the raw input node for the given input and key. This will bypass the typing check. Use for dynamic nodes.
   *
   * @param input - The input node to be set.
   * @param key - The key associated with the input node.
   * @returns The current instance for method chaining.
   */
  setRawInputNode(input: I, key: string | string[]) {
    this.mapInputKeys[input] = key;
    return this.clone();
  }

  /**
   * Appends raw input node keys to the map of input keys. This will bypass the typing check. Use for dynamic nodes.
   *
   * @param input - The input node to which the keys will be appended.
   * @param key - The key or array of keys to append to the input node.
   * @returns A clone of the current instance with the updated input keys.
   */
  appendRawInputNode(input: I, key: string | string[]) {
    let keys = typeof key === "string" ? [key] : key;
    if (typeof this.mapInputKeys[input] === "string") {
      this.mapInputKeys[input] = [this.mapInputKeys[input] as string];
    }
    this.mapInputKeys[input]?.push(...keys);
    return this.clone();
  }

  /**
   * Appends mapped key into the input node.
   *
   * @param input - The input node to append.
   * @param key - The key(s) to associate with the input node. Can be array of keys.
   * @returns The updated prompt builder.
   */
  appendInputNode(input: I, key: DeepKeys<T> | Array<DeepKeys<T>>) {
    return this.appendRawInputNode(input, key);
  }

  /**
   * Sets the output node for a given key. This will bypass the typing check. Use for dynamic nodes.
   *
   * @param output - The output node to set.
   * @param key - The key to associate with the output node.
   * @returns This builder instance.
   */
  setRawOutputNode(output: O, key: string) {
    this.mapOutputKeys[output] = key;
    return this.clone();
  }

  /**
   * Sets the output node for a given key.
   *
   * @param output - The output node to set.
   * @param key - The key to associate with the output node.
   * @returns This builder instance.
   */
  setOutputNode(output: O, key: DeepKeys<T>) {
    return this.setRawOutputNode(output, key);
  }

  /**
   * Sets the value for a specific input key in the prompt builder.
   *
   * @template V - The type of the value being set.
   * @param {I} key - The input key.
   * @param {V} value - The value to set.
   * @param {OSType} [encodeOs] - The OS type to encode the path.
   * @returns A new prompt builder with the updated value.
   * @throws {Error} - If the key is not found.
   */
  input<V = string | number | undefined>(key: I, value: V, encodeOs?: OSType) {
    const newBuilder = this.clone();
    if (value !== undefined) {
      let valueToSet = value;
      /**
       * Handle encode path if needed, use for load models path
       */
      if (encodeOs === OSType.NT && typeof valueToSet === "string") {
        valueToSet = encodeNTPath(valueToSet) as typeof valueToSet;
      } else if (encodeOs === OSType.POSIX && typeof valueToSet === "string") {
        valueToSet = encodePosixPath(valueToSet) as typeof valueToSet;
      }

      /**
       * Map the input key to the path in the prompt object
       */
      let paths = newBuilder.mapInputKeys[key];
      if (!paths) {
        throw new Error(`Key ${key} not found`);
      }
      if (typeof paths === "string") {
        paths = [paths];
      }
      for (const path of paths as string[]) {
        const keys = path.split(".");
        let current = newBuilder.prompt as any;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {}; // Alow to set value to undefined path
          }
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = valueToSet;
      }
    }
    return newBuilder as Simplify<PromptBuilder<I, O, T>>;
  }

  /**
   * Sets the value for a any input key in the prompt builder.
   *
   * @template V - The type of the value being set.
   * @param {string} key - The input key.
   * @param {V} value - The value to set.
   * @param {OSType} [encodeOs] - The OS type to encode the path.
   * @returns A new prompt builder with the updated value.
   * @throws {Error} - If the key is not found.
   */
  inputRaw<V = string | number | undefined>(
    key: string,
    value: V,
    encodeOs?: OSType
  ) {
    const newBuilder = this.clone();
    if (value !== undefined) {
      let valueToSet = value;
      /**
       * Handle encode path if needed, use for load models path
       */
      if (encodeOs === OSType.NT && typeof valueToSet === "string") {
        valueToSet = encodeNTPath(valueToSet) as typeof valueToSet;
      } else if (encodeOs === OSType.POSIX && typeof valueToSet === "string") {
        valueToSet = encodePosixPath(valueToSet) as typeof valueToSet;
      }

      const keys = key.split(".");
      let current = newBuilder.prompt as any;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}; // Alow to set value to undefined path
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = valueToSet;
    }
    return newBuilder as Simplify<PromptBuilder<I, O, T>>;
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
