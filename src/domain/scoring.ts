import type { DiagnosisForm, MatchPriority } from "../app/types";
import { budgetRangeLabel, tpoLabel, type TpoCode } from "../data/options";
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
  편안한: ["캐주얼"], 꾸안꾸: ["캐주얼"], 자연스러운: ["캐주얼"], 무난한: ["캐주얼"], 심플한: ["캐주얼"],
  부드러운: ["로맨틱"], 어른여자: ["로맨틱"], 화사한: ["로맨틱"], 페미닌한: ["로맨틱"], 청순한: ["로맨틱"],
  힙한: ["스트릿"], 래퍼여친: ["스트릿"], 자유로운: ["스트릿"], 강렬한: ["스트릿"], 스포티한: ["스트릿"],
  보헤미안: ["빈티지"], 모리걸: ["빈티지"], 에스닉: ["빈티지"], 레트로: ["빈티지"], 감성적인: ["빈티지"],
  단정한: ["오피스 & 비즈니스캐주얼"], 깔끔한: ["오피스 & 비즈니스캐주얼"], 고급스러운: ["오피스 & 비즈니스캐주얼"], 세련된: ["오피스 & 비즈니스캐주얼"], 차분한: ["오피스 & 비즈니스캐주얼"],
};

const designStyles: Record<string, StyleName[]> = {
  무지: ["캐주얼"], "데님 소재감": ["캐주얼"], "루즈핏 실루엣": ["캐주얼"], "베이직 디자인": ["캐주얼"], "스트라이프 패턴": ["캐주얼"],
  쉬폰: ["로맨틱"], 프릴: ["로맨틱"], "수채화 색감": ["로맨틱"], 리본: ["로맨틱"],
  "그래픽 프린트": ["스트릿"], "데미지 디테일": ["스트릿"], "강렬한 컬러조합": ["스트릿"], "볼드한 타이포그래피": ["스트릿"],
  "빈티지 워싱": ["빈티지"], "믹스 패턴": ["빈티지"], "더스티 컬러": ["빈티지"],
  "테일러드 구조": ["오피스 & 비즈니스캐주얼"], "단색 디자인": ["오피스 & 비즈니스캐주얼"], "스트랩 디자인": ["오피스 & 비즈니스캐주얼"], "빳빳한 소재감": ["오피스 & 비즈니스캐주얼"], "핀턱 디자인": ["오피스 & 비즈니스캐주얼"], "정돈된 실루엣": ["오피스 & 비즈니스캐주얼"],
  무채색: ["캐주얼", "스트릿"], 레이스: ["로맨틱", "빈티지"], "플라워 패턴": ["로맨틱", "빈티지"], 레이어드: ["스트릿", "빈티지"],
};

const itemStyles: Record<string, StyleName[]> = {
  "스트라이프 셔츠": ["캐주얼"], "데님 팬츠": ["캐주얼"], "기본 슬리브리스": ["캐주얼"], "깔끔한 반팔티셔츠": ["캐주얼"], 에코백: ["캐주얼"], 볼캡: ["캐주얼"],
  "새틴 미디 스커트": ["로맨틱"], "블랙 카프리 팬츠": ["로맨틱"], "오프숄더 상의": ["로맨틱"],
  "두꺼운 벨트": ["스트릿"], "찢어진 청바지": ["스트릿"], 크롭티: ["스트릿"], "그래픽 티셔츠": ["스트릿"], "볼드한 액세서리": ["스트릿"], "레더 부츠": ["스트릿"],
  스카프: ["빈티지"], 니삭스: ["빈티지"], "캉캉 미디 스커트": ["빈티지"], "패턴 블라우스": ["빈티지"], "레이스 슬리브리스": ["빈티지"], "빈티지 워싱 데님": ["빈티지"],
  "단색 셔츠": ["오피스 & 비즈니스캐주얼"], 슬랙스: ["오피스 & 비즈니스캐주얼"], 재킷: ["오피스 & 비즈니스캐주얼"], "H라인 미디/롱스커트": ["오피스 & 비즈니스캐주얼"],
  "쉬폰 블라우스": ["로맨틱", "오피스 & 비즈니스캐주얼"], "플리츠 니트": ["로맨틱", "오피스 & 비즈니스캐주얼"],
};

