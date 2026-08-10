import type { MatchPriority } from "../app/types";
import {
  PRIORITY_CATEGORY,
  applyPriorityWeights,
  normalizeMatchScore,
  type CategoryScores,
  type MatchCategory,
  type MatchMode,
} from "./matchPriority";

export { applyPriorityWeights, normalizeMatchScore } from "./matchPriority";

export const STYLE_NAMES = [
  "캐주얼",
  "로맨틱",
  "스트릿",
  "빈티지",
  "오피스 & 비즈니스캐주얼",
] as const;

export type StyleName = (typeof STYLE_NAMES)[number];
export type StyleScores = Record<StyleName, number>;

export interface StyleSignalInput {
  preferredStyle: StyleName;
  avoidedStyle: StyleName;
  keywords: string[];
  designElements: string[];
  preferredItems: string[];
  avoidedElements: string[];
}

const keywordStyles: Record<string, StyleName[]> = {
  편안한: ["캐주얼"],
  자연스러운: ["캐주얼"],
  실용적인: ["캐주얼"],
  부드러운: ["로맨틱"],
  사랑스러운: ["로맨틱"],
  은은한: ["로맨틱"],
  힙한: ["스트릿"],
  "개성 있는": ["스트릿"],
  유니크한: ["스트릿"],
  레트로: ["빈티지"],
  클래식한: ["빈티지"],
  감성적인: ["빈티지"],
  단정한: ["오피스 & 비즈니스캐주얼"],
  깔끔한: ["오피스 & 비즈니스캐주얼"],
  "신뢰감 있는": ["오피스 & 비즈니스캐주얼"],
};

const designStyles: Record<string, StyleName[]> = {
  "심플한 무지 디자인": ["캐주얼"],
  "데님 소재감": ["캐주얼"],
  "스포티한 배색": ["캐주얼"],
  "스티치 포인트": ["캐주얼"],
  리본: ["로맨틱"],
  셔링: ["로맨틱"],
  레이스: ["로맨틱", "빈티지"],
  "플라워 패턴": ["로맨틱", "빈티지"],
  "그래픽 프린트": ["스트릿"],
  "카고 포켓": ["스트릿"],
  "대미지 디테일": ["스트릿"],
  "레이어드 연출": ["스트릿"],
  "체크 패턴": ["빈티지"],
  "워싱 질감": ["빈티지"],
  "코듀로이 소재": ["빈티지"],
  "레더 소재": ["빈티지"],
  "테일러드 구조": ["오피스 & 비즈니스캐주얼"],
  "톤온톤 색감": ["오피스 & 비즈니스캐주얼"],
  "군더더기 없는 미니멀 디자인": ["오피스 & 비즈니스캐주얼"],
  "정돈된 단색 디자인": ["오피스 & 비즈니스캐주얼"],
};

const itemStyles: Record<string, StyleName[]> = {
  "반팔 티셔츠": ["캐주얼"],
  맨투맨: ["캐주얼"],
  "기본 가디건": ["캐주얼"],
  에코백: ["캐주얼"],
  "리본·셔링 블라우스": ["로맨틱"],
  "A라인·플레어 스커트": ["로맨틱"],
  원피스: ["로맨틱"],
  "메리제인 슈즈": ["로맨틱"],
  "그래픽 티셔츠": ["스트릿"],
  "카고 팬츠": ["스트릿"],
  "바시티 재킷": ["스트릿"],
  볼캡: ["스트릿"],
  "체크 셔츠": ["빈티지"],
  "코듀로이 팬츠": ["빈티지"],
  "니트 베스트": ["빈티지"],
  "레더 재킷": ["빈티지"],
  셔츠: ["오피스 & 비즈니스캐주얼"],
  슬랙스: ["오피스 & 비즈니스캐주얼"],
  재킷: ["오피스 & 비즈니스캐주얼"],
  "H라인 스커트": ["오피스 & 비즈니스캐주얼"],
};

