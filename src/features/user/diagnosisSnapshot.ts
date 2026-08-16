import type { AppState } from "../../app/appState.js";
import type { DiagnosisForm } from "../../app/types.js";
import type { TestResultPayload } from "../../domain/resultSnapshot.js";
import {
  STYLE_NAMES,
  calculateGroupCompatibility,
  calculateStyleScores,
  personalFitDetail,
  styleScoreDetail,
  type RankedInfluencer,
} from "../../domain/scoring.js";
import { saveTestResult } from "../../lib/biasfitApi.js";
import { anonUserKey } from "../../storage/anonUser.js";

/**
 * 저장용 스냅샷을 만들고, 저장 요청을 한 곳으로 모은다.
 *
 * ⚠️ 원래 이 코드는 `ResultScreens.tsx`(TOP 3 화면) 안에 있었다.
 * 화면 안에 있으니 **사용자가 그 화면을 떠나는 순간 저장이 함께 사라졌고**,
 * 다섯 단계 뒤 부탁해요 카드에서야 막혔다 — `MEMO/진단결과_저장_실패_사건_스터디.md`.
 * 그래서 화면 밖으로 꺼내 두 화면(TOP 3·부탁해요 카드)이 같은 저장을 공유하게 한다.
 */

export function styleSignalOf(form: DiagnosisForm) {
  return {
    preferredStyle: form.preferredStyle,
    avoidedStyle: form.avoidedStyle,
    keywords: form.keywords,
    designElements: form.designElements,
    preferredItems: form.preferredItems,
    avoidedElements: form.avoidedElements,
  };
}

export function scoresFor(form: DiagnosisForm) {
  return calculateStyleScores(styleSignalOf(form));
}

/**
 * 스타일별 항목 내역. `style_score_breakdowns`에 그대로 들어간다.
 * 총점은 `scoresFor`와 같은 계산에서 나오므로 둘이 어긋날 수 없다.
 */
export function breakdownsFor(form: DiagnosisForm) {
  const signal = styleSignalOf(form);
  return Object.fromEntries(
    STYLE_NAMES.map((style) => [style, styleScoreDetail(signal, style).breakdowns]),
  );
}

/**
 * 화면에 쓴 값을 그대로 모아 저장용 스냅샷을 만든다.
 * 여기서 점수를 다시 계산하거나 AI를 다시 부르지 않는다. 준비가 덜 됐으면 null을 돌려 저장을 미룬다.
 */
export function buildResultSnapshot(
  state: AppState,
  ranked: RankedInfluencer[],
): TestResultPayload | null {
  const priority = state.matchPriority;
  const styleDna = state.styleDna;
  if (!priority || !styleDna || ranked.length === 0) return null;

  const ai = {
    priorityOptions: state.priorityOptions,
    styleDna,
    matchExplanations: state.matchExplanations,
  };
  // 인플루언서 프로필 전체가 아니라 식별자와 점수만 남긴다.
  // 개인은 체형·핏 25점의 내역을 함께 담는다. 그룹은 체형을 점수에 쓰지 않아 없다.
  const rankedInfluencers = ranked.map(
    ({ rank, influencer, baseBreakdown, breakdown }) => ({
      rank,
      influencerId: influencer.id,
      influencerName: influencer.name,
      baseBreakdown,
      breakdown,
      fitDetail:
        state.mode === "personal"
          ? personalFitDetail(
              {
                bodyType: state.personal.bodyType,
                fitConcerns: state.personal.fitConcerns,
              },
              influencer,
            )
          : undefined,
    }),
  );

  if (state.mode === "personal") {
    return {
      mode: "personal",
      priority,
      tpo: state.personal.tpo,
      anonUserKey: anonUserKey(),
      input: { members: [{ memberId: "self", form: state.personal }] },
      ai,
      score: {
        styleScores: [
          {
            memberId: "self",
            scores: scoresFor(state.personal),
            breakdowns: breakdownsFor(state.personal),
          },
        ],
        rankedInfluencers,
      },
    };
  }

  const groupA = scoresFor(state.group.members.A);
  const groupB = scoresFor(state.group.members.B);
  return {
    mode: "group",
    priority,
    tpo: state.group.tpo,
    anonUserKey: anonUserKey(),
    input: {
      members: [
        { memberId: "A", form: state.group.members.A },
        { memberId: "B", form: state.group.members.B },
      ],
      group: {
        relationship: state.group.relationship,
        relationshipOther: state.group.relationshipOther,
      },
    },
    ai,
    score: {
      styleScores: [
        { memberId: "A", scores: groupA, breakdowns: breakdownsFor(state.group.members.A) },
        { memberId: "B", scores: groupB, breakdowns: breakdownsFor(state.group.members.B) },
      ],
      groupCompatibility: calculateGroupCompatibility(
        {
          scores: groupA,
          avoidedStyle: state.group.members.A.avoidedStyle,
          budgetCode: state.group.members.A.budgetCode,
        },
        {
          scores: groupB,
          avoidedStyle: state.group.members.B.avoidedStyle,
          budgetCode: state.group.members.B.budgetCode,
        },
      ),
      rankedInfluencers,
    },
  };
}

/**
 * 한 진단을 가리키는 키. **AI 추천 근거는 빼고** 만든다.
 * 근거가 도착하기 전에 저장한 회차와 도착한 뒤에 저장하려는 회차를 같은 진단으로 묶어야
 * `diagnosis_sessions` 행이 두 번 생기지 않는다.
 */
function diagnosisKey(snapshot: TestResultPayload) {
  const { ai, ...rest } = snapshot;
  const { matchExplanations: _reasons, ...aiWithoutReasons } = ai;
  return JSON.stringify({ ...rest, ai: aiWithoutReasons });
}

/** 이미 끝난 저장. 같은 진단을 다시 요청하면 그때 받은 id를 그대로 돌려준다. */
const finished = new Map<string, { id: string }>();
/** 진행 중인 저장. 두 화면에서 동시에 불러도 요청은 한 번만 나간다. */
const inFlight = new Map<string, Promise<{ id: string }>>();

/**
 * 진단 결과를 저장한다. 같은 진단이면 몇 번을 불러도 요청은 한 번이고 결과는 공유된다.
 *
 * 저장을 부르는 곳이 두 군데다 — 추천 근거가 도착한 시점(정상 경로)과
 * 부탁해요 카드를 보내는 시점(아직 저장이 안 끝났을 때의 대비책).
 * 둘이 겹쳐도 행이 두 번 생기면 안 되므로 여기서 한 번으로 묶는다.
 * React StrictMode가 effect를 두 번 실행해도 같은 이유로 요청은 한 번이다.
 */
export function saveDiagnosisOnce(snapshot: TestResultPayload) {
  const key = diagnosisKey(snapshot);
  const done = finished.get(key);
  if (done) return Promise.resolve(done);

  const running = inFlight.get(key);
  if (running) return running;

  const request = saveTestResult(snapshot)
    .then((saved) => {
      finished.set(key, saved);
      return saved;
    })
    .finally(() => {
      // 실패한 저장은 다시 시도할 수 있어야 한다.
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
