import { describe, it, expect, vi } from "vitest";

// Mock Redis to test configuration without actual Redis connection
vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      private url: string;
      private options: any;
      
      constructor(url: string, options?: any) {
        this.url = url;
        this.options = options;
      }
      
      getConnectionConfig() {
        return { url: this.url, options: this.options };
      }
    }
  };
});

// Mock config to provide test values
vi.mock("../src/config.js", () => ({
  cfg: {
    redisUrl: "redis://localhost:6379"
  }
}));

describe("Queue Configuration", () => {
  it("should configure Redis connection with BullMQ-compatible options", async () => {
    // Import after mocks are set up
    const { connection } = await import("../src/queue.js");
    
    const config = (connection as any).getConnectionConfig();
    
    // Verify BullMQ required options are set
    expect(config.options).toBeDefined();
    expect(config.options.maxRetriesPerRequest).toBe(null);
    expect(config.options.enableOfflineQueue).toBe(false);
    expect(config.url).toBe("redis://localhost:6379");
  });
  
  it("should export all required queues", async () => {
    const { planQueue, execQueue, evalQueue, sweepQueue } = await import("../src/queue.js");
    
    expect(planQueue).toBeDefined();
    expect(execQueue).toBeDefined();
    expect(evalQueue).toBeDefined();
    expect(sweepQueue).toBeDefined();
  });
});