const avoidedStyles: Record<string, StyleName[]> = {
  "지나치게 편한 일상복 느낌": ["캐주얼"],
  "기본 아이템만 겹친 단조로운 룩": ["캐주얼"],
  "꾸민 느낌이 거의 없는 룩": ["캐주얼"],
  "리본·프릴 장식이 많은 룩": ["로맨틱"],
  "과한 프릴 장식": ["로맨틱"],
  "너무 어려 보이는 사랑스러운 분위기": ["로맨틱"],
  "레이스·파스텔이 과한 룩": ["로맨틱"],
  "그래픽·로고가 큰 룩": ["스트릿"],
  "튀는 로고 플레이": ["스트릿"],
  "힙하고 튀는 스트릿 분위기": ["스트릿"],
  "액세서리·컬러 포인트가 많은 룩": ["스트릿"],
  "낡아 보이는 워싱 느낌": ["빈티지"],
  "체크·브라운이 과하게 겹친 룩": ["빈티지"],
  "칙칙하고 어두운 레트로 색감": ["빈티지"],
  "정장처럼 딱딱한 룩": ["오피스 & 비즈니스캐주얼"],
  "너무 성숙해 보이는 단정룩": ["오피스 & 비즈니스캐주얼"],
  "포멀한 재킷·슬랙스 중심 룩": ["오피스 & 비즈니스캐주얼"],
};

function countSignals(
  selections: string[],
  mapping: Record<string, StyleName[]>,
  style: StyleName,
) {
  return [...new Set(selections)].reduce(
    (count, selection) =>
      count + Number(mapping[selection]?.includes(style) === true),
    0,
  );
}

export function calculateStyleScores(input: StyleSignalInput): StyleScores {
  return Object.fromEntries(
    STYLE_NAMES.map((style) => {
      const keywordScore =
        25 * (countSignals(input.keywords, keywordStyles, style) / 3);
      const designScore =
        25 * (countSignals(input.designElements, designStyles, style) / 3);
      const itemScore =
        25 * (countSignals(input.preferredItems, itemStyles, style) / 3);
      const conflictCount = countSignals(
        input.avoidedElements,
        avoidedStyles,
        style,
      );
      const conflictScore =
        input.avoidedStyle === style
          ? 0
          : Math.max(0, 15 - conflictCount * 5);
      const preferredScore = input.preferredStyle === style ? 10 : 0;

      return [
        style,
        Math.round(
          keywordScore +
            designScore +
            itemScore +
            conflictScore +
            preferredScore,
        ),
      ];
    }),
  ) as StyleScores;
}

interface GroupMemberCompatibilityInput {
  scores: StyleScores;
  avoidedStyle: StyleName;
  budgetCode: number;
}

export function calculateGroupCompatibility(
  memberA: GroupMemberCompatibilityInput,
  memberB: GroupMemberCompatibilityInput,
) {
  const difference = STYLE_NAMES.reduce((sum, style) => {
    const scoreA = memberA.avoidedStyle === style ? 0 : memberA.scores[style];
    const scoreB = memberB.avoidedStyle === style ? 0 : memberB.scores[style];
    return sum + Math.abs(scoreA - scoreB);
  }, 0);
  const styleSimilarity = Math.round(70 * (1 - difference / 500));
  const budgetDifference = Math.abs(memberA.budgetCode - memberB.budgetCode);
  const budgetCompatibility = [30, 20, 10][budgetDifference] ?? 0;

  return {
    styleSimilarity,
    budgetCompatibility,
    total: styleSimilarity + budgetCompatibility,
  };
}

interface MemberMatchParts {
  style: number;
  fit: number;
  budget: number;
}

interface GroupScoreInput {
  memberA: MemberMatchParts;
  memberB: MemberMatchParts;
  sharedTpo: number;
}

function weightedGroupPart(scoreA: number, scoreB: number) {
  const lower = Math.min(scoreA, scoreB);
  const average = (scoreA + scoreB) / 2;
  return Math.round(lower * 0.7 + average * 0.3);
}

export interface MatchBreakdown extends CategoryScores {
  rawTotal: number;
  matchScore: number;
}

export function calculateGroupMatchScore(
  input: GroupScoreInput,
): MatchBreakdown {
  const scores = {
    style: weightedGroupPart(input.memberA.style, input.memberB.style),
    fit: weightedGroupPart(input.memberA.fit, input.memberB.fit),
    budget: weightedGroupPart(input.memberA.budget, input.memberB.budget),
    tpo: input.sharedTpo,
  };
  const rawTotal = scores.style + scores.fit + scores.budget + scores.tpo;
  return { ...scores, rawTotal, matchScore: normalizeMatchScore(rawTotal) };
}

export type CoachingSupport = "personal" | "group" | "both";

export interface InfluencerProfile {
  id: string;
  name: string;
  profileCompleted: boolean;
  primaryStyle: StyleName;
  secondaryStyle: StyleName;
  bodyType: string;
  fitConcerns: string[];
  budgetCodes: number[];
  budgetApproach: string;
  tpos: string[];
  coachingType: CoachingSupport;
}

