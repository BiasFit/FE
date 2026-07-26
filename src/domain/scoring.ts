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

const keywordStyle: Record<string, StyleName> = {
  편안한: "캐주얼",
  자연스러운: "캐주얼",
  실용적인: "캐주얼",
  부드러운: "로맨틱",
  사랑스러운: "로맨틱",
  은은한: "로맨틱",
  힙한: "스트릿",
  "개성 있는": "스트릿",
  유니크한: "스트릿",
  레트로: "빈티지",
  클래식한: "빈티지",
  감성적인: "빈티지",
  단정한: "오피스 & 비즈니스캐주얼",
  깔끔한: "오피스 & 비즈니스캐주얼",
  "신뢰감 있는": "오피스 & 비즈니스캐주얼",
};

const designStyle: Record<string, StyleName> = {
  "심플한 무지 디자인": "캐주얼",
  "데님 소재감": "캐주얼",
  "스포티한 배색": "캐주얼",
  "스티치 포인트": "캐주얼",
  리본: "로맨틱",
  셔링: "로맨틱",
  레이스: "로맨틱",
  "플라워 패턴": "로맨틱",
  "그래픽 프린트": "스트릿",
  "카고 포켓": "스트릿",
  "대미지 디테일": "스트릿",
  "레이어드 연출": "스트릿",
  "체크 패턴": "빈티지",
  "워싱 질감": "빈티지",
  "코듀로이 소재": "빈티지",
  "레더 소재": "빈티지",
  "테일러드 구조": "오피스 & 비즈니스캐주얼",
  "톤온톤 색감": "오피스 & 비즈니스캐주얼",
  "군더더기 없는 미니멀 디자인": "오피스 & 비즈니스캐주얼",
  "정돈된 단색 디자인": "오피스 & 비즈니스캐주얼",
};

const itemStyle: Record<string, StyleName> = {
  "반팔 티셔츠": "캐주얼",
  맨투맨: "캐주얼",
  "기본 가디건": "캐주얼",
  에코백: "캐주얼",
  "리본·셔링 블라우스": "로맨틱",
  "A라인·플레어 스커트": "로맨틱",
  원피스: "로맨틱",
  "메리제인 슈즈": "로맨틱",
  "그래픽 티셔츠": "스트릿",
  "카고 팬츠": "스트릿",
  "바시티 재킷": "스트릿",
  볼캡: "스트릿",
  "체크 셔츠": "빈티지",
  "코듀로이 팬츠": "빈티지",
  "니트 베스트": "빈티지",
  "레더 재킷": "빈티지",
  셔츠: "오피스 & 비즈니스캐주얼",
  슬랙스: "오피스 & 비즈니스캐주얼",
  재킷: "오피스 & 비즈니스캐주얼",
  "H라인 스커트": "오피스 & 비즈니스캐주얼",
};

const avoidedStyleMap: Record<string, StyleName> = {
  "지나치게 편한 일상복 느낌": "캐주얼",
  "기본 아이템만 겹친 단조로운 룩": "캐주얼",
  "꾸민 느낌이 거의 없는 룩": "캐주얼",
  "리본·프릴 장식이 많은 룩": "로맨틱",
  "너무 어려 보이는 사랑스러운 분위기": "로맨틱",
  "레이스·파스텔이 과한 룩": "로맨틱",
  "그래픽·로고가 큰 룩": "스트릿",
  "힙하고 튀는 스트릿 분위기": "스트릿",
  "액세서리·컬러 포인트가 많은 룩": "스트릿",
  "낡아 보이는 워싱 느낌": "빈티지",
  "체크·브라운이 과하게 겹친 룩": "빈티지",
  "칙칙하고 어두운 레트로 색감": "빈티지",
  "정장처럼 딱딱한 룩": "오피스 & 비즈니스캐주얼",
  "너무 성숙해 보이는 단정룩": "오피스 & 비즈니스캐주얼",
  "포멀한 재킷·슬랙스 중심 룩": "오피스 & 비즈니스캐주얼",
};

function countSignals(
  selections: string[],
  mapping: Record<string, StyleName>,
  style: StyleName,
) {
  return selections.reduce(
    (count, selection) => count + Number(mapping[selection] === style),
    0,
  );
}

