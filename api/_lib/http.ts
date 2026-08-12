export interface ApiRequest {
  method?: string;
  body?: unknown;
  /** `Authorization: Bearer …`를 읽으려면 필요하다. 로컬 플러그인도 같은 모양으로 넘긴다. */
  headers?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(payload: unknown): void;
}

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
