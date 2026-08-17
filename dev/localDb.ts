/**
 * OPENAI_API_KEY 없이 화면을 미리 보는 `LOCAL_AI_STUBS`(localApiPlugin.ts)와 같은 이유로,
 * SUPABASE_URL 없이도 TOP3 이후 화면(매칭 확인·부탁해요 카드·대기·코디 카드·마이페이지·
 * 인플루언서 요청함)을 눌러볼 수 있게 하는 로컬 전용 더미 저장소다.
 *
 * **실제 배포 코드(api/_routes/**)는 절대 건드리지 않는다.** 그쪽은 일부러 DB 조회만 하고
 * 하드코딩 배열로 폴백하지 않는다(api/_routes/matches/top-three.ts 주석 참고) — 시드가
 * 없거나 어휘가 어긋나는 실제 문제를 덮지 않기 위해서다. 이 파일은 그 규칙을 지키면서,
 * dev 서버 미들웨어 단계에서만 진짜 핸들러 대신 끼어든다 (`apply: "serve"`, 프로덕션 번들에
 * 안 들어감).
 *
 * 점수 계산은 지어내지 않는다 — 실제 서비스가 쓰는 `rankInfluencers`를
 * `src/data/influencers.ts`의 더미 5명에게 그대로 돌린다. 화면에 쓰는 문구도 최대한
 * 사용자가 실제로 입력한 값을 그대로 되돌려준다.
 */
import {
  filterEligibleInfluencers,
  rankInfluencers,
  type RankMatchInput,
} from "../src/domain/scoring.js";
import { influencers } from "../src/data/influencers.js";
import { tpoLabel, budgetRangeLabel } from "../src/data/options.js";
import type { TestResultPayload } from "../src/domain/resultSnapshot.js";
import type { TpoCode } from "../src/data/options.js";

const DUMMY_MATCH_RESULT_ID = "local-dummy-match-result-01";
const DUMMY_REQUEST_CARD_ID = "local-dummy-request-01";
const DUMMY_OUTFIT_CARD_ID = "local-dummy-outfit-01";

interface LocalRequestCard {
  influencerId: string;
  influencerName: string;
  messageText: string;
  sentAt: string;
}

interface LocalOutfitCard {
  title: string;
  message: string;
  items: Array<{ memberLabel: "self" | "A" | "B"; itemType: "top" | "bottom"; name: string; url: string }>;
  deliveredAt: string;
}

/** 세션(dev 서버가 떠 있는 동안) 동안만 사는 값. 새로 진단을 저장하면 통째로 다시 시작한다. */
const store: {
  savedPayload: TestResultPayload | null;
  requestCard: LocalRequestCard | null;
  outfitCard: LocalOutfitCard | null;
} = { savedPayload: null, requestCard: null, outfitCard: null };

function currentTpo(): TpoCode {
  return store.savedPayload?.tpo ?? "daily";
}

function styleDnaSummary(payload: TestResultPayload): string {
  return payload.ai.styleDna.mode === "personal"
    ? payload.ai.styleDna.personalStyleDnaSummary
    : payload.ai.styleDna.groupStyleDnaSummary;
}

function matchingPoints(payload: TestResultPayload) {
  return payload.ai.styleDna.mode === "personal"
    ? payload.ai.styleDna.personalMatchingPoints
    : payload.ai.styleDna.groupMatchingPoints;
}

function outfitCardView(matchResultId: string) {
  if (!store.outfitCard) return null;
  return {
    outfitCardId: DUMMY_OUTFIT_CARD_ID,
    matchResultId,
    coachingType: store.savedPayload?.mode ?? "personal",
    title: store.outfitCard.title,
    message: store.outfitCard.message,
    tpoCode: currentTpo(),
    tpoLabel: tpoLabel(currentTpo()),
    budgetLabel: store.savedPayload
      ? budgetRangeLabel(
          store.savedPayload.input.members[0].form.budgetMinCode,
          store.savedPayload.input.members[0].form.budgetMaxCode,
        )
      : "",
    budgetApproach: store.savedPayload?.input.members[0].form.budgetApproach ?? "",
    influencerName: store.requestCard?.influencerName ?? "스타일메이트",
    deliveredAt: store.outfitCard.deliveredAt,
    items: store.outfitCard.items,
  };
}

