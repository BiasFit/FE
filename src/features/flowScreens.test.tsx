import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.js";
import { influencers } from "../data/influencers.js";
import { rankInfluencers } from "../domain/scoring.js";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** /api/results/save로 실제 전송된 스냅샷. 화면 값과 저장 값이 같은지 검사할 때 쓴다. */
const savedPayloads: any[] = [];
/** /api/outfit/deliver로 전송된 코디 카드. */
const deliveredPayloads: any[] = [];
/** 전달 뒤 /api/outfit/get이 돌려줄 카드. 전달 전에는 null이다. */
let deliveredCard: any = null;

function passingReview(cards: any[]) {
  return {
    reviewStatus: "pass",
    safeLanguageIssues: [],
    linkChecks: cards.flatMap((card: any) => [
      { memberId: card.memberId, itemType: "top", inputUrl: card.top.url, finalUrl: card.top.url, status: "pass", reason: "접속 가능", action: "조치 없음" },
      { memberId: card.memberId, itemType: "bottom", inputUrl: card.bottom.url, finalUrl: card.bottom.url, status: "pass", reason: "접속 가능", action: "조치 없음" },
    ]),
  };
}

beforeEach(() => {
  localStorage.clear();
  savedPayloads.length = 0;
  deliveredPayloads.length = 0;
  deliveredCard = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/api/ai/priority-options")) {
        return jsonResponse({
          question: "이번 스타일링에서 가장 중요하게 생각하는 기준을 골라주세요.",
          options: [
            { code: "style_first", label: "좋아하는 분위기를 먼저 지키고 싶어요", evidenceRefs: ["preferredStyle"] },
            { code: "fit_first", label: "편안한 핏을 먼저 맞추고 싶어요", evidenceRefs: ["fitConcerns"] },
            { code: "budget_first", label: "정한 예산을 먼저 지키고 싶어요", evidenceRefs: ["budgetApproach"] },
            { code: "tpo_first", label: "필요한 상황에 먼저 맞추고 싶어요", evidenceRefs: ["tpo"] },
          ],
        });
      }
      if (url.endsWith("/api/ai/style-dna-explanation")) {
        if (body.mode === "group") {
          return jsonResponse({
            mode: "group",
            groupStyleDnaSummary: "자연스러운 A와 단정한 B의 기준을 함께 살린 스타일",
            groupCombination: {
              score: body.groupCompatibility.total,
              directionSimilarity: body.groupCompatibility.styleSimilarity,
              budgetCoordination: body.groupCompatibility.budgetCompatibility,
              title: "각자의 무드를 살린 연결",
              description: "각자의 분위기를 유지하면서 함께 어울리는 방향을 찾아요.",
              evidenceRefs: ["A.preferredStyle", "B.preferredStyle"],
            },
            groupMatchingPoints: [
              { text: "A와 B의 핏 고민을 함께 고려해요.", evidenceRefs: ["A.fitConcerns.0", "B.fitConcerns.0"] },
              { text: "여행 상황을 함께 반영해요.", evidenceRefs: ["A.tpo", "B.tpo"] },
            ],
          });
        }
        return jsonResponse({
          mode: "personal",
          personalStyleDnaSummary: "부드러운 일상감과 비율을 함께 고려한 스타일",
          personalMatchingPoints: [
            { text: "전체 비율과 하의 기장을 고려해요.", evidenceRefs: ["personal.fitConcerns.0"] },
            { text: "개강 상황과 예산을 함께 반영해요.", evidenceRefs: ["personal.tpo", "personal.budgetRange"] },
          ],
        });
      }
      if (url.endsWith("/api/matches/top-three")) {
        return jsonResponse({ rankedInfluencers: rankInfluencers(body, influencers) });
      }
      if (url.endsWith("/api/ai/match-explanations")) {
        return jsonResponse({
          explanations: body.rankedInfluencers.map((candidate: any) => {
            const evidence = Object.values(candidate.matchedEvidence).flat() as Array<{ ref: string }>;
            return {
              influencerId: candidate.influencerId,
              strongestCategory: "fit",
              summary: "실제 계산된 핏과 TPO 근거를 함께 반영해 추천했어요.",
              evidenceRefs: evidence.slice(0, 1).map(({ ref }) => ref),
            };
          }),
        });
      }
      if (url.endsWith("/api/outfit/review")) {
        return jsonResponse(passingReview(body.cards));
      }
      if (url.endsWith("/api/outfit/deliver")) {
        deliveredPayloads.push(body);
        deliveredCard = {
          outfitCardId: "card-1",
          matchResultId: body.matchResultId,
          coachingType: body.cards.length === 2 ? "group" : "personal",
          title: body.title,
          message: body.message,
          tpoCode: "new_semester",
          tpoLabel: "개강 행사",
          budgetLabel: "3~6만 원",
          budgetApproach: "총액 절약형",
          influencerName: "STYLEMATE 01",
          deliveredAt: "2026-08-13T10:00:00.000Z",
          items: body.cards.flatMap((card: any) => [
            { memberLabel: card.memberId, itemType: "top", name: card.top.name, url: card.top.url },
            { memberLabel: card.memberId, itemType: "bottom", name: card.bottom.name, url: card.bottom.url },
          ]),
        };
        return jsonResponse({
          delivered: true,
          outfitCardId: "card-1",
          review: passingReview(body.cards),
        });
      }
      if (url.endsWith("/api/outfit/get")) {
        return jsonResponse({ card: deliveredCard });
      }
      if (url.endsWith("/api/results/save")) {
        savedPayloads.push(body);
        return jsonResponse({ id: `saved-${savedPayloads.length}` });
      }
      return new Response("Not found", { status: 404 });
    }),
  );
});

