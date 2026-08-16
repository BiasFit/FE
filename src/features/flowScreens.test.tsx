import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
/** /api/requests/send로 전송된 부탁해요 카드. */
const sentCards: any[] = [];
/**
 * 추천 근거 응답을 붙잡아 두는 문. 배포 환경 실측(카드 1.5초 · 근거 4.5초)을 흉내내
 * "근거가 오기 전에 사용자가 넘어가는" 상황을 재현할 때 쓴다.
 */
let explanationGate: Promise<void> | null = null;
let openExplanationGate: (() => void) | null = null;
/** 추천 근거 호출을 실패시킬지. AI가 죽어도 부탁해요 카드가 나가는지 볼 때 쓴다. */
let failExplanations = false;
/** Style DNA 응답을 붙잡아 두는 문. AI2가 끝나기 전 진행을 막는지 검증한다. */
let styleDnaGate: Promise<void> | null = null;
let openStyleDnaGate: (() => void) | null = null;
/** 진단 저장 응답을 붙잡아 두는 문. DB 저장 완료 전 선택을 막는지 검증한다. */
let diagnosisSaveGate: Promise<void> | null = null;
let openDiagnosisSaveGate: (() => void) | null = null;
let failDiagnosisSave = false;

function holdExplanations() {
  explanationGate = new Promise<void>((resolve) => {
    openExplanationGate = resolve;
  });
}

function holdStyleDna() {
  styleDnaGate = new Promise<void>((resolve) => {
    openStyleDnaGate = resolve;
  });
}