/**
 * `LOCAL_AI_STUBS`와 같은 모양(동기 함수, `body`를 받아 응답 JSON을 돌려준다)으로 맞췄다 —
 * `localApiPlugin.ts`가 두 맵을 같은 방식으로 끼워 넣을 수 있게 하기 위해서다.
 */
export const LOCAL_DB_STUBS: Record<string, (body: unknown) => unknown> = {
  // KPI 이벤트는 로컬에서 어디에도 쌓지 않는다. 화면이 500을 받지 않게만 한다 —
  // 여기서 세어 봐야 dev 서버를 끄면 사라지고, 실제 숫자는 Supabase에서만 의미가 있다.
  "/api/events/track": () => ({ ok: true }),

  "/api/influencers/list": () => ({ influencers }),

  "/api/matches/top-three": (body) => {
    const input = body as RankMatchInput;
    return {
      rankedInfluencers: rankInfluencers(input, influencers, {}),
      eligibleCount: filterEligibleInfluencers(input.mode, influencers, {}, {}).length,
    };
  },

  "/api/results/save": (body) => {
    store.savedPayload = body as TestResultPayload;
    // 새 진단을 저장했으면 이전 회차의 부탁해요 카드·코디 카드는 더 이상 맞지 않는다.
    store.requestCard = null;
    store.outfitCard = null;
    return {
      id: DUMMY_MATCH_RESULT_ID,
      diagnosisSessionId: DUMMY_MATCH_RESULT_ID,
      styleDnaResultId: DUMMY_MATCH_RESULT_ID,
      matchResultId: DUMMY_MATCH_RESULT_ID,
    };
  },

  "/api/results/get": (body) => {
    const { matchResultId } = (body as { matchResultId?: string }) ?? {};
    if (matchResultId !== DUMMY_MATCH_RESULT_ID || !store.savedPayload) {
      throw new Error("해당 진단 기록을 찾을 수 없어요. (로컬 미리보기 — 진단을 먼저 완료해 주세요)");
    }
    const payload = store.savedPayload;
    const members = payload.input.members.map((member) => {
      const scores = payload.score.styleScores.find((s) => s.memberId === member.memberId)?.scores;
      const styleScores = scores
        ? Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(([style, score], index) => ({ style, score, rank: index + 1 }))
        : [];
      return {
        memberLabel: member.memberId,
        personaCode: member.form.personaId ?? null,
        heightCm: member.form.height ?? null,
        bodyType: member.form.bodyType,
        preferredStyle: member.form.preferredStyle,
        avoidedStyle: member.form.avoidedStyle,
        budgetLabel: budgetRangeLabel(member.form.budgetMinCode, member.form.budgetMaxCode),
        budgetApproach: member.form.budgetApproach,
        fitConcerns: member.form.fitConcerns,
        keywords: member.form.keywords,
        designElements: member.form.designElements,
        preferredItems: member.form.preferredItems,
        avoidedElements: member.form.avoidedElements,
        fitNote: member.form.fitNote || null,
        styleScores,
      };
    });
    return {
      matchResultId: DUMMY_MATCH_RESULT_ID,
      coachingType: payload.mode,
      priority: payload.priority,
      tpoCode: payload.tpo,
      tpoLabel: tpoLabel(payload.tpo),
      styleDnaSummary: styleDnaSummary(payload),
      matchingPoints: matchingPoints(payload),
      groupCombination:
        payload.ai.styleDna.mode === "group" ? payload.ai.styleDna.groupCombination : null,
      relationship: payload.input.group?.relationship ?? null,
      members,
      selectedInfluencerName: store.requestCard?.influencerName ?? null,
      requestCard: store.requestCard
        ? {
            messageText: store.requestCard.messageText,
            ownedItemsText: null,
            avoidText: null,
            sentAt: store.requestCard.sentAt,
          }
        : null,
    };
  },

  "/api/requests/send": (body) => {
    const input = body as { matchResultId: string; influencerId: string; messageText: string };
    const influencer = influencers.find((profile) => profile.id === input.influencerId);
    store.requestCard = {
      influencerId: input.influencerId,
      influencerName: influencer?.name ?? "스타일메이트",
      messageText: input.messageText,
      sentAt: new Date().toISOString(),
    };
    return { id: DUMMY_REQUEST_CARD_ID };
  },

  "/api/requests/list": () => {
    if (!store.requestCard) return { requests: [] };
    return {
      requests: [
        {
          requestCardId: DUMMY_REQUEST_CARD_ID,
          matchResultId: DUMMY_MATCH_RESULT_ID,
          coachingType: store.savedPayload?.mode ?? "personal",
          tpoCode: currentTpo(),
          tpoLabel: tpoLabel(currentTpo()),
          status: store.outfitCard ? "read" : "sent",
          sentAt: store.requestCard.sentAt,
          delivered: Boolean(store.outfitCard),
        },
      ],
    };
  },

  "/api/outfit/get": (body) => {
    const { matchResultId } = (body as { matchResultId?: string }) ?? {};
    if (matchResultId && matchResultId !== DUMMY_MATCH_RESULT_ID) return { card: null };
    return { card: outfitCardView(matchResultId ?? DUMMY_MATCH_RESULT_ID) };
  },

  "/api/outfit/deliver": (body) => {
    const input = body as {
      matchResultId: string;
      title: string;
      message: string;
      cards: Array<{
        memberId: "self" | "A" | "B";
        top: { name: string; url: string };
        bottom: { name: string; url: string };
      }>;
    };
    store.outfitCard = {
      title: input.title,
      message: input.message,
      items: input.cards.flatMap((card) => [
        { memberLabel: card.memberId, itemType: "top" as const, name: card.top.name, url: card.top.url },
        { memberLabel: card.memberId, itemType: "bottom" as const, name: card.bottom.name, url: card.bottom.url },
      ]),
      deliveredAt: new Date().toISOString(),
    };
    return {
      delivered: true,
      outfitCardId: DUMMY_OUTFIT_CARD_ID,
      review: { reviewStatus: "pass", safeLanguageIssues: [], linkChecks: [] },
    };
  },

  "/api/mypage/overview": () => {
    const diagnoses = store.savedPayload
      ? [
          {
            styleDnaResultId: DUMMY_MATCH_RESULT_ID,
            matchResultId: DUMMY_MATCH_RESULT_ID,
            diagnosedAt: new Date().toISOString(),
            coachingType: store.savedPayload.mode,
            tpoCode: currentTpo(),
            tpoLabel: tpoLabel(currentTpo()),
            styleDnaSummary: styleDnaSummary(store.savedPayload),
            styleTags: [
              store.savedPayload.input.members[0].form.preferredStyle,
              ...store.savedPayload.input.members[0].form.keywords,
            ].slice(0, 4),
            selectedInfluencerName: store.requestCard?.influencerName ?? null,
          },
        ]
      : [];
    const outfits = store.outfitCard
      ? [
          {
            outfitCardId: DUMMY_OUTFIT_CARD_ID,
            matchResultId: DUMMY_MATCH_RESULT_ID,
            title: store.outfitCard.title,
            coachingType: store.savedPayload?.mode ?? "personal",
            tpoCode: currentTpo(),
            tpoLabel: tpoLabel(currentTpo()),
            influencerName: store.requestCard?.influencerName ?? "스타일메이트",
            deliveredAt: store.outfitCard.deliveredAt,
          },
        ]
      : [];
    const pending =
      store.requestCard && !store.outfitCard
        ? [
            {
              matchResultId: DUMMY_MATCH_RESULT_ID,
              coachingType: store.savedPayload?.mode ?? "personal",
              tpoCode: currentTpo(),
              tpoLabel: tpoLabel(currentTpo()),
              influencerName: store.requestCard.influencerName,
              requestSentAt: store.requestCard.sentAt,
              requestMessage: store.requestCard.messageText,
            },
          ]
        : [];
    return {
      loginId: "p1",
      displayName: "테스트 사용자",
      summary: {
        outfitCardCount: outfits.length,
        diagnosisCount: diagnoses.length,
        lastActivityAt:
          store.outfitCard?.deliveredAt ?? store.requestCard?.sentAt ?? diagnoses[0]?.diagnosedAt ?? null,
      },
      diagnoses,
      outfits,
      pending,
    };
  },
};
