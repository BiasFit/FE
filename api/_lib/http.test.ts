import { describe, expect, it, vi } from "vitest";
import { createRouter, routeAction, type ApiRequest } from "./http";

function fakeResponse() {
  const sent: Array<{ status: number; payload: unknown }> = [];
  let status = 200;
  const response = {
    sent,
    status(code: number) {
      status = code;
      return response;
    },
    json(payload: unknown) {
      sent.push({ status, payload });
    },
  };
  return response;
}

describe("routeAction", () => {
  it("주소의 마지막 조각을 꺼낸다", () => {
    expect(routeAction({ url: "/api/outfit/deliver" })).toBe("deliver");
    expect(routeAction({ url: "/api/ai/priority-options" })).toBe("priority-options");
  });

  it("쿼리스트링과 끝 슬래시를 무시한다", () => {
    expect(routeAction({ url: "/api/outfit/get?matchResultId=abc" })).toBe("get");
    expect(routeAction({ url: "/api/outfit/get/" })).toBe("get");
  });

  it("url이 없으면 빈 문자열이다", () => {
    // 로컬 플러그인이 url을 안 넘기면 여기서 드러난다. 조용히 아무 핸들러나 부르지 않는다.
    expect(routeAction({} as ApiRequest)).toBe("");
  });
});

describe("createRouter", () => {
  it("주소에 맞는 핸들러만 부른다", async () => {
    const deliver = vi.fn();
    const get = vi.fn();
    const router = createRouter({ deliver, get });

    await router({ url: "/api/outfit/get", method: "POST" }, fakeResponse());

    expect(get).toHaveBeenCalledTimes(1);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("핸들러에 요청을 그대로 넘긴다", async () => {
    const save = vi.fn();
    const request: ApiRequest = {
      url: "/api/results/save",
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: '{"a":1}',
    };

    await createRouter({ save })(request, fakeResponse());

    // 토큰이 여기서 새면 모든 엔드포인트가 401이 된다.
    expect(save).toHaveBeenCalledWith(request, expect.anything());
  });

  it("모르는 주소는 404다", async () => {
    const response = fakeResponse();

    await createRouter({ get: vi.fn() })({ url: "/api/outfit/unknown" }, response);

    expect(response.sent).toEqual([
      { status: 404, payload: { error: "요청 경로를 찾을 수 없습니다." } },
    ]);
  });
});