const avoidedStyles: Record<string, StyleName[]> = {
  "무난하고 평범한 데일리 룩": ["캐주얼"], "힘을 뺀 꾸안꾸 스타일": ["캐주얼"], "데님·티셔츠 중심의 캐주얼한 조합": ["캐주얼"],
  "쉬폰·새틴처럼 하늘하늘한 소재": ["로맨틱"], "청순하고 페미닌한 분위기가 돋보이는 스타일": ["로맨틱"], "프릴·레이스·리본 등 페미닌한 장식이 들어간 룩": ["로맨틱"],
  "그래픽·로고가 큰 룩": ["스트릿"], "힙한 분위기가 돋보이는 룩": ["스트릿"], "액세서리·컬러 포인트가 많은 룩": ["스트릿"],
  "빈티지 워싱처럼 낡고 바랜 듯한 소재감": ["빈티지"], "플라워·에스닉·믹스 패턴이 눈에 띄는 룩": ["빈티지"], "더스티 컬러처럼 채도를 낮춘 차분한 색감": ["빈티지"],
  "정장처럼 딱딱한 룩": ["오피스 & 비즈니스캐주얼"], "너무 성숙해 보이는 룩": ["오피스 & 비즈니스캐주얼"], "포멀한 재킷·슬랙스 중심 룩": ["오피스 & 비즈니스캐주얼"],
};

function countSignals(selections: string[], mapping: Record<string, StyleName[]>, style: StyleName) {
  return [...new Set(selections)].reduce(
    (count, selection) => count + Number(mapping[selection]?.includes(style) === true),
    0,
  );
}

export function calculateStyleScores(input: StyleSignalInput): StyleScores {
  return Object.fromEntries(STYLE_NAMES.map((style) => {
    const keywordScore = 25 * (countSignals(input.keywords, keywordStyles, style) / 3);
    const designScore = 25 * (countSignals(input.designElements, designStyles, style) / 3);
    const itemScore = 25 * (countSignals(input.preferredItems, itemStyles, style) / 3);
    const conflictCount = countSignals(input.avoidedElements, avoidedStyles, style);
    const conflictScore = input.avoidedStyle === style ? 0 : Math.max(0, 15 - conflictCount * 5);
    const preferredScore = input.preferredStyle === style ? 10 : 0;
    return [style, Math.round(keywordScore + designScore + itemScore + conflictScore + preferredScore)];
  })) as StyleScores;
}

interface GroupMemberCompatibilityInput {
  scores: StyleScores;
  avoidedStyle: StyleName;
  budgetCode: number;
}

export function calculateGroupCompatibility(memberA: GroupMemberCompatibilityInput, memberB: GroupMemberCompatibilityInput) {
  const difference = STYLE_NAMES.reduce((sum, style) => {
    const scoreA = memberA.avoidedStyle === style ? 0 : memberA.scores[style];
    const scoreB = memberB.avoidedStyle === style ? 0 : memberB.scores[style];
    return sum + Math.abs(scoreA - scoreB);
  }, 0);
  const styleSimilarity = Math.round(70 * (1 - difference / 500));
  const budgetDifference = Math.abs(memberA.budgetCode - memberB.budgetCode);
  const budgetCompatibility = [30, 20, 10][budgetDifference] ?? 0;
  return { styleSimilarity, budgetCompatibility, total: styleSimilarity + budgetCompatibility };
}

interface MemberMatchParts { style: number; fit: number; budget: number; }
interface GroupScoreInput { memberA: MemberMatchParts; memberB: MemberMatchParts; sharedTpo: number; }

function weightedGroupPart(scoreA: number, scoreB: number) {
  return Math.round(Math.min(scoreA, scoreB) * 0.7 + ((scoreA + scoreB) / 2) * 0.3);
}

export interface MatchBreakdown extends CategoryScores { rawTotal: number; matchScore: number; }

export function calculateGroupMatchScore(input: GroupScoreInput): MatchBreakdown {
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
  bodyType: DiagnosisForm["bodyType"];
  fitConcerns: string[];
  budgetCodes: number[];
  // 사용자와 같은 어휘를 강제한다. 문자열로 열어 두면 값이 어긋나도 컴파일러가 잡지 못한다.
  budgetApproach: DiagnosisForm["budgetApproach"];
  tpos: TpoCode[];
  coachingType: CoachingSupport;
}

interface MatchMemberInput {
  styleScores: StyleScores;
  avoidedStyle: StyleName;
  bodyType: DiagnosisForm["bodyType"];
  fitConcerns: string[];
  budgetMinCode: number;
  budgetMaxCode: number;
  budgetApproach: DiagnosisForm["budgetApproach"];
}

