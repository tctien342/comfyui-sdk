import { randomInt, delay, seed, encodeNTPath, encodePosixPath } from "src/tools";

describe("randomInt", () => {
  it("should generate a random integer within the specified range", () => {
    const min = 1;
    const max = 10;
    const result = randomInt(min, max);
    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("delay", () => {
  it("should delay execution for the specified number of milliseconds", async () => {
    const ms = 1000;
    const start = Date.now();
    await delay(ms);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(ms);
  });
});

describe("seed", () => {
  it("should generate a random seed within the specified range", () => {
    const result = seed();
    expect(result).toBeGreaterThanOrEqual(10000000000);
    expect(result).toBeLessThanOrEqual(999999999999);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("encodeNTPath", () => {
  it("should encode a POSIX path to an NT path", () => {
    const path = "SDXL/realvisxlV40";
    const result = encodeNTPath(path);
    expect(result).toBe("SDXL\\realvisxlV40");
  });
});

describe("encodePosixPath", () => {
  it("should encode an NT path to a POSIX path", () => {
    const path = "SDXL\\realvisxlV40";
    const result = encodePosixPath(path);
    expect(result).toBe("SDXL/realvisxlV40");
  });
});