export function calculateStyleScores(input: StyleSignalInput): StyleScores {
  return Object.fromEntries(
    STYLE_NAMES.map((style) => {
      const keywordScore =
        25 * (countSignals(input.keywords, keywordStyle, style) / 3);
      const designScore =
        25 * (countSignals(input.designElements, designStyle, style) / 3);
      const itemScore =
        25 * (countSignals(input.preferredItems, itemStyle, style) / 3);
      const conflictCount = countSignals(
        input.avoidedElements,
        avoidedStyleMap,
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

interface GroupMatchInput {
  memberA: MemberMatchParts;
  memberB: MemberMatchParts;
  sharedTpo: number;
  coachingType: number;
}

function weightedGroupPart(scoreA: number, scoreB: number) {
  const lower = Math.min(scoreA, scoreB);
  const average = (scoreA + scoreB) / 2;
  return Math.round(lower * 0.7 + average * 0.3);
}

export function calculateGroupMatchScore(input: GroupMatchInput) {
  const style = weightedGroupPart(
    input.memberA.style,
    input.memberB.style,
  );
  const fit = weightedGroupPart(input.memberA.fit, input.memberB.fit);
  const budget = weightedGroupPart(
    input.memberA.budget,
    input.memberB.budget,
  );

  return {
    style,
    fit,
    budget,
    tpo: input.sharedTpo,
    coachingType: input.coachingType,
    total: style + fit + budget + input.sharedTpo + input.coachingType,
  };
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

export interface PersonalMatchInput {
  mode: "personal";
  styleScores: StyleScores;
  avoidedStyle: StyleName;
  bodyType: string;
  fitConcerns: string[];
  budgetCode: number;
  budgetApproach: string;
  tpo: string;
}

export interface MatchBreakdown {
  style: number;
  fit: number;
  budget: number;
  tpo: number;
  coachingType: number;
  total: number;
}

function scoreStylePreference(
  input: Pick<PersonalMatchInput, "styleScores" | "avoidedStyle">,
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
  input: Pick<PersonalMatchInput, "bodyType" | "fitConcerns">,
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

function scoreBudget(
  input: Pick<PersonalMatchInput, "budgetCode" | "budgetApproach">,
  influencer: InfluencerProfile,
) {
  const exact = influencer.budgetCodes.includes(input.budgetCode);
  const adjacent = influencer.budgetCodes.some(
    (code) => Math.abs(code - input.budgetCode) === 1,
  );
  const range = exact ? 15 : adjacent ? 8 : 0;
  const approach =
    input.budgetApproach === influencer.budgetApproach ? 5 : 0;
  return range + approach;
}

export function calculateInfluencerMatch(
  input: PersonalMatchInput,
  influencer: InfluencerProfile,
): MatchBreakdown {
  const style = scoreStylePreference(input, influencer);
  const fit = scoreFit(input, influencer);
  const budget = scoreBudget(input, influencer);
  const tpo = influencer.tpos.includes(input.tpo) ? 15 : 0;
  const coachingType =
    influencer.coachingType === "personal" ||
    influencer.coachingType === "both"
      ? 10
      : 0;

  return {
    style,
    fit,
    budget,
    tpo,
    coachingType,
    total: style + fit + budget + tpo + coachingType,
  };
}

interface GroupMatchMemberInput {
  styleScores: StyleScores;
  avoidedStyle: StyleName;
  bodyType: string;
  fitConcerns: string[];
  budgetCode: number;
  budgetApproach: string;
}

export type RankMatchInput =
  | PersonalMatchInput
  | {
      mode: "group";
      members: [GroupMatchMemberInput, GroupMatchMemberInput];
      tpo: string;
    };

export interface RankedInfluencer {
  influencer: InfluencerProfile;
  breakdown: MatchBreakdown;
}

function toPersonalMatchInput(
  member: GroupMatchMemberInput,
  tpo: string,
): PersonalMatchInput {
  return { mode: "personal", ...member, tpo };
}

export function rankInfluencers(
  input: RankMatchInput,
  profiles: InfluencerProfile[],
): RankedInfluencer[] {
  const candidates = profiles.filter((profile) => {
    if (!profile.profileCompleted) return false;
    if (input.mode === "group") {
      return (
        profile.coachingType === "group" || profile.coachingType === "both"
      );
    }
    return true;
  });

  return candidates
    .map((influencer) => {
      if (input.mode === "personal") {
        return {
          influencer,
          breakdown: calculateInfluencerMatch(input, influencer),
        };
      }

      const memberA = calculateInfluencerMatch(
        toPersonalMatchInput(input.members[0], input.tpo),
        influencer,
      );
      const memberB = calculateInfluencerMatch(
        toPersonalMatchInput(input.members[1], input.tpo),
        influencer,
      );
      const breakdown = calculateGroupMatchScore({
        memberA,
        memberB,
        sharedTpo: influencer.tpos.includes(input.tpo) ? 15 : 0,
        coachingType: 10,
      });
      return { influencer, breakdown };
    })
    .sort((a, b) => b.breakdown.total - a.breakdown.total)
    .slice(0, 3);
}