export interface PersonalMatchInput extends MatchMemberInput {
  mode: "personal";
  priority?: MatchPriority;
  tpo: TpoCode;
}

function scoreStylePreference(input: Pick<MatchMemberInput, "styleScores" | "avoidedStyle">, influencer: InfluencerProfile) {
  const primary = influencer.primaryStyle === input.avoidedStyle ? 0 : input.styleScores[influencer.primaryStyle];
  const secondary = influencer.secondaryStyle === input.avoidedStyle ? 0 : input.styleScores[influencer.secondaryStyle];
  return Math.round((primary * (2 / 3) + secondary * (1 / 3)) * 0.3);
}

function matchingConcernScore(input: Pick<MatchMemberInput, "fitConcerns">, influencer: InfluencerProfile, maximum: number) {
  if (!input.fitConcerns.length) return 0;
  const matches = input.fitConcerns.filter((concern) => influencer.fitConcerns.includes(concern)).length;
  return Math.round((matches / input.fitConcerns.length) * maximum);
}

function scorePersonalFit(input: Pick<MatchMemberInput, "bodyType" | "fitConcerns">, influencer: InfluencerProfile) {
  return (input.bodyType === influencer.bodyType ? 15 : 0) + matchingConcernScore(input, influencer, 10);
}

function scoreGroupFit(input: Pick<MatchMemberInput, "fitConcerns">, influencer: InfluencerProfile) {
  return matchingConcernScore(input, influencer, 25);
}

function scoreBudgetRange(input: Pick<MatchMemberInput, "budgetMinCode" | "budgetMaxCode">, influencer: InfluencerProfile, maxRangeScore: 15 | 10) {
  const selectedCodes = Array.from({ length: input.budgetMaxCode - input.budgetMinCode + 1 }, (_, index) => input.budgetMinCode + index);
  if (selectedCodes.some((code) => influencer.budgetCodes.includes(code))) return maxRangeScore;
  const adjacent = selectedCodes.some((code) => influencer.budgetCodes.some((candidate) => Math.abs(candidate - code) === 1));
  return adjacent ? (maxRangeScore === 15 ? 8 : 5) : 0;
}

function scorePersonalBudget(input: MatchMemberInput, influencer: InfluencerProfile) {
  return scoreBudgetRange(input, influencer, 15) + (input.budgetApproach === influencer.budgetApproach ? 5 : 0);
}

export function calculatePersonalBaseBreakdown(input: PersonalMatchInput, influencer: InfluencerProfile): CategoryScores {
  return {
    style: scoreStylePreference(input, influencer),
    fit: scorePersonalFit(input, influencer),
    budget: scorePersonalBudget(input, influencer),
    tpo: influencer.tpos.includes(input.tpo) ? 15 : 0,
  };
}

export function calculateInfluencerMatch(input: PersonalMatchInput, influencer: InfluencerProfile): MatchBreakdown {
  return applyPriorityWeights(calculatePersonalBaseBreakdown(input, influencer), "personal", input.priority ?? "style_first");
}

export type RankMatchInput =
  | (PersonalMatchInput & { priority: MatchPriority })
  | { mode: "group"; priority: MatchPriority; members: [MatchMemberInput, MatchMemberInput]; tpo: TpoCode };

export interface MatchEvidence { ref: string; text: string; }
export type MatchedEvidence = Record<MatchCategory, MatchEvidence[]>;
export interface RankedInfluencer {
  rank: number;
  influencer: InfluencerProfile;
  baseBreakdown: CategoryScores;
  breakdown: MatchBreakdown;
  matchedEvidence: MatchedEvidence;
}

export function filterEligibleInfluencers(mode: MatchMode, profiles: InfluencerProfile[]) {
  return profiles.filter((profile) => profile.profileCompleted && (profile.coachingType === "both" || profile.coachingType === mode));
}

