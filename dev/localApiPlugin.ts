import type { Plugin } from "vite";
import { LOCAL_DB_STUBS } from "./localDb.js";

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
  "/api/mypage/overview": "/api/mypage/[action].ts",
  "/api/outfit/deliver": "/api/outfit/[action].ts",
  "/api/outfit/get": "/api/outfit/[action].ts",
  "/api/outfit/review": "/api/outfit/[action].ts",
  "/api/requests/list": "/api/requests/[action].ts",
  "/api/requests/send": "/api/requests/[action].ts",
  "/api/results/get": "/api/results/[action].ts",
  "/api/results/save": "/api/results/[action].ts",
};

/**
 * OPENAI_API_KEY 없이 로컬에서 화면만 미리 볼 때 쓰는 고정 응답들.
 * 실제 배포에서는 절대 쓰이지 않는다 — 이 파일은 `apply: "serve"`로 dev 서버에만 붙고,
 * 아래 분기도 키가 있으면 타지 않는다 (디자인 리뷰용, 2026-08-16).
 */
const LOCAL_AI_STUBS: Record<string, (body: unknown) => unknown> = {
  "/api/ai/priority-options": () => ({
    question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
    options: [
      { code: "style_first", label: "좋아하는 분위기를 먼저 지키고 싶어요", evidenceRefs: ["preferredStyle"] },
      { code: "fit_first", label: "편안한 핏을 먼저 맞추고 싶어요", evidenceRefs: ["fitConcerns"] },
      { code: "budget_first", label: "정한 예산을 먼저 지키고 싶어요", evidenceRefs: ["budgetApproach"] },
      { code: "tpo_first", label: "필요한 상황에 먼저 맞추고 싶어요", evidenceRefs: ["tpo"] },
    ],
  }),
  "/api/ai/style-dna-explanation": (body) => {
    const mode = (body as { mode?: string } | null)?.mode;
    if (mode === "group") {
      return {
        mode: "group",
        groupStyleDnaSummary: "자연스러운 A와 단정한 B의 기준을 함께 살린 스타일 (로컬 미리보기 문구)",
        groupStyleDnaSummaryEvidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
        groupCombination: {
          score: 78,
          directionSimilarity: 55,
          budgetCoordination: 23,
          title: "각자의 무드를 살린 연결",
          description: "각자의 분위기를 유지하면서 함께 어울리는 방향을 찾아요.",
          evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
        },
        groupMatchingPoints: [
          { text: "A와 B의 핏 고민을 함께 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
          { text: "공통 TPO 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
        ],
      };
    }
    return {
      mode: "personal",
      personalStyleDnaSummary: "무채색 데님 베이스에 단정함을 더한 캐주얼 (로컬 미리보기 문구)",
      personalStyleDnaSummaryEvidenceRefs: ["personal.preferredStyle"],
      personalMatchingPoints: [
        { text: "전체 비율과 하의 기장을 고려해요.", evidenceRefs: ["personal.fitConcerns.0"] },
        { text: "선택한 상황과 예산을 함께 반영해요.", evidenceRefs: ["personal.tpo", "personal.budgetRange"] },
      ],
    };
  },
  "/api/ai/match-explanations": (body) => {
    const candidates = (body as { rankedInfluencers?: Array<Record<string, unknown>> } | null)?.rankedInfluencers ?? [];
    return {
      explanations: candidates.map((candidate) => {
        const evidence = Object.values(candidate.matchedEvidence ?? {}).flat() as Array<{ ref: string }>;
        return {
          influencerId: candidate.influencerId,
          strongestCategory: "fit",
          summary: "핏과 TPO 기준을 함께 반영해 추천했어요. (로컬 미리보기 문구)",
          evidenceRefs: evidence.slice(0, 1).map(({ ref }) => ref),
        };
      }),
    };
  },
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
            const stub = LOCAL_AI_STUBS[path];
            if (stub && !environment.OPENAI_API_KEY) {
              const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
              response.status(200).json(stub(body));
              return;
            }
            // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 없이도 TOP3 이후 화면을 눌러보려고 쓰는
            // 더미 저장소. `LOCAL_AI_STUBS`와 같은 이유·같은 방식이다 (2026-08-16).
            const dbStub = LOCAL_DB_STUBS[path];
            if (dbStub && (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY)) {
              try {
                const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
                response.status(200).json(dbStub(body));
              } catch (error) {
                response
                  .status(400)
                  .json({ error: error instanceof Error ? error.message : "로컬 더미 데이터 처리 중 오류가 났어요." });
              }
              return;
            }
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
