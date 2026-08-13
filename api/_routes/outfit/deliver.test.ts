import { describe, expect, it } from "vitest";
import type { OutfitReviewResponse } from "../../../src/domain/aiContracts.js";
import { deliverOutfitCard, validateDeliverInput, type DeliverOutfitInput } from "./deliver.js";

const personalInput: DeliverOutfitInput = {
  matchResultId: "match-1",
  title: "부드러운 캠퍼스 레이어드",
  message: "허리선이 자연스럽게 잡히는 길이로 골랐어요.",
  cards: [
    {
      memberId: "self",
      top: { name: "소프트 핑크 가디건", url: "https://shop.test/top/1" },
      bottom: { name: "아이보리 A라인 스커트", url: "https://shop.test/bottom/1" },
    },
  ],
};

function review(status: OutfitReviewResponse["reviewStatus"]): OutfitReviewResponse {
  return {
    reviewStatus: status,
    safeLanguageIssues: [],
    linkChecks: [
      {
        memberId: "self",
        itemType: "top",
        inputUrl: "https://shop.test/top/1",
        finalUrl: "https://shop.test/top/1",
        status: status === "pass" ? "pass" : "needs_revision",
        reason: "제품 페이지에 접속할 수 있습니다.",
        action: "조치 없음",
      },
      {
        memberId: "self",
        itemType: "bottom",
        inputUrl: "https://shop.test/bottom/1",
        finalUrl: "https://shop.test/bottom/1",
        status: "pass",
        reason: "제품 페이지에 접속할 수 있습니다.",
        action: "조치 없음",
      },
    ],
  };
}

/**
 * Supabase 쿼리 빌더 흉내.
 * `select(...).eq(...).maybeSingle()` 체인과 insert/update/delete만 지원한다.
 */
function fakeClient(
  overrides: {
    receiverProfileId?: string;
    existingCard?: { id: string; status: string } | null;
    coachingType?: "personal" | "group";
    failItems?: boolean;
  } = {},
) {
  const inserted: Array<{ table: string; rows: unknown }> = [];
  const updated: Array<{ table: string; row: unknown }> = [];
  const deleted: Array<{ table: string; id: unknown }> = [];
  const coachingType = overrides.coachingType ?? "personal";

  const rowsFor = (table: string): Record<string, unknown> | null => {
    switch (table) {
      case "influencer_profiles":
        return { id: "profile-mine" };
      case "request_cards":
        return {
          id: "request-1",
          receiver_influencer_profile_id: overrides.receiverProfileId ?? "profile-mine",
          match_results: {
            account_id: "user-1",
            style_dna_result_id: "dna-1",
            diagnosis_session_id: "session-1",
          },
        };
      case "diagnosis_sessions":
        return { coaching_type: coachingType };
      case "selected_tpos":
        return { tpo_option_id: "tpo-new-semester" };
      case "outfit_cards":
        return overrides.existingCard ?? null;
      default:
        return null;
    }
  };

  const listFor = (table: string): Array<Record<string, unknown>> => {
    if (table === "session_members") {
      return coachingType === "group"
        ? [
            { id: "member-a", member_label: "A" },
            { id: "member-b", member_label: "B" },
          ]
        : [{ id: "member-self", member_label: "self" }];
    }
    if (table === "member_style_inputs") {
      return coachingType === "group"
        ? [
            {
              session_member_id: "member-a",
              budget_min_option_id: "budget-2",
              budget_max_option_id: "budget-3",
              budget_strategy_option_id: "strategy-a",
              min: { code: "2" },
              max: { code: "3" },
            },
            {
              session_member_id: "member-b",
              budget_min_option_id: "budget-1",
              budget_max_option_id: "budget-5",
              budget_strategy_option_id: "strategy-b",
              min: { code: "1" },
              max: { code: "5" },
            },
          ]
        : [
            {
              session_member_id: "member-self",
              budget_min_option_id: "budget-2",
              budget_max_option_id: "budget-3",
              budget_strategy_option_id: "strategy-a",
              min: { code: "2" },
              max: { code: "3" },
            },
          ];
    }
    return [];
  };

  const client = {
    inserted,
    updated,
    deleted,
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        in: async () => ({ data: listFor(table), error: null }),
        order: async () => ({ data: listFor(table), error: null }),
        maybeSingle: async () => ({ data: rowsFor(table), error: null }),
        insert(rows: unknown) {
          if (table === "outfit_card_items" && overrides.failItems) {
            return {
              then: (resolve: (value: unknown) => unknown) =>
                resolve({ error: { message: "boom" } }),
            };
          }
          inserted.push({ table, rows });
          return {
            select: () => ({
              single: async () => ({ data: { id: `${table}-1` }, error: null }),
            }),
            then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
          };
        },
        update(row: unknown) {
          updated.push({ table, row });
          return { eq: async () => ({ error: null }) };
        },
        delete() {
          return {
            eq: async (_column: string, id: unknown) => {
              deleted.push({ table, id });
              return { error: null };
            },
          };
        },
      };
      return chain;
    },
  };

  return client as unknown as Parameters<typeof deliverOutfitCard>[2] & {
    inserted: typeof inserted;
    updated: typeof updated;
    deleted: typeof deleted;
  };
}