function holdDiagnosisSave() {
  diagnosisSaveGate = new Promise<void>((resolve) => {
    openDiagnosisSaveGate = resolve;
  });
}
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
  sessionStorage.clear();
  savedPayloads.length = 0;
  sentCards.length = 0;
  deliveredPayloads.length = 0;
  deliveredCard = null;
  explanationGate = null;
  openExplanationGate = null;
  failExplanations = false;
  styleDnaGate = null;
  openStyleDnaGate = null;
  diagnosisSaveGate = null;
  openDiagnosisSaveGate = null;
  failDiagnosisSave = false;
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
        if (styleDnaGate) await styleDnaGate;
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
        // 문이 걸려 있으면 열어줄 때까지 기다린다 — 실제 배포에서 4.5초 걸리는 구간이다.
        if (explanationGate) await explanationGate;
        if (failExplanations) {
          return new Response(JSON.stringify({ error: "추천 근거를 만들지 못했습니다." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
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
        if (diagnosisSaveGate) await diagnosisSaveGate;
        if (failDiagnosisSave) {
          return new Response(JSON.stringify({ error: "진단 결과 저장에 실패했습니다." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        savedPayloads.push(body);
        return jsonResponse({ id: `saved-${savedPayloads.length}` });
      }
      if (url.endsWith("/api/requests/send")) {
        sentCards.push(body);
        return jsonResponse({ id: `request-${sentCards.length}` });
      }
      if (url.endsWith("/api/influencers/list")) {
        return jsonResponse({ influencers });
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

  it("renders the body input with the P1 defaults", async () => {
    window.location.hash = "#/user/body";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /본인의 체형 정보를 알려주세요/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "키" })).toHaveValue(158);
  });

  it("renders the fit screen as its own step, separate from body (2026-08-15 split)", async () => {
    window.location.hash = "#/user/fit";
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /평소 핏에 대해\s*느끼는 고민을 알려주세요/ }),
    ).toBeInTheDocument();
  });

  it("renders a calculated Style DNA instead of fixed display-only data", async () => {
    window.location.hash = "#/user/priority";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /진단 결과 보기/ }),
    );

    // "진단 결과 보기"는 로딩 화면(LoadingDnaScreen)을 2.4초 거쳐 넘어간다
    // (애니메이션이 최소 한 번은 보이도록 둔 지연 — 2026-08-16).
    expect(
      await screen.findByText(
        "부드러운 일상감과 비율을 함께 고려한 스타일",
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("67")).toBeVisible();
  });

  it("renders three ranked stylemates with matching reasons", async () => {
    window.location.hash = "#/user/priority";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /진단 결과 보기/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /TOP 3/ }));

    expect(
      await screen.findByRole("heading", {
        name: /스타일링을 받고 싶은\s*인플루언서를 선택해 주세요/,
      }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("radio")).toHaveLength(3);
    expect(
      await screen.findAllByText(/실제 계산된 핏과 TPO 근거/),
    ).toHaveLength(3);
  });

  it("saves the screen values once, without recalculating or calling OpenAI again", async () => {
    window.location.hash = "#/user/priority";
    render(<App />);

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /진단 결과 보기/ }),
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
    window.location.hash = "#/user/priority";
    render(<App />);

    const next = await screen.findByRole("button", { name: /진단 결과 보기/ });
    expect(next).toBeDisabled();
    fireEvent.click(
      await screen.findByRole("radio", {
        name: "좋아하는 분위기를 먼저 지키고 싶어요",
      }),
    );
    expect(next).toBeEnabled();
  });

  it("blocks progress when an exact-three keyword signal becomes incomplete", async () => {
    // 키워드는 U3-3A(스타일 화면)로 옮겨졌다 (2026-08-15 분리).
    window.location.hash = "#/user/style";
    render(<App />);

    const selectedKeyword = await screen.findByRole("button", {
      name: "부드러운",
    });
    fireEvent.click(selectedKeyword);

    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("blocks progress when the design screen's three picks become incomplete", async () => {
    window.location.hash = "#/user/design";
    render(<App />);

    // P1 기본값(리본·레이스·데님 소재감)이 이미 3개라 처음엔 다음으로 갈 수 있다.
    const next = await screen.findByRole("button", { name: "다음" });
    expect(next).toBeEnabled();

    // 그중 하나를 빼면 2개가 되어 다시 막힌다.
    fireEvent.click(await screen.findByRole("button", { name: "리본 ✕" }));
    expect(next).toBeDisabled();
  });

  /**
   * 2026-08-17 사건 회귀 테스트 — MEMO/진단결과_저장_실패_사건_스터디.md
   *
   * TOP 3 카드는 순위만 오면 뜨고, 추천 근거는 몇 초 뒤에 온다.
   * 그 사이에 사용자가 넘어가면 저장이 통째로 사라져 마지막 전송에서 막혔었다.
   */
  async function walkToDna() {
    window.location.hash = "#/user/priority";
    render(<App />);
    fireEvent.click(
      await screen.findByRole("radio", { name: "좋아하는 분위기를 먼저 지키고 싶어요" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /진단 결과 보기/ }));
    return screen.findByRole("button", { name: /TOP 3|Style DNA 준비 중/ });
  }

  it("Style DNA 생성 중에는 TOP 3로 이동할 수 없다", async () => {
    holdStyleDna();
    const topThreeButton = await walkToDna();

    expect(await screen.findByText("Style DNA 설명을 만들고 있어요.")).toBeVisible();
    expect(topThreeButton).toBeDisabled();

    fireEvent.click(topThreeButton);
    expect(window.location.hash).not.toBe("#/user/top3");

    openStyleDnaGate?.();
    await waitFor(() => expect(topThreeButton).toBeEnabled());

    fireEvent.click(topThreeButton);
    expect(
      await screen.findByRole("heading", {
        name: /스타일링을 받고 싶은\s*인플루언서를 선택해 주세요/,
      }),
    ).toBeVisible();
  });

  async function walkToTopThree() {
    window.location.hash = "#/user/priority";
    render(<App />);
    fireEvent.click(
      await screen.findByRole("radio", { name: "좋아하는 분위기를 먼저 지키고 싶어요" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /진단 결과 보기/ }));
    const topThreeButton = await screen.findByRole("button", { name: /TOP 3|Style DNA 준비 중/ });
    await waitFor(() => expect(topThreeButton).toBeEnabled());
    fireEvent.click(topThreeButton);
    await screen.findByRole("heading", {
      name: /스타일링을 받고 싶은\s*인플루언서를 선택해 주세요/,
    });
  }

  async function writeAndSend() {
    fireEvent.click(await screen.findByRole("button", { name: "확정하기" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "부탁해요 카드" }), {
      target: { value: "개강 첫 주에 입을 옷이 필요해요." },
    });
    fireEvent.click(await screen.findByRole("button", { name: "전송하기" }));
  }

  it("진단 결과가 실제 저장되기 전에는 스타일메이트를 확정할 수 없다", async () => {
    holdDiagnosisSave();
    await walkToTopThree();

    const selectButton = await screen.findByRole("button", {
      name: /진단 결과 저장 중|선택하기/,
    });
    expect(selectButton).toBeDisabled();

    fireEvent.click(selectButton);
    expect(window.location.hash).toBe("#/user/top3");

    openDiagnosisSaveGate?.();
    await waitFor(() => expect(savedPayloads).toHaveLength(1));
    await waitFor(() => expect(selectButton).toBeEnabled());

    fireEvent.click(selectButton);
    expect(window.location.hash).toBe("#/user/match");
  });

  it("진단 저장 실패 시 다음 단계로 가지 않고 같은 화면에서 재시도한다", async () => {
    failDiagnosisSave = true;
    await walkToTopThree();

    expect(await screen.findByText("진단 결과 저장에 실패했어요.")).toBeVisible();
    expect(screen.getByRole("button", { name: /진단 결과 저장 중/ })).toBeDisabled();
    expect(window.location.hash).toBe("#/user/top3");

    failDiagnosisSave = false;
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));

    await waitFor(() => expect(savedPayloads).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "선택하기" })).toBeEnabled());
  }, 10_000);

  it("빠르게 진행해도 저장 완료 전에는 선택되지 않고 완료 후 카드가 한 번 나간다", async () => {
    holdExplanations();
    await walkToTopThree();

    // 카드는 보여도 추천 근거와 진단 저장이 끝나기 전에는 선택할 수 없다.
    expect(await screen.findAllByText("추천 근거를 만들고 있어요.")).not.toHaveLength(0);
    const waitingButton = await screen.findByRole("button", { name: "진단 결과 저장 중" });
    expect(waitingButton).toBeDisabled();
    fireEvent.click(waitingButton);
    expect(window.location.hash).toBe("#/user/top3");

    // 근거와 저장이 끝난 뒤에만 선택할 수 있다.
    openExplanationGate?.();
    await waitFor(() => expect(savedPayloads).toHaveLength(1));
    expect(savedPayloads[0].ai.matchExplanations).toHaveLength(3);

    fireEvent.click(await screen.findByRole("button", { name: "선택하기" }));
    await writeAndSend();
    await waitFor(() => expect(sentCards).toHaveLength(1));
    expect(sentCards[0].matchResultId).toBe("saved-1");
    // 저장과 전송은 각각 한 번이어야 한다.
    expect(savedPayloads).toHaveLength(1);
  }, 10_000);

  it("추천 근거 호출 실패 시 선택을 막고 재시도 성공 후 저장·전송한다", async () => {
    failExplanations = true;
    await walkToTopThree();

    const retryButton = await screen.findByRole("button", { name: "추천 근거 다시 시도" });
    expect(screen.getByRole("button", { name: "진단 결과 저장 중" })).toBeDisabled();
    expect(savedPayloads).toHaveLength(0);
    expect(sentCards).toHaveLength(0);

    failExplanations = false;
    fireEvent.click(retryButton);
    await waitFor(() => expect(savedPayloads).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "선택하기" }));
    await writeAndSend();

    await waitFor(() => expect(sentCards).toHaveLength(1));
    expect(savedPayloads).toHaveLength(1);
    expect(sentCards[0].matchResultId).toBe("saved-1");
  }, 10_000);

  it("진단이 없는 채로 부탁해요 카드에 들어오면 돌아갈 길을 준다", async () => {
    window.location.hash = "#/user/request";
    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "부탁해요 카드" }), {
      target: { value: "개강 첫 주에 입을 옷이 필요해요." },
    });
    fireEvent.click(await screen.findByRole("button", { name: "전송하기" }));

    expect(await screen.findByRole("button", { name: "TOP 3 다시 보기" })).toBeVisible();
    expect(sentCards).toHaveLength(0);
  });

  it("새로고침해도 진행 중인 진단이 유지된다", async () => {
    await walkToTopThree();
    await screen.findAllByText(/실제 계산된 핏과 TPO 근거/);
    cleanup();

    // 새로고침과 같은 상황 — 앱을 처음부터 다시 렌더링해도 TOP 3가 그대로 있어야 한다.
    window.location.hash = "#/user/top3";
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: /스타일링을 받고 싶은\s*인플루언서를 선택해 주세요/,
      }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("radio")).toHaveLength(3);
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
      await screen.findByRole("heading", { name: "스타일링 요청 목록" }),
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