interface MatchMemberInput {
  styleScores: StyleScores;
  avoidedStyle: StyleName;
  bodyType: string;
  fitConcerns: string[];
  budgetMinCode: number;
  budgetMaxCode: number;
  budgetApproach: string;
}

export interface PersonalMatchInput extends MatchMemberInput {
  mode: "personal";
  priority?: MatchPriority;
  tpo: string;
}

function scoreStylePreference(
  input: Pick<MatchMemberInput, "styleScores" | "avoidedStyle">,
  influencer: InfluencerProfile,
) {
  const primary =
    influencer.primaryStyle === input.avoidedStyle
      ? 0
      : input.styleScores[influencer.primaryStyle];
  const secondary =
    influencer.secondaryStyle === input.avoidedStyle
      ? 0
      : input.styleScores[influencer.secondaryStyle];
  return Math.round((primary * (2 / 3) + secondary * (1 / 3)) * 0.3);
}

function scoreFit(
  input: Pick<MatchMemberInput, "bodyType" | "fitConcerns">,
  influencer: InfluencerProfile,
) {
  const body = input.bodyType === influencer.bodyType ? 10 : 0;
  if (input.fitConcerns.length === 0) return body + 15;
  const matches = input.fitConcerns.filter((concern) =>
    influencer.fitConcerns.includes(concern),
  ).length;
  const concerns =
    matches === input.fitConcerns.length ? 15 : matches > 0 ? 8 : 0;
  return body + concerns;
}

function scoreBudgetRange(
  input: Pick<MatchMemberInput, "budgetMinCode" | "budgetMaxCode">,
  influencer: InfluencerProfile,
  maxRangeScore: 15 | 10,
) {
  const selectedCodes = Array.from(
    { length: input.budgetMaxCode - input.budgetMinCode + 1 },
    (_, index) => input.budgetMinCode + index,
  );
  const matched = selectedCodes.filter((code) =>
    influencer.budgetCodes.includes(code),
  ).length;
  if (matched === selectedCodes.length) return maxRangeScore;
  if (matched > 0) return maxRangeScore === 15 ? 8 : 5;
  const adjacent = selectedCodes.some((code) =>
    influencer.budgetCodes.some((candidate) => Math.abs(candidate - code) === 1),
  );
  return adjacent ? (maxRangeScore === 15 ? 8 : 5) : 0;
}

function scorePersonalBudget(
  input: MatchMemberInput,
  influencer: InfluencerProfile,
) {
  return (
    scoreBudgetRange(input, influencer, 15) +
    (input.budgetApproach === influencer.budgetApproach ? 5 : 0)
  );
}

function scoreGroupBudget(input: MatchMemberInput, influencer: InfluencerProfile) {
  return (
    scoreBudgetRange(input, influencer, 10) +
    (input.budgetApproach === influencer.budgetApproach ? 5 : 0)
  );
}

export function calculatePersonalBaseBreakdown(
  input: PersonalMatchInput,
  influencer: InfluencerProfile,
): CategoryScores {
  return {
    style: scoreStylePreference(input, influencer),
    fit: scoreFit(input, influencer),
    budget: scorePersonalBudget(input, influencer),
    tpo: influencer.tpos.includes(input.tpo) ? 15 : 0,
  };
}

export function calculateInfluencerMatch(
  input: PersonalMatchInput,
  influencer: InfluencerProfile,
): MatchBreakdown {
  return applyPriorityWeights(
    calculatePersonalBaseBreakdown(input, influencer),
    "personal",
    input.priority ?? "style_first",
  );
}

export type RankMatchInput =
  | (PersonalMatchInput & { priority: MatchPriority })
  | {
      mode: "group";
      priority: MatchPriority;
      members: [MatchMemberInput, MatchMemberInput];
      tpo: string;
    };

export interface MatchEvidence {
  ref: string;
  text: string;
}

export type MatchedEvidence = Record<MatchCategory, MatchEvidence[]>;

export interface RankedInfluencer {
  rank: number;
  influencer: InfluencerProfile;
  baseBreakdown: CategoryScores;
  breakdown: MatchBreakdown;
  matchedEvidence: MatchedEvidence;
}

