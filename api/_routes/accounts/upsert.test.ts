import { describe, expect, it, vi } from "vitest";
import { upsertAccount, validateAccountInput } from "./upsert.js";

type QueryResult = { data: unknown; error: unknown };

/** supabase 쿼리 빌더 흉내. select/eq/maybeSingle/insert/single 체인만 지원한다. */
function fakeClient(options: { existing?: QueryResult; inserted?: QueryResult }) {
  const inserts: unknown[] = [];
  const client = {
    inserts,
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () =>
                  options.existing ?? { data: null, error: null },
              };
            },
          };
        },
        insert(row: unknown) {
          inserts.push(row);
          return {
            select: () => ({
              single: async () =>
                options.inserted ?? { data: null, error: { message: "no stub" } },
            }),
          };
        },
      };
    },
  };
  return client as unknown as Parameters<typeof upsertAccount>[2];
}

const input = { role: "user" as const, loginId: "new-user", displayName: "새 사용자" };

describe("validateAccountInput", () => {
  it("허용된 역할만 받는다", () => {
    expect(() => validateAccountInput({ ...input, role: "admin" })).toThrow(
      "계정 역할이 올바르지 않습니다.",
    );
  });

  it("로그인 아이디와 표시 이름을 요구한다", () => {
    expect(() => validateAccountInput({ ...input, loginId: "  " })).toThrow(
      "로그인 아이디가 없습니다.",
    );
    expect(() => validateAccountInput({ ...input, displayName: "" })).toThrow(
      "표시 이름이 없습니다.",
    );
  });

  it("앞뒤 공백을 없앤다", () => {
    expect(validateAccountInput({ ...input, loginId: " new-user " })).toMatchObject({
      loginId: "new-user",
    });
  });
});

describe("upsertAccount", () => {
  it("토큰에서 받은 authUserId로 행을 만든다", async () => {
    const client = fakeClient({
      inserted: {
        data: {
          id: "acc-1",
          role: "user",
          dummy_login_id: "new-user",
          display_name: "새 사용자",
        },
        error: null,
      },
    });

    const account = await upsertAccount("auth-123", input, client);

    expect(account).toEqual({
      accountId: "acc-1",
      role: "user",
      loginId: "new-user",
      displayName: "새 사용자",
    });
    // 프런트가 보낸 값이 아니라 토큰에서 꺼낸 id가 들어가야 한다.
    expect((client as unknown as { inserts: Array<Record<string, unknown>> }).inserts[0])
      .toMatchObject({ auth_user_id: "auth-123", role: "user", dummy_login_id: "new-user" });
  });

  it("이미 있으면 새로 만들지 않는다", async () => {
    const client = fakeClient({
      existing: {
        data: {
          id: "acc-1",
          role: "influencer",
          dummy_login_id: "stylemate01",
          display_name: "STYLEMATE 01",
        },
        error: null,
      },
    });

    const account = await upsertAccount("auth-123", input, client);

    expect(account.accountId).toBe("acc-1");
    expect(account.role).toBe("influencer");
    expect((client as unknown as { inserts: unknown[] }).inserts).toHaveLength(0);
  });

  it("중복 로그인 아이디는 409로 알린다", async () => {
    const client = fakeClient({
      inserted: { data: null, error: { code: "23505", message: "duplicate key" } },
    });

    await expect(upsertAccount("auth-123", input, client)).rejects.toThrow(
      "이미 사용 중인 로그인 아이디예요.",
    );
  });

  it("Supabase 오류 원문을 그대로 내보내지 않는다", async () => {
    const client = fakeClient({
      inserted: {
        data: null,
        error: { code: "08006", message: "connection to db.xxxx.supabase.co failed" },
      },
    });

    await expect(upsertAccount("auth-123", input, client)).rejects.toThrow(
      "계정을 만들지 못했어요.",
    );
  });

  it("계정을 만들면서 OpenAI를 부르지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const client = fakeClient({
      inserted: {
        data: { id: "acc-1", role: "user", dummy_login_id: "u", display_name: "u" },
        error: null,
      },
    });

    await upsertAccount("auth-123", input, client);

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
