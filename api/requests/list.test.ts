import { describe, expect, it } from "vitest";
import { loadAssignedRequests } from "./list";

/**
 * PostgREST는 관계의 형태에 따라 배열과 객체를 오간다.
 * `outfit_cards.match_result_id`에 unique가 걸려 있어 **객체 하나**로 오는데,
 * 이걸 배열로 단정했다가 첫 코디 카드가 생기는 순간 목록 전체가 500이 났다.
 */
function fakeClient(outfitCards: unknown) {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        maybeSingle: async () => ({
          data:
            table === "influencer_profiles"
              ? { id: "profile-1" }
              : table === "selected_tpos"
                ? { diagnosis_options: { code: "new_semester" } }
                : null,
          error: null,
        }),
        order: async () => ({
          data: [
            {
              id: "request-1",
              match_result_id: "match-1",
              status: "read",
              sent_at: "2026-08-13T09:00:00.000Z",
              match_results: {
                diagnosis_session_id: "session-1",
                diagnosis_sessions: { coaching_type: "personal" },
                outfit_cards: outfitCards,
              },
            },
          ],
          error: null,
        }),
      };
      return chain;
    },
  } as unknown as Parameters<typeof loadAssignedRequests>[1];
}

describe("loadAssignedRequests", () => {
  it("코디 카드가 객체 하나로 와도 전달 완료로 읽는다", async () => {
    const [request] = await loadAssignedRequests(
      "account-1",
      fakeClient({ status: "delivered" }),
    );

    expect(request.delivered).toBe(true);
    expect(request.tpoLabel).toBe("개강 행사");
  });

  it("배열로 와도 같은 결과를 낸다", async () => {
    const [request] = await loadAssignedRequests(
      "account-1",
      fakeClient([{ status: "delivered" }]),
    );

    expect(request.delivered).toBe(true);
  });

  it("아직 카드가 없으면 작성 필요다", async () => {
    const [request] = await loadAssignedRequests("account-1", fakeClient(null));

    expect(request.delivered).toBe(false);
  });
});
