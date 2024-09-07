# ComfyUI API Client

A comprehensive Node.js client library for interacting with ComfyUI APIs. This powerful and flexible library provides a robust set of tools for managing ComfyUI instances, building prompts, and executing workflows with ease and type safety.

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Core Concepts](#core-concepts)
4. [Basic Usage](#basic-usage)
5. [Advanced Usage](#advanced-usage)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Contributing](#contributing)
11. [License](#license)

## Features

- **Multi-instance Support**: Manage multiple ComfyUI instances with an intuitive connection pooling system.
- **Type-safe Prompt Building**: Construct workflows with a powerful `PromptBuilder` that ensures type safety for inputs and outputs.
- **Real-time Updates**: WebSocket support for receiving live updates during workflow execution.
- **Robust Error Handling**: Automatic reconnection and comprehensive error management.
- **Authentication Support**: Built-in support for basic authentication (ComfyUI behind NginX with basic auth).
- **Event-driven Architecture**: Detailed event system for monitoring execution progress and handling various states.
- **Flexible Execution Modes**: Choose from different execution modes to optimize for your specific use case.

## Installation

Install the package using npm:

```bash
npm install @saintno/comfyui-sdk
```

Or using bun:

```bash
bun add @saintno/comfyui-sdk
```

## Core Concepts

- **ComfyApi**: The main client for interacting with a single ComfyUI instance.
- **ComfyPool**: A manager for multiple ComfyUI instances, providing load balancing.
- **PromptBuilder**: A utility for constructing workflows with type-safe inputs and outputs.
- **CallWrapper**: A wrapper for API calls that provides comprehensive event handling and execution control.

## Basic Usage

### Setting up a ComfyApi instance

```typescript
import { ComfyApi } from "@saintno/comfyui-sdk";

const api = new ComfyApi("http://localhost:8188", "client-id");
api.on("log", (ev) => console.log(ev.detail)); // Debug logs
await api
  .init(
    1000 // Retry 1000 times before giving up, default 10 [optional]
    1000 // Retry every 1000ms, default 1000ms [optional]
  ) // Initialize websocket
  .waitForReady(); // Wait for the client to be ready
```

### Creating a PromptBuilder

```typescript
import { PromptBuilder } from "@saintno/comfyui-sdk";
import workflowJson from "./workflow.json"; // Get from `Save (API Format)` or `Export (API Format)` from ComfyUI Web

const promptBuilder = new PromptBuilder(
  workflowJson,
  ["checkpoint", "positive", "negative", "seed", "steps"], // Input keys
  ["images"] // Output keys
)
  .setInputNode("checkpoint", "4.inputs.ckpt_name")
  .setInputNode("positive", "6.inputs.text")
  .setInputNode("negative", "7.inputs.text")
  .setInputNode("seed", "3.inputs.seed")
  .setInputNode("steps", "3.inputs.steps")
  .setInputNode("size", ["7.inputs.width", "7.inputs.height"]) // Bind multiple values to a single key
  .setOutputNode("images", "9");
```

### Executing a Workflow

```typescript
import { CallWrapper } from "@saintno/comfyui-sdk";

const workflow = promptBuilder
  .input(
    "checkpoint",
    "SDXL/realvisxlV40_v40LightningBakedvae.safetensors",
    /**
     * Use the client's osType to encode the path
     *
     * For example, if the client's `osType` is "nt" (Windows), the path should be encoded as below
     * "SDXL\\realvisxlV40_v40LightningBakedvae.safetensors"
     */
    api.osType // This is optional, but recommended it you want to support multiple platforms
  )
  .input("positive", "A beautiful landscape")
  .input("negative", "blurry, text")
  .input("seed", 42)
  .input("steps", 20);

new CallWrapper(api, workflow)
  .onStart((promptId) => console.log(`Task ${promptId} started`))
  .onProgress((info, promptId) =>
    console.log(`Task ${promptId} progress:`, info)
  )
  .onFinished((data, promptId) =>
    console.log(`Task ${promptId} finished:`, data)
  )
  .run();
```

You can use `api.getCheckpoints()` to get the list of available checkpoints.

```typescript
const client = new ComfyApi("http://localhost:8188");
await client.getCheckpoints().then(console.log);
```

## Advanced Usage

### ComfyUI Manager

> Support interact with ComfyUI-Manager extesion, require [ComfyUI-Manager](https://github.com/ltdrdata/ComfyUI-Manager) to be installed in the ComfyUI instance.

```typescript
const api = new ComfyApi("http://localhost:8189").init();
/**
 * Should wait for the client to be ready for checking supported extensions
 */
await api.waitForReady();

if (api.ext.manager.isSupported) {
  /**
   * Get the list of all extensions
   */
  await api.ext.manager.getExtensionList().then(console.log);
  //More methods are available, check the `api.ext.manager` reference for more details
}
```

### ComfyUI Crystools

> Support listen event from ComfyUI-Crystools extension for tracking system resources, require [ComfyUI-Crystools](https://github.com/crystian/ComfyUI-Crystools) to be installed in the ComfyUI instance.

```typescript
const api = new ComfyApi("http://localhost:8189").init();
/**
 * Should wait for the client to be ready for checking supported extensions
 */
await api.waitForReady();

if (api.ext.monitor.isSupported) {
  /**
   * Listen to the system monitor event
   */
  api.ext.monitor.on("system_monitor", (ev) => {
    console.log(ev.detail);
  });
  /**
   * Current monitoring data
   */
  console.log(api.ext.monitor.monitorData);
}
```

### Connection Pooling

```typescript
import { ComfyPool, EQueueMode } from "@saintno/comfyui-sdk";

const pool = new ComfyPool(
  [
    new ComfyApi("http://localhost:8188", "node-1"),
    new ComfyApi("http://localhost:8189", "node-2"),
  ],
  //   "PICK_ZERO", Picks the client which has zero queue remaining. This is the default mode. (For who using along with ComfyUI web interface)
  //   "PICK_LOWEST", Picks the client which has the lowest queue remaining.
  //   "PICK_ROUTINE", Picks the client in a round-robin manner.
  EQueueMode.PICK_ZERO
);

pool.run(async (api, clientIdx) => {
  // Your workflow execution logic here
});

// Or execute multiple jobs in parallel
pool.batch([
  (api) => executeWorkflow(api, params1),
  (api) => executeWorkflow(api, params2),
  // ...
]);
```

### Authentication

```typescript
const api = new ComfyApi("http://localhost:8188", "client-id", {
  credentials: {
    type: "basic",
    username: "your-username",
    password: "your-password",
  },
});
```

## API Reference

### ComfyApi

- `constructor(host: string, clientId?: string, opts?: { credentials?: BasicCredentials })`
- `queuePrompt(number: number, workflow: object): Promise<QueuePromptResponse | false>`
- `getQueue(): Promise<QueueResponse>`
- `getHistories(maxItems?: number): Promise<HistoryResponse>`
- `getSystemStats(): Promise<SystemStatsResponse>`
- `uploadImage(file: Buffer | Blob, fileName: string, config?: { override?: boolean, subfolder?: string }): Promise<{ info: ImageInfo; url: string } | false>`

### ComfyPool

- `constructor(clients: ComfyApi[], mode: EQueueMode = EQueueMode.PICK_ZERO)`
- `run<T>(job: (client: ComfyApi, clientIdx?: number) => Promise<T>, weight?: number): Promise<T>`
- `batch<T>(jobs: Array<(client: ComfyApi, clientIdx?: number) => Promise<T>>, weight?: number): Promise<T[]>`

### PromptBuilder

- `constructor(prompt: T, inputKeys: I[], outputKeys: O[])`
- `setInputNode(input: I, key: DeepKeys<T>): this`
- `setOutputNode(output: O, key: DeepKeys<T>): this`
- `input<V = string | number | undefined>(key: I, value: V): PromptBuilder<I, O, object>`

### CallWrapper

- `constructor(client: ComfyApi, workflow: T)`
- `onPreview(fn: (ev: Blob, promptId?: string) => void): this`
- `onPending(fn: (promptId?: string) => void): this`
- `onStart(fn: (promptId?: string) => void): this`
- `onFinished(fn: (data: Record<keyof T["mapOutputKeys"], any>, promptId?: string) => void): this`
- `onFailed(fn: (err: Error, promptId?: string) => void): this`
- `onProgress(fn: (info: NodeProgress, promptId?: string) => void): this`
- `run(): Promise<Record<keyof T["mapOutputKeys"], any> | undefined | false>`

## Configuration

The library supports various configuration options, including:

- Setting up multiple ComfyUI instances
- Configuring authentication credentials
- Choosing execution modes for the connection pool

Refer to the individual class constructors for specific configuration options.

## Error Handling

The library provides comprehensive error handling through the event system. Use the `onFailed` method of `CallWrapper` to catch and handle errors during execution.

## Best Practices

1. Always use `PromptBuilder` to ensure type safety when constructing workflows.
2. Utilize `ComfyPool` for managing multiple ComfyUI instances to improve reliability and load distribution.
3. Implement proper error handling using the provided event callbacks.
4. Use `batch` method of `ComfyPool` for parallel execution of multiple workflows.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

This README provides a comprehensive overview of the ComfyUI API Client library, including detailed usage examples, API references, and best practices. It should give users a solid understanding of how to use and configure the library for their needs.