export function filterEligibleInfluencers(
  mode: MatchMode,
  profiles: InfluencerProfile[],
) {
  return profiles.filter((profile) => {
    if (!profile.profileCompleted) return false;
    return (
      profile.coachingType === "both" || profile.coachingType === mode
    );
  });
}

function memberEvidence(
  prefix: string,
  member: MatchMemberInput,
  tpo: string,
  influencer: InfluencerProfile,
): MatchedEvidence {
  const styleNames = [influencer.primaryStyle, influencer.secondaryStyle].filter(
    (style) => style !== member.avoidedStyle,
  );
  const fitMatches = member.fitConcerns.filter((concern) =>
    influencer.fitConcerns.includes(concern),
  );
  const budgetMatches = influencer.budgetCodes.filter(
    (code) => code >= member.budgetMinCode && code <= member.budgetMaxCode,
  );
  return {
    style: styleNames.map((style, index) => ({
      ref: `${prefix}.style.${index}`,
      text: `${style} 신호 ${member.styleScores[style]}점`,
    })),
    fit: [
      ...(member.bodyType === influencer.bodyType
        ? [{ ref: `${prefix}.fit.bodyType`, text: `${member.bodyType} 체형 유형` }]
        : []),
      ...fitMatches.map((concern, index) => ({
        ref: `${prefix}.fit.concern.${index}`,
        text: concern,
      })),
    ],
    budget: [
      ...(budgetMatches.length > 0
        ? [{
            ref: `${prefix}.budget.range`,
            text: `예산 코드 ${budgetMatches.join("~")}`,
          }]
        : []),
      ...(member.budgetApproach === influencer.budgetApproach
        ? [{
            ref: `${prefix}.budget.approach`,
            text: member.budgetApproach,
          }]
        : []),
    ],
    tpo: influencer.tpos.includes(tpo)
      ? [{ ref: `${prefix}.tpo`, text: tpo }]
      : [],
  };
}

function mergeEvidence(first: MatchedEvidence, second: MatchedEvidence) {
  return Object.fromEntries(
    (Object.keys(first) as MatchCategory[]).map((category) => [
      category,
      [...first[category], ...second[category]],
    ]),
  ) as MatchedEvidence;
}

function groupBaseBreakdown(
  input: Extract<RankMatchInput, { mode: "group" }>,
  influencer: InfluencerProfile,
) {
  const memberA = {
    style: scoreStylePreference(input.members[0], influencer),
    fit: scoreFit(input.members[0], influencer),
    budget: scoreGroupBudget(input.members[0], influencer),
  };
  const memberB = {
    style: scoreStylePreference(input.members[1], influencer),
    fit: scoreFit(input.members[1], influencer),
    budget: scoreGroupBudget(input.members[1], influencer),
  };
  const result = calculateGroupMatchScore({
    memberA,
    memberB,
    sharedTpo: influencer.tpos.includes(input.tpo) ? 20 : 0,
  });
  return {
    style: result.style,
    fit: result.fit,
    budget: result.budget,
    tpo: result.tpo,
  };
}

export function rankInfluencers(
  input: RankMatchInput,
  profiles: InfluencerProfile[],
): RankedInfluencer[] {
  const candidates = filterEligibleInfluencers(input.mode, profiles);
  const ranked = candidates.map((influencer) => {
    if (input.mode === "personal") {
      const baseBreakdown = calculatePersonalBaseBreakdown(input, influencer);
      return {
        influencer,
        baseBreakdown,
        breakdown: applyPriorityWeights(
          baseBreakdown,
          "personal",
          input.priority,
        ),
        matchedEvidence: memberEvidence(
          "personal",
          input,
          input.tpo,
          influencer,
        ),
      };
    }

    const baseBreakdown = groupBaseBreakdown(input, influencer);
    return {
      influencer,
      baseBreakdown,
      breakdown: applyPriorityWeights(baseBreakdown, "group", input.priority),
      matchedEvidence: mergeEvidence(
        memberEvidence("A", input.members[0], input.tpo, influencer),
        memberEvidence("B", input.members[1], input.tpo, influencer),
      ),
    };
  });
  const priorityCategory = PRIORITY_CATEGORY[input.priority];

  return ranked
    .sort(
      (a, b) =>
        b.breakdown.matchScore - a.breakdown.matchScore ||
        b.breakdown[priorityCategory] - a.breakdown[priorityCategory] ||
        b.baseBreakdown.style - a.baseBreakdown.style ||
        a.influencer.id.localeCompare(b.influencer.id),
    )
    .slice(0, 3)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}
