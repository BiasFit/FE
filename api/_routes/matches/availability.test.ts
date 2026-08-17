import { describe, expect, it } from "vitest";
import { isInfluencerAvailable, validateAvailabilityInput } from "./availability.js";

/**
 * Supabase 클라이언트를 흉내 낸다. `availability.ts`가 쓰는 두 갈래만 답한다.
 * `loadReceivedRequestCounts`가 같은 클라이언트로 `influencer_profiles`와
 * `request_cards`를 읽으므로 표 이름으로 갈라 준다.
 */
function fakeClient(options: {
  profileStatus?: string | null;
  limit?: number;
  cards?: number;
  loginId?: string;
}) {
  const loginId = options.loginId ?? "stylemate-01";
  const profileId = "profile-1";

  return {
    from(table: string) {
      if (table === "request_cards") {
        return {
          select: () => ({
            in: () => ({
              data: Array.from({ length: options.cards ?? 0 }, () => ({
                receiver_influencer_profile_id: profileId,
              })),
              error: null,
            }),
          }),
        };
      }

      // influencer_profiles는 두 곳에서 읽힌다.
      // 1) availability의 단건 조회(.eq(...).maybeSingle())
      // 2) loadReceivedRequestCounts의 전체 조회(select만)
      const rows =
        options.profileStatus === null
          ? []
          : [
              {
                id: profileId,
                profile_status: options.profileStatus ?? "completed",
                max_received_request_count: options.limit ?? 3,
                accounts: { dummy_login_id: loginId },
              },
            ];
      const result = { data: rows, error: null };
      return {
        select: () =>
          Object.assign(Promise.resolve(result), {
            eq: () => ({
              maybeSingle: () => ({ data: rows[0] ?? null, error: null }),
            }),
          }),
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("validateAvailabilityInput", () => {
  it("influencerId를 받는다", () => {
    expect(validateAvailabilityInput({ influencerId: " stylemate-01 " })).toBe("stylemate-01");
  });

  it("비어 있으면 거절한다", () => {
    expect(() => validateAvailabilityInput({})).toThrow(/스타일메이트/);
    expect(() => validateAvailabilityInput({ influencerId: "  " })).toThrow(/스타일메이트/);
    expect(() => validateAvailabilityInput(null)).toThrow(/스타일메이트/);
  });
});

describe("isInfluencerAvailable", () => {
  it("여유가 있으면 true", async () => {
    await expect(
      isInfluencerAvailable("stylemate-01", fakeClient({ cards: 2, limit: 3 })),
    ).resolves.toBe(true);
  });

  it("한도에 닿으면 false", async () => {
    await expect(
      isInfluencerAvailable("stylemate-01", fakeClient({ cards: 3, limit: 3 })),
    ).resolves.toBe(false);
  });

  it("한도를 넘겨 있어도 false", async () => {
    await expect(
      isInfluencerAvailable("stylemate-01", fakeClient({ cards: 4, limit: 3 })),
    ).resolves.toBe(false);
  });

  it("프로필이 없으면 false", async () => {
    await expect(
      isInfluencerAvailable("stylemate-01", fakeClient({ profileStatus: null })),
    ).resolves.toBe(false);
  });

  it("프로필이 완료 전이면 false — TOP 3 후보 조건과 같다", async () => {
    await expect(
      isInfluencerAvailable("stylemate-01", fakeClient({ profileStatus: "incomplete" })),
    ).resolves.toBe(false);
  });
});
