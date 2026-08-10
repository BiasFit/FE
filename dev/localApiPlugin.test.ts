import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalApiMiddleware } from "./localApiPlugin";

const servers: Server[] = [];

async function startServer(
  middleware: ReturnType<typeof createLocalApiMiddleware>,
) {
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.statusCode = 418;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ next: true }));
    });
  });
  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

describe("createLocalApiMiddleware", () => {
  it("passes a POST body to a registered API handler", async () => {
    const middleware = createLocalApiMiddleware({
      "/api/example": async (request, response) => {
        const body = JSON.parse(String(request.body)) as { choice: string };
        response.status(201).json({ received: body.choice });
      },
    });
    const origin = await startServer(middleware);

    const response = await fetch(`${origin}/api/example?source=browser`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice: "style_first" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      received: "style_first",
    });
  });

  it("delegates an unregistered path to the next middleware", async () => {
    const middleware = createLocalApiMiddleware({});
    const origin = await startServer(middleware);

    const response = await fetch(`${origin}/not-an-api`);

    expect(response.status).toBe(418);
    await expect(response.json()).resolves.toEqual({ next: true });
  });
});
