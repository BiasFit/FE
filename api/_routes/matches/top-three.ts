import { isMatchPriority } from "../../../src/domain/aiContracts.js";
import {
  budgetApproaches,
  bodyTypes,
  budgets,
  fitConcerns as FIT_CONCERNS,
  isTpoCode,
} from "../../../src/data/options.js";
import {
  STYLE_NAMES,
  filterEligibleInfluencers,
  rankInfluencers,
  type InfluencerProfile,
  type RankMatchInput,
  type StyleName,
  type StyleScores,
} from "../../../src/domain/scoring.js";
import {
  loadInfluencerProfiles,
  loadReceivedRequestCounts,
} from "../../_lib/influencerProfiles.js";
import {
  readJsonBody,
  requirePost,
  sendApiError,
  type ApiRequest,
  type ApiResponse,
} from "../../_lib/http.js";

/**
 * 후보 모집단은 DB에서 읽는다. 하드코딩 배열로 폴백하지 않는다 —
 * 폴백하면 시드가 없거나 어휘가 어긋나도 그럴듯한 결과가 나와 문제를 덮는다.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 사용자 입력의 어휘를 인플루언서 쪽과 **대칭으로** 검사한다.
 *
 * `toStylemateView`(api/_lib/influencerProfiles.ts)는 DB에 잘못된 코드가 들어오면 큰 소리로
 * 막는데, 여기 사용자 쪽은 맨 캐스팅뿐이라 무방비였다. 예를 들어 `styleScores`에서 스타일
 * 하나가 빠지면 `scoreStylePreference`가 `undefined`를 곱해 NaN을 내고, `matchScore`가
 * JSON에서 `null`이 되며, 정렬 비교자가 전부 NaN이라 **순위가 사실상 입력 순서로 무너진다.**
 * 그런데도 200이 나갔다. 그 조용한 실패를 여기서 끝낸다.
 */
const BODY_TYPES = bodyTypes.map((type) => type.name) as readonly string[];
const MAX_BUDGET_CODE = budgets.length;

/** 오류 문구에 넣을 값. 비어 있으면 `undefined`를 그대로 보여주지 않는다. */
function shown(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function requireStyleScores(value: unknown, context: string): StyleScores {
  if (!isRecord(value)) {
    throw new Error(`${context}의 스타일 점수가 없어요.`);
  }
  const scores = {} as StyleScores;
  for (const style of STYLE_NAMES) {
    const score = value[style];
    // 0점은 정상이다. 빠진 값과 구분하려면 존재 여부가 아니라 형태를 봐야 한다.
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error(`${context}의 스타일 점수가 올바르지 않아요: "${style}"`);
    }
    scores[style] = score;
  }
  return scores;
}

function requireBudgetCode(value: unknown, context: string, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_BUDGET_CODE) {
    throw new Error(`${context}의 ${field} 값이 올바르지 않아요: "${shown(value)}"`);
  }
  return value;
}

function requireFitConcerns(value: unknown, context: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${context}의 핏 고민이 올바르지 않아요.`);
  }
  for (const concern of value) {
    // 라벨이 한 글자만 어긋나도 핏 점수가 조용히 0점이 된다. 여기서 거절한다.
    if (typeof concern !== "string" || !FIT_CONCERNS.includes(concern)) {
      throw new Error(`${context}의 핏 고민이 올바르지 않아요: "${shown(concern)}"`);
    }
  }
  return value as string[];
}

/** 개인 1명분, 그룹은 구성원 1명분. `tpo`와 `mode`는 바깥에서 따로 본다. */
function validateMember(value: unknown, context: string) {
  if (!isRecord(value)) throw new Error(`${context} 입력이 없어요.`);

  const avoidedStyle = value.avoidedStyle;
  if (typeof avoidedStyle !== "string" || !(STYLE_NAMES as readonly string[]).includes(avoidedStyle)) {
    throw new Error(`${context}의 비선호 스타일이 올바르지 않아요: "${shown(avoidedStyle)}"`);
  }

  const bodyType = value.bodyType;
  if (typeof bodyType !== "string" || !BODY_TYPES.includes(bodyType)) {
    throw new Error(`${context}의 체형 유형이 올바르지 않아요: "${shown(bodyType)}"`);
  }

  const budgetApproach = value.budgetApproach;
  if (
    typeof budgetApproach !== "string" ||
    !(budgetApproaches as readonly string[]).includes(budgetApproach)
  ) {
    throw new Error(`${context}의 구매 기준이 올바르지 않아요: "${shown(budgetApproach)}"`);
  }

  return {
    styleScores: requireStyleScores(value.styleScores, context),
    avoidedStyle: avoidedStyle as StyleName,
    bodyType: bodyType as InfluencerProfile["bodyType"],
    fitConcerns: requireFitConcerns(value.fitConcerns, context),
    budgetMinCode: requireBudgetCode(value.budgetMinCode, context, "최소 예산"),
    budgetMaxCode: requireBudgetCode(value.budgetMaxCode, context, "최대 예산"),
    budgetApproach: budgetApproach as InfluencerProfile["budgetApproach"],
  };
}

export function validateRankMatchInput(value: unknown): RankMatchInput {
  if (!isRecord(value)) throw new Error("TOP 3 계산 입력이 없어요.");

  const { mode, priority, tpo } = value;
  if (mode !== "personal" && mode !== "group") {
    throw new Error(`스타일링 유형이 올바르지 않아요: "${shown(mode)}"`);
  }
  if (!isMatchPriority(priority)) {
    throw new Error(`매칭 우선순위가 올바르지 않아요: "${shown(priority)}"`);
  }
  if (!isTpoCode(tpo)) {
    throw new Error(`상황(TPO) 코드가 올바르지 않아요: "${shown(tpo)}"`);
  }

  if (mode === "personal") {
    return { mode, priority, tpo, ...validateMember(value, "진단 입력") };
  }

  const members = value.members;
  if (!Array.isArray(members) || members.length !== 2) {
    throw new Error("2인 그룹 스타일링은 구성원 두 명의 입력이 필요해요.");
  }
  return {
    mode,
    priority,
    tpo,
    members: [
      validateMember(members[0], "구성원 A"),
      validateMember(members[1], "구성원 B"),
    ],
  };
}

export function calculateTopThree(
  input: unknown,
  profiles: InfluencerProfile[],
  received: { counts?: Record<string, number>; limits?: Record<string, number> } = {},
) {
  return rankInfluencers(validateRankMatchInput(input), profiles, received);
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!requirePost(request, response)) return;
  try {
    // 계산에 들어가기 전에 막는다. 어휘가 어긋난 채로 점수를 내면 NaN이 조용히 섞인다.
    const input = validateRankMatchInput(readJsonBody(request));
    // 수신 한도는 서버에서 직접 센다. 프런트가 보내면 조작할 수 있다.
    const [profiles, received] = await Promise.all([
      loadInfluencerProfiles(),
      loadReceivedRequestCounts(),
    ]);
    response.status(200).json({
      rankedInfluencers: rankInfluencers(input, profiles, received),
      // 후보가 3명 미만일 때 화면이 상태 문구를 고르는 데 쓴다.
      // 인플루언서별 수신 수나 남은 자리는 담지 않는다 (SCREEN_SPEC.md).
      eligibleCount: filterEligibleInfluencers(
        input.mode,
        profiles,
        received.counts,
        received.limits,
      ).length,
    });
  } catch (error) {
    console.error("[BiasFit 매칭] top-three failed", error);
    sendApiError(response, error);
  }
}
