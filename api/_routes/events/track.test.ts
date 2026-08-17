import { describe, expect, it, vi } from "vitest";
import handler, { recordEvent, validateTrackInput } from "./track.js";

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

/** supabase 쿼리 빌더 흉내. `from(...).insert(...)`만 쓴다. */
function fakeClient(error: unknown = null) {
  const inserts: unknown[] = [];
  const client = {
    inserts,
    from() {
      return {
        async insert(row: unknown) {
          inserts.push(row);
          return { error };
        },
      };
    },
  };
  return client as unknown as Parameters<typeof recordEvent>[2] & { inserts: unknown[] };
}

describe("validateTrackInput", () => {
  it("정해 둔 이벤트만 받는다", () => {
    // 오타난 이름을 받아 두면 집계에서 조용히 빠진다.
    expect(() => validateTrackInput({ eventName: "outfit_image_saved" })).toThrow(
      "기록할 수 있는 이벤트가 아닙니다.",
    );
    expect(() => validateTrackInput({ eventName: "" })).toThrow(
      "기록할 수 있는 이벤트가 아닙니다.",
    );
    expect(() => validateTrackInput(null)).toThrow("이벤트 내용이 없습니다.");
  });

  it("세 이벤트는 그대로 통과한다", () => {
    for (const eventName of ["style_dna_viewed", "influencer_selected", "outfit_image_save"]) {
      expect(validateTrackInput({ eventName })).toMatchObject({ eventName });
    }
  });

  it("익명 키와 화면 이름은 없어도 된다", () => {
    expect(validateTrackInput({ eventName: "style_dna_viewed" })).toEqual({
      eventName: "style_dna_viewed",
      anonUserKey: undefined,
      screen: undefined,
    });
    // 빈 문자열은 값이 없는 것과 같게 다룬다.
    expect(validateTrackInput({ eventName: "style_dna_viewed", screen: "   " }).screen).toBeUndefined();
  });

  it("너무 긴 값은 자르지 않고 거절한다", () => {
    // 조용히 잘라 두면 나중에 값이 왜 다른지 알 수 없다.
    expect(() =>
      validateTrackInput({ eventName: "style_dna_viewed", anonUserKey: "x".repeat(101) }),
    ).toThrow("익명 키가 너무 깁니다.");
    expect(() =>
      validateTrackInput({ eventName: "outfit_image_save", screen: "y".repeat(41) }),
    ).toThrow("화면 이름이 너무 깁니다.");
  });
});

describe("recordEvent", () => {
  it("로그인하지 않아도 익명 키만으로 남긴다", async () => {
    const client = fakeClient();

    await recordEvent(null, { eventName: "outfit_image_save", anonUserKey: "anon-1", screen: "outfit" }, client);

    // 계정을 못 붙였다고 이벤트를 버리면, 로그인 만료 구간의 숫자가 통째로 사라진다.
    expect(client.inserts[0]).toEqual({
      event_name: "outfit_image_save",
      account_id: null,
      anon_key: "anon-1",
      screen: "outfit",
    });
  });

  it("계정이 있으면 함께 남긴다", async () => {
    const client = fakeClient();

    await recordEvent("acc-1", { eventName: "influencer_selected" }, client);

    expect(client.inserts[0]).toMatchObject({
      event_name: "influencer_selected",
      account_id: "acc-1",
      anon_key: null,
      screen: null,
    });
  });

  it("Supabase 오류 원문을 그대로 내보내지 않는다", async () => {
    const client = fakeClient({ code: "42P01", message: 'relation "public.client_events" does not exist' });

    await expect(recordEvent(null, { eventName: "style_dna_viewed" }, client)).rejects.toThrow(
      "이벤트를 기록하지 못했어요.",
    );
  });
});

describe("events/track 핸들러", () => {
  it("POST가 아니면 405다", async () => {
    const response = fakeResponse();

    await handler({ method: "GET", url: "/api/events/track" }, response);

    expect(response.sent[0].status).toBe(405);
  });

  it("모르는 이벤트는 400이고 Supabase를 부르지 않는다", async () => {
    // 검증이 먼저라, 잘못된 이름은 DB나 토큰 검사에 닿기 전에 걸러진다.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = fakeResponse();

    await handler(
      { method: "POST", url: "/api/events/track", body: JSON.stringify({ eventName: "clicked" }) },
      response,
    );

    expect(response.sent[0]).toMatchObject({
      status: 400,
      payload: { error: "기록할 수 있는 이벤트가 아닙니다." },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
