import type { Plugin } from "vite";

declare const process: { env: Record<string, string | undefined> };

interface LocalIncomingMessage {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  setEncoding(encoding: string): void;
  on(event: "data", listener: (chunk: string) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

interface LocalServerResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface LocalApiRequest {
  method?: string;
  body?: unknown;
  /**
   * Vercel Functions는 헤더를 그대로 넘겨준다. 로컬에서도 같아야
   * `Authorization: Bearer …`가 핸들러에 도달한다.
   * 이걸 빠뜨리면 로컬에서만 인증이 전부 401이 난다.
   */
  headers?: Record<string, string | string[] | undefined>;
}

interface LocalApiResponse {
  status(code: number): LocalApiResponse;
  json(payload: unknown): void;
}

export type LocalApiHandler = (
  request: LocalApiRequest,
  response: LocalApiResponse,
) => void | Promise<void>;

export type LocalApiRoutes = Record<string, LocalApiHandler>;

type NextFunction = (error?: unknown) => void;

const biasFitApiModules = {
  "/api/accounts/me": "/api/accounts/me.ts",
  "/api/accounts/upsert": "/api/accounts/upsert.ts",
  "/api/ai/match-explanations": "/api/ai/match-explanations.ts",
  "/api/ai/priority-options": "/api/ai/priority-options.ts",
  "/api/ai/style-dna-explanation": "/api/ai/style-dna-explanation.ts",
  "/api/matches/top-three": "/api/matches/top-three.ts",
  "/api/outfit/review": "/api/outfit/review.ts",
  "/api/results/save": "/api/results/save.ts",
};

function readRequestBody(request: LocalIncomingMessage) {
  return new Promise<string | undefined>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      resolve(body || undefined);
    });
    request.on("error", reject);
  });
}

function createApiResponse(response: LocalServerResponse): LocalApiResponse {
  const apiResponse: LocalApiResponse = {
    status(code) {
      response.statusCode = code;
      return apiResponse;
    },
    json(payload) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(payload));
    },
  };
  return apiResponse;
}

export function createLocalApiMiddleware(routes: LocalApiRoutes) {
  return async (
    request: LocalIncomingMessage,
    response: LocalServerResponse,
    next: NextFunction,
  ) => {
    const pathname = (request.url ?? "/").split("?", 1)[0];
    const handler = routes[pathname];
    if (!handler) {
      next();
      return;
    }

    try {
      await handler(
        {
          method: request.method,
          headers: request.headers ?? {},
          body: await readRequestBody(request),
        },
        createApiResponse(response),
      );
    } catch (error) {
      next(error);
    }
  };
}

interface LocalApiPluginOptions {
  environment: {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
}

export function localApiPlugin({ environment }: LocalApiPluginOptions): Plugin {
  return {
    name: "biasfit-local-api",
    apply: "serve",
    configureServer(server) {
      // 키는 서버 프로세스에만 넣는다. VITE_ 접두사를 쓰면 브라우저 번들에 박힌다.
      for (const [name, value] of Object.entries(environment)) {
        if (value) process.env[name] = value;
      }

      const routes = Object.fromEntries(
        Object.entries(biasFitApiModules).map(([path, moduleId]) => [
          path,
          async (request: LocalApiRequest, response: LocalApiResponse) => {
            const module = (await server.ssrLoadModule(moduleId)) as {
              default?: LocalApiHandler;
            };
            if (typeof module.default !== "function") {
              throw new Error(`Local API handler is missing: ${moduleId}`);
            }
            await module.default(request, response);
          },
        ]),
      );
      const middleware = createLocalApiMiddleware(routes);
      server.middlewares.use((request, response, next) => {
        void middleware(
          request as unknown as LocalIncomingMessage,
          response,
          next,
        );
      });
    },
  };
}