describe("user feature screens", () => {
  it("does not calculate results or call APIs without a selected priority", async () => {
    window.location.hash = "#/user/top3";
    render(<App />);

    expect(
      await screen.findByText("선택값 없이 추천 순위나 점수를 계산하지 않습니다."),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders the body and fit input with the P1 defaults", async () => {
    window.location.hash = "#/user/body";
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /옷을 고를 때 고민되는 핏을 알려주세요/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "키" })).toHaveValue(158);
  });

  it("renders a calculated Style DNA instead of fixed display-only data", async () => {
    window.location.hash = "#/user/tpo";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Style DNA 결과 보기/ }),
    );

    expect(
      await screen.findByText("부드러운 일상감과 비율을 함께 고려한 스타일"),
    ).toBeInTheDocument();
    expect(screen.getByText("67", { selector: ".score-value" })).toBeVisible();
  });

  it("renders three ranked stylemates with matching reasons", async () => {
    window.location.hash = "#/user/tpo";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Style DNA 결과 보기/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /TOP 3/ }));

    expect(
      await screen.findByRole("heading", {
        name: /나와 잘 맞는 스타일메이트를 비교해 보세요/,
      }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("radio")).toHaveLength(3);
    expect(
      await screen.findAllByText(/실제 계산된 핏과 TPO 근거/),
    ).toHaveLength(3);
  });

  it("saves the screen values once, without recalculating or calling OpenAI again", async () => {
    window.location.hash = "#/user/tpo";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Style DNA 결과 보기/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /TOP 3/ }));
    await screen.findAllByText(/실제 계산된 핏과 TPO 근거/);

    await waitFor(() => expect(savedPayloads).toHaveLength(1));
    const saved = savedPayloads[0];

    // TPO는 내부 코드로 저장한다. 한글 라벨이 들어가면 매칭이 조용히 깨진다.
    expect(saved.tpo).toBe("new_semester");
    expect(saved.mode).toBe("personal");
    expect(saved.priority).toBe("style_first");
    expect(saved.anonUserKey).toEqual(expect.any(String));
    // 화면에 쓴 AI 결과와 점수 결과가 그대로 담겨야 한다.
    expect(saved.ai.styleDna.personalStyleDnaSummary).toBe(
      "부드러운 일상감과 비율을 함께 고려한 스타일",
    );
    expect(saved.ai.matchExplanations).toHaveLength(3);
    expect(saved.score.rankedInfluencers).toHaveLength(3);
    expect(saved.score.rankedInfluencers[0].influencerId).toEqual(
      expect.any(String),
    );
    // 인플루언서 프로필 전체가 아니라 식별자와 점수만 남긴다.
    expect(saved.score.rankedInfluencers[0].influencer).toBeUndefined();

    const savedScore = saved.score.rankedInfluencers[0].breakdown.matchScore;
    expect(
      await screen.findByText(new RegExp(`^${savedScore}$`)),
    ).toBeInTheDocument();
  });

  it("requires one generated priority option before Style DNA progress", async () => {
    window.location.hash = "#/user/tpo";
    render(<App />);

    const next = await screen.findByRole("button", { name: /Style DNA 결과 보기/ });
    expect(next).toBeDisabled();
    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    expect(next).toBeEnabled();
  });

  it("blocks progress when an exact-three style signal becomes incomplete", async () => {
    window.location.hash = "#/user/signals";
    render(<App />);

    const selectedKeyword = await screen.findByRole("button", {
      name: "부드러운",
    });
    fireEvent.click(selectedKeyword);

    expect(
      screen.getByRole("button", { name: /예산 입력하기/ }),
    ).toBeDisabled();
  });

  it("renders the request and outfit result screens", async () => {
    window.location.hash = "#/user/request";
    const { unmount } = render(<App />);
    const request = await screen.findByRole("textbox", {
      name: /부탁해요 카드/,
    });
    // 부탁해요 카드는 예시 문구 없이 비어 있고, 사용자가 직접 작성한다.
    expect((request as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(request, { target: { value: "개강 첫 주에 입을 옷이 필요해요." } });
    expect((request as HTMLTextAreaElement).value).toBe("개강 첫 주에 입을 옷이 필요해요.");
    unmount();

    window.location.hash = "#/user/outfit";
    render(<App />);
    // 인플루언서가 아직 전달하지 않았으면 예시 코디가 아니라 준비 중 안내를 본다.
    expect(await screen.findByText("코디 카드 준비 중")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /이미지로 저장하기/ }),
    ).not.toBeInTheDocument();
  });
});

