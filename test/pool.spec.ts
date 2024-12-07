import { ComfyPool, EQueueMode } from "../src/pool";
import { ComfyApi } from "../src/client";
import { test, describe, beforeEach, jest, expect } from "bun:test";

describe("ComfyPool", () => {
  let mockClient: ComfyApi;
  let comfyPool: ComfyPool;

  beforeEach(async () => {
    mockClient = {
      id: "client1",
      on: jest.fn((event, handler) => {
        if (event === "connected") {
          setTimeout(() => handler(), 0); // Simulate the connected event being dispatched
        }
        if (event === "status") {
          setTimeout(
            () =>
              handler({
                detail: {
                  status: { exec_info: { queue_remaining: 0 } },
                  sid: "sid"
                }
              }),
            0
          ); // Simulate the status event being dispatched
        }
      }),
      init: jest.fn().mockReturnValue({
        waitForReady: jest.fn().mockResolvedValue(undefined)
      }),
      ext: {
        monitor: {
          isSupported: false,
          on: jest.fn()
        }
      }
    } as unknown as ComfyApi;

    comfyPool = new ComfyPool([mockClient]);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  test("should initialize clients and dispatch init event", async () => {
    const initListener = jest.fn();

    comfyPool = new ComfyPool([mockClient]);
    comfyPool.addEventListener("init", initListener);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(initListener).toHaveBeenCalled();
    expect(mockClient.on).toHaveBeenCalled();
    expect(mockClient.init().waitForReady).toHaveBeenCalled();
  });

  test("should add a client to the pool", async () => {
    const newClient = { ...mockClient, id: "client2" } as ComfyApi;
    const addedListener = jest.fn();
    comfyPool.addEventListener("added", addedListener);

    await comfyPool.addClient(newClient);

    expect(comfyPool.clients).toContain(newClient);
    expect(addedListener).toHaveBeenCalled();
  });

  test("should remove a client from the pool", () => {
    const removedListener = jest.fn();
    comfyPool.addEventListener("removed", removedListener);

    comfyPool.removeClient(mockClient);

    expect(comfyPool.clients).not.toContain(mockClient);
    expect(removedListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { client: mockClient, clientIdx: 0 } })
    );
  });

  test("should remove a client from the pool by index", () => {
    const removedListener = jest.fn();
    comfyPool.addEventListener("removed", removedListener);
    comfyPool.removeClientByIndex(0);
    expect(comfyPool.clients).not.toContain(mockClient);
    expect(removedListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { client: mockClient, clientIdx: 0 } })
    );
  });

  test("should change the mode of the queue", () => {
    const changeModeListener = jest.fn();
    comfyPool.addEventListener("change_mode", changeModeListener);

    comfyPool.changeMode(EQueueMode.PICK_LOWEST);

    expect(comfyPool["mode"]).toBe(EQueueMode.PICK_LOWEST);
    expect(changeModeListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { mode: EQueueMode.PICK_LOWEST } })
    );
  });

  test("should pick a client by index", () => {
    const pickedClient = comfyPool.pick(0);
    expect(pickedClient).toBe(mockClient);
  });

  test("should pick a client by ID", () => {
    const pickedClient = comfyPool.pickById("client1");
    expect(pickedClient).toBe(mockClient);
  });

  test("should run a job and dispatch events", async () => {
    const job = jest.fn().mockResolvedValue("result");
    const executingListener = jest.fn();
    const executedListener = jest.fn();
    comfyPool.addEventListener("executing", executingListener);
    comfyPool.addEventListener("executed", executedListener);

    const result = await comfyPool.run(job);

    expect(job).toHaveBeenCalledWith(mockClient, 0);
    expect(executingListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { client: mockClient, clientIdx: 0 } })
    );
    expect(executedListener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { client: mockClient, clientIdx: 0 } })
    );
    expect(result).toBe("result");
  });

  test("should handle client disconnection/reconnection", async () => {
    const disconnectedListener = jest.fn();
    const reconnectedListener = jest.fn();
    const tryClient = {
      ...mockClient,
      on: jest.fn((event, handler) => {
        if (event === "disconnected") {
          setTimeout(() => handler(), 0); // Simulate the disconnected event being dispatched
        }
        if (event === "reconnected") {
          setTimeout(() => handler(), 50); // Simulate the reconnected event being dispatched
        }
      }),
      id: "client2"
    } as any as ComfyApi;
    comfyPool = new ComfyPool([tryClient]);
    comfyPool.addEventListener("disconnected", disconnectedListener);
    comfyPool.addEventListener("reconnected", reconnectedListener);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(disconnectedListener).toHaveBeenCalled();
    expect(reconnectedListener).toHaveBeenCalled();
  });

  test("should execute a batch of jobs", async () => {
    const job1 = jest.fn().mockResolvedValue("result1");
    const job2 = jest.fn().mockResolvedValue("result2");

    const newClient = { ...mockClient, id: "client2" } as ComfyApi;
    await comfyPool.addClient(newClient);

    const results = await comfyPool.batch([job1, job2]);

    expect(job1).toHaveBeenCalled();
    expect(job2).toHaveBeenCalled();
    expect(results).toEqual(["result1", "result2"]);
  });
});
