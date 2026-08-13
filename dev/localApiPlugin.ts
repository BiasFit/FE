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
  /** 묶음 함수가 어느 핸들러로 보낼지 결정하는 값. 없으면 전부 404가 된다. */
  url?: string;
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

/**
 * 주소 → 그 주소를 처리하는 **묶음 함수** 파일.
 *
 * 핸들러 파일을 직접 가리키지 않고 일부러 `[action].ts`를 거친다.
 * 그래야 로컬과 Vercel이 **같은 경로 분기 코드를 통과**한다.
 * 여기서 지름길을 내면 "로컬은 되는데 배포는 안 되는" 상태가 다시 생긴다.
 *
 * 주소 목록을 손으로 유지하는 이유는, 이 파일이 곧 열려 있는 주소의 목록이기 때문이다.
 * 새 엔드포인트를 만들면 **여기와 해당 `[action].ts` 두 곳에 등록**한다.
 */
const biasFitApiModules = {
  "/api/accounts/me": "/api/accounts/[action].ts",
  "/api/accounts/upsert": "/api/accounts/[action].ts",
  "/api/ai/match-explanations": "/api/ai/[action].ts",
  "/api/ai/priority-options": "/api/ai/[action].ts",
  "/api/ai/style-dna-explanation": "/api/ai/[action].ts",
  "/api/influencers/list": "/api/influencers/[action].ts",
  "/api/influencers/upsert": "/api/influencers/[action].ts",
  "/api/matches/top-three": "/api/matches/[action].ts",
  "/api/outfit/deliver": "/api/outfit/[action].ts",
  "/api/outfit/get": "/api/outfit/[action].ts",
  "/api/outfit/review": "/api/outfit/[action].ts",
  "/api/requests/list": "/api/requests/[action].ts",
  "/api/requests/send": "/api/requests/[action].ts",
  "/api/results/get": "/api/results/[action].ts",
  "/api/results/save": "/api/results/[action].ts",
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
          url: request.url,
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