describe("influencer feature screens", () => {
  it("shows only the assigned request list", async () => {
    window.location.hash = "#/influencer/requests";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "내 배정 요청" }),
    ).toBeInTheDocument();
    // 사용자가 부탁해요 카드를 보내기 전에는 배정된 요청이 없다.
    expect(screen.queryAllByRole("button", { name: /요청/ })).toHaveLength(0);
  });

  /** 코디 카드 입력폼을 처음부터 채운다. 기본값은 비어 있다. */
  function fillPersonalOutfit() {
    const type = (name: string, value: string) =>
      fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    type("코디 카드 제목", "부드러운 캠퍼스 레이어드");
    type("상의 제품명", "소프트 핑크 가디건");
    type("상의 상품 링크", "https://shop.test/top/1");
    type("하의 제품명", "아이보리 A라인 스커트");
    type("하의 상품 링크", "https://shop.test/bottom/1");
    fireEvent.change(screen.getByRole("textbox", { name: /스타일메이트의 한마디/ }), {
      target: { value: "허리선이 자연스럽게 잡히는 길이로 골랐어요." },
    });
  }

  it("shows Style DNA, request context and outfit fields on one page", async () => {
    window.location.hash = "#/influencer/detail";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "코디 카드 작성" }),
    ).toBeInTheDocument();
    expect(screen.getByText("스타일 진단 결과")).toBeVisible();
    expect(screen.getByText("부탁해요 카드")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "상의 제품명" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "상의 상품 링크" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "신발" })).not.toBeInTheDocument();
    expect(screen.getByText(/요청 예산/)).toBeVisible();

    // 예시 제품이 미리 채워져 있으면 그대로 전달돼 버린다. 빈 칸에서 시작해야 한다.
    const deliver = screen.getByRole("button", { name: /전달하기/ });
    expect(screen.getByRole("textbox", { name: "상의 제품명" })).toHaveValue("");
    expect(deliver).toBeDisabled();

    fillPersonalOutfit();
    expect(deliver).toBeEnabled();

    fireEvent.change(screen.getByRole("textbox", { name: "상의 상품 링크" }), {
      target: { value: "잘못된 링크" },
    });
    expect(deliver).toBeDisabled();
  });

  it("전달 확정은 서버 검수를 거쳐 실제 카드를 남긴다", async () => {
    const base = fetch as any;
    const original = base.getMockImplementation();
    base.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/requests/list")) {
        return jsonResponse({
          requests: [
            {
              requestCardId: "req-1",
              matchResultId: "match-1",
              coachingType: "personal",
              tpoCode: "new_semester",
              tpoLabel: "개강 행사",
              status: "sent",
              sentAt: "2026-08-13T09:00:00.000Z",
              delivered: false,
            },
          ],
        });
      }
      return original(input, init);
    });

    window.location.hash = "#/influencer/requests";
    render(<App />);

    // 목록에서 요청을 골라야 어떤 매칭에 카드를 붙일지가 정해진다.
    fireEvent.click(await screen.findByRole("button", { name: /작성 필요/ }));

    await screen.findByRole("heading", { name: "코디 카드 작성" });
    fillPersonalOutfit();
    fireEvent.click(screen.getByRole("button", { name: /전달하기/ }));
    fireEvent.click(await screen.findByRole("button", { name: "전달 확정" }));

    await waitFor(() => expect(deliveredPayloads).toHaveLength(1));
    // 검수는 서버가 한다. 프런트가 통과 여부를 판단하지 않는다.
    expect(deliveredPayloads[0].matchResultId).toBe("match-1");
    expect(deliveredPayloads[0].title).toBe("부드러운 캠퍼스 레이어드");
    expect(deliveredPayloads[0].cards[0].top.url).toBe("https://shop.test/top/1");

    // 전달 완료 화면은 저장된 카드를 다시 읽어 보여준다.
    expect(
      await screen.findByRole("heading", { name: "부드러운 캠퍼스 레이어드" }),
    ).toBeVisible();
    expect(screen.getByText("소프트 핑크 가디건")).toBeVisible();
  });

  it("검수를 통과하지 못하면 전달하지 않고 내용을 유지한다", async () => {
    (fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/outfit/deliver")) {
        return jsonResponse({
          delivered: false,
          outfitCardId: null,
          review: {
            reviewStatus: "needs_revision",
            safeLanguageIssues: [],
            linkChecks: [
              {
                memberId: "self",
                itemType: "top",
                inputUrl: "https://shop.test/top/1",
                finalUrl: null,
                status: "needs_revision",
                reason: "제품 페이지를 찾을 수 없습니다. (404)",
                action: "링크 수정",
              },
            ],
          },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    window.location.hash = "#/influencer/detail";
    render(<App />);

    await screen.findByRole("heading", { name: "코디 카드 작성" });
    fillPersonalOutfit();
    fireEvent.click(screen.getByRole("button", { name: /전달하기/ }));
    fireEvent.click(await screen.findByRole("button", { name: "전달 확정" }));

    expect(await screen.findByText(/수정한 뒤 다시 전달해 주세요/)).toBeVisible();
    // 작성 내용은 그대로 남는다.
    expect(screen.getByRole("textbox", { name: "상의 제품명" })).toHaveValue(
      "소프트 핑크 가디건",
    );
  });
});