describe("validateDeliverInput", () => {
  it("제목과 전하는 말이 없으면 거절한다", () => {
    expect(() => validateDeliverInput({ ...personalInput, title: " " })).toThrow(
      "코디 카드 제목을 입력해 주세요.",
    );
    expect(() => validateDeliverInput({ ...personalInput, message: "" })).toThrow(
      "사용자에게 전하는 말을 입력해 주세요.",
    );
  });

  it("http/https가 아닌 상품 링크를 거절한다", () => {
    expect(() =>
      validateDeliverInput({
        ...personalInput,
        cards: [
          {
            memberId: "self",
            top: { name: "가디건", url: "javascript:alert(1)" },
            bottom: { name: "스커트", url: "https://shop.test/bottom/1" },
          },
        ],
      }),
    ).toThrow("상의 상품 링크는 http 또는 https로 시작해야 해요.");
  });
});

describe("deliverOutfitCard", () => {
  it("검수를 통과하지 못하면 아무것도 저장하지 않는다", async () => {
    const client = fakeClient();

    const result = await deliverOutfitCard("account-influencer", personalInput, client, {
      review: async () => review("needs_revision"),
    });

    expect(result.delivered).toBe(false);
    expect(result.outfitCardId).toBeNull();
    // 초안은 서버에 남기지 않는다 (DB_SCHEMA.md 6장).
    expect(client.inserted).toEqual([]);
    expect(client.updated).toEqual([]);
  });

  it("pass일 때만 delivered 상태로 저장한다", async () => {
    const client = fakeClient();

    const result = await deliverOutfitCard("account-influencer", personalInput, client, {
      review: async () => review("pass"),
    });

    expect(result.delivered).toBe(true);
    const card = client.inserted.find((entry) => entry.table === "outfit_cards")
      ?.rows as Record<string, unknown>;
    expect(card.review_status).toBe("pass");
    expect(card.status).toBe("delivered");
    expect(card.delivered_at).toEqual(expect.any(String));
    // 예산은 인플루언서가 정하지 않고 요청 정보를 그대로 옮긴다.
    expect(card.budget_min_option_id).toBe("budget-2");
    expect(card.budget_max_option_id).toBe("budget-3");

    const items = client.inserted.find((entry) => entry.table === "outfit_card_items")
      ?.rows as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.item_type)).toEqual(["top", "bottom"]);
    // 개인 카드는 구성원을 나누지 않는다.
    expect(items.every((item) => item.session_member_id === null)).toBe(true);
  });

  it("그룹은 구성원 둘의 구간을 합쳐 예산을 남긴다", async () => {
    const client = fakeClient({ coachingType: "group" });

    await deliverOutfitCard(
      "account-influencer",
      {
        ...personalInput,
        cards: [
          {
            memberId: "A",
            top: { name: "A 상의", url: "https://shop.test/a-top" },
            bottom: { name: "A 하의", url: "https://shop.test/a-bottom" },
          },
          {
            memberId: "B",
            top: { name: "B 상의", url: "https://shop.test/b-top" },
            bottom: { name: "B 하의", url: "https://shop.test/b-bottom" },
          },
        ],
      },
      client,
      { review: async () => review("pass") },
    );

    const card = client.inserted.find((entry) => entry.table === "outfit_cards")
      ?.rows as Record<string, unknown>;
    // A는 2~3, B는 1~5다. 가장 낮은 최소와 가장 높은 최고를 쓴다.
    expect(card.budget_min_option_id).toBe("budget-1");
    expect(card.budget_max_option_id).toBe("budget-5");

    const items = client.inserted.find((entry) => entry.table === "outfit_card_items")
      ?.rows as Array<Record<string, unknown>>;
    expect(items.map((item) => item.session_member_id)).toEqual([
      "member-a",
      "member-a",
      "member-b",
      "member-b",
    ]);
  });

  it("그룹 요청에 카드를 1개만 보내면 거절한다", async () => {
    const client = fakeClient({ coachingType: "group" });

    await expect(
      deliverOutfitCard("account-influencer", personalInput, client, {
        review: async () => review("pass"),
      }),
    ).rejects.toThrow("2인 그룹 요청은 구성원 A와 B의 코디 카드가 모두 필요해요.");
  });

  it("배정받지 않은 요청에는 쓸 수 없다", async () => {
    const client = fakeClient({ receiverProfileId: "profile-other" });

    await expect(
      deliverOutfitCard("account-influencer", personalInput, client, {
        review: async () => review("pass"),
      }),
    ).rejects.toThrow("접근할 수 없는 요청이에요.");
  });

  it("이미 전달한 요청은 검수도 하지 않고 막는다", async () => {
    const client = fakeClient({ existingCard: { id: "card-1", status: "delivered" } });
    let reviewed = false;

    await expect(
      deliverOutfitCard("account-influencer", personalInput, client, {
        review: async () => {
          reviewed = true;
          return review("pass");
        },
      }),
    ).rejects.toThrow("이미 전달한 코디 카드예요.");
    expect(reviewed).toBe(false);
  });

  it("아이템 저장에 실패하면 카드를 지워 빈 카드를 남기지 않는다", async () => {
    const client = fakeClient({ failItems: true });

    await expect(
      deliverOutfitCard("account-influencer", personalInput, client, {
        review: async () => review("pass"),
      }),
    ).rejects.toThrow("코디 카드를 전달하지 못했어요.");
    expect(client.deleted).toEqual([{ table: "outfit_cards", id: "outfit_cards-1" }]);
  });
});