function memberEvidence(prefix: string, member: MatchMemberInput, tpo: TpoCode, influencer: InfluencerProfile, includeBodyType: boolean): MatchedEvidence {
  const styleNames = [influencer.primaryStyle, influencer.secondaryStyle].filter((style) => style !== member.avoidedStyle);
  const fitMatches = member.fitConcerns.filter((concern) => influencer.fitConcerns.includes(concern));
  const budgetMatches = influencer.budgetCodes.filter((code) => code >= member.budgetMinCode && code <= member.budgetMaxCode);
  // 근거 텍스트는 그대로 AI 설명 문장에 쓰이므로 점수·내부 코드를 넣지 않는다.
  return {
    style: styleNames.map((style, index) => ({ ref: `${prefix}.style.${index}`, text: `${style} 선호` })),
    fit: [
      ...(includeBodyType && member.bodyType === influencer.bodyType ? [{ ref: `${prefix}.fit.bodyType`, text: `${member.bodyType} 체형 유형` }] : []),
      ...fitMatches.map((concern, index) => ({ ref: `${prefix}.fit.concern.${index}`, text: concern })),
    ],
    budget: [
      ...(budgetMatches.length
        ? [{
            ref: `${prefix}.budget.range`,
            text: budgetRangeLabel(Math.min(...budgetMatches), Math.max(...budgetMatches)),
          }]
        : []),
      ...(member.budgetApproach === influencer.budgetApproach ? [{ ref: `${prefix}.budget.approach`, text: member.budgetApproach }] : []),
    ],
    tpo: influencer.tpos.includes(tpo) ? [{ ref: `${prefix}.tpo`, text: tpoLabel(tpo) }] : [],
  };
}

function mergeEvidence(first: MatchedEvidence, second: MatchedEvidence) {
  return Object.fromEntries((Object.keys(first) as MatchCategory[]).map((category) => [category, [...first[category], ...second[category]]])) as MatchedEvidence;
}

function groupBaseBreakdown(input: Extract<RankMatchInput, { mode: "group" }>, influencer: InfluencerProfile): CategoryScores {
  const memberA = {
    style: scoreStylePreference(input.members[0], influencer),
    fit: scoreGroupFit(input.members[0], influencer),
    budgetRange: scoreBudgetRange(input.members[0], influencer, 10),
    budgetApproach: input.members[0].budgetApproach === influencer.budgetApproach ? 5 : 0,
  };
  const memberB = {
    style: scoreStylePreference(input.members[1], influencer),
    fit: scoreGroupFit(input.members[1], influencer),
    budgetRange: scoreBudgetRange(input.members[1], influencer, 10),
    budgetApproach: input.members[1].budgetApproach === influencer.budgetApproach ? 5 : 0,
  };
  const groupBudget = weightedGroupPart(memberA.budgetRange, memberB.budgetRange) + weightedGroupPart(memberA.budgetApproach, memberB.budgetApproach);
  const result = calculateGroupMatchScore({
    memberA: { style: memberA.style, fit: memberA.fit, budget: groupBudget },
    memberB: { style: memberB.style, fit: memberB.fit, budget: groupBudget },
    sharedTpo: influencer.tpos.includes(input.tpo) ? 20 : 0,
  });
  return { style: result.style, fit: result.fit, budget: result.budget, tpo: result.tpo };
}

export function rankInfluencers(input: RankMatchInput, profiles: InfluencerProfile[]): RankedInfluencer[] {
  const ranked = filterEligibleInfluencers(input.mode, profiles).map((influencer) => {
    if (input.mode === "personal") {
      const baseBreakdown = calculatePersonalBaseBreakdown(input, influencer);
      return {
        influencer,
        baseBreakdown,
        breakdown: applyPriorityWeights(baseBreakdown, "personal", input.priority),
        matchedEvidence: memberEvidence("personal", input, input.tpo, influencer, true),
      };
    }
    const baseBreakdown = groupBaseBreakdown(input, influencer);
    return {
      influencer,
      baseBreakdown,
      breakdown: applyPriorityWeights(baseBreakdown, "group", input.priority),
      matchedEvidence: mergeEvidence(
        memberEvidence("A", input.members[0], input.tpo, influencer, false),
        memberEvidence("B", input.members[1], input.tpo, influencer, false),
      ),
    };
  });
  const priorityCategory = PRIORITY_CATEGORY[input.priority];
  return ranked.sort((a, b) =>
    b.breakdown.matchScore - a.breakdown.matchScore ||
    b.breakdown[priorityCategory] - a.breakdown[priorityCategory] ||
    b.baseBreakdown.style - a.baseBreakdown.style ||
    a.influencer.id.localeCompare(b.influencer.id),
  ).slice(0, 3).map((result, index) => ({ ...result, rank: index + 1 }));
}
