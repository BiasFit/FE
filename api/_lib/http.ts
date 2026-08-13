export interface ApiRequest {
  method?: string;
  body?: unknown;
  /** `Authorization: Bearer …`를 읽으려면 필요하다. 로컬 플러그인도 같은 모양으로 넘긴다. */
  headers?: Record<string, string | string[] | undefined>;
  /** `/api/outfit/deliver?x=1`. 묶음 함수가 어느 핸들러로 보낼지 여기서 읽는다. */
  url?: string;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(payload: unknown): void;
}

export type ApiHandler = (
  request: ApiRequest,
  response: ApiResponse,
) => void | Promise<void>;

export function readJsonBody(request: ApiRequest) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body) as unknown;
    } catch {
      throw new Error("요청 JSON 형식이 올바르지 않습니다.");
    }
  }
  return request.body;
}

export function requirePost(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "POST 요청만 허용됩니다." });
    return false;
  }
  return true;
}

export function sendApiError(response: ApiResponse, error: unknown) {
  const message =
    error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  response.status(400).json({ error: message });
}

/**
 * 주소의 마지막 조각을 꺼낸다. `/api/outfit/deliver?x=1` → `deliver`.
 *
 * Vercel의 `[action]` 동적 경로는 `req.query.action`도 채워 주지만 그건 쓰지 않는다.
 * 로컬 개발 서버에는 그 값이 없어서, 배포에서만 되는 코드가 되기 때문이다.
 * 양쪽에 다 있는 `url` 하나만 본다.
 */
export function routeAction(request: ApiRequest) {
  const path = (request.url ?? "").split("?", 1)[0].replace(/\/+$/, "");
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * 같은 폴더의 엔드포인트들을 서버리스 함수 하나로 묶는다.
 *
 * Vercel은 `api/` 아래 파일 하나를 함수 하나로 만드는데, 무료 플랜은 배포당 12개까지다.
 * 엔드포인트가 15개가 되면서 배포가 거부됐다. 핸들러는 `api/_routes/`로 옮기고
 * (`_`로 시작하면 함수가 되지 않는다) 폴더마다 이 묶음 함수 하나만 남겨 7개로 줄였다.
 *
 * **주소는 그대로다.** `/api/outfit/deliver`는 여전히 같은 주소이고, 프런트는 바뀌지 않는다.
 */
export function createRouter(routes: Record<string, ApiHandler>): ApiHandler {
  return async (request, response) => {
    const handler = routes[routeAction(request)];
    if (!handler) {
      response.status(404).json({ error: "요청 경로를 찾을 수 없습니다." });
      return;
    }
    await handler(request, response);
  };
}
