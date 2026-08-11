import type { InfluencerProfile } from "../domain/scoring";

export interface StylemateView extends InfluencerProfile {
  tagline: string;
  description: string;
  price: string;
  occasions: string;
}

export const influencers: StylemateView[] = [
  {
    id: "stylemate-01",
    name: "STYLEMATE 01",
    profileCompleted: true,
    primaryStyle: "로맨틱",
    secondaryStyle: "캐주얼",
    bodyType: "웨이브",
    fitConcerns: ["밑위·하의 길이", "전체 기장·비율"],
    budgetCodes: [2, 3],
    budgetApproach: "가성비 중심",
    tpos: ["new_semester", "daily", "travel"],
    coachingType: "both",
    tagline: "로맨틱 캠퍼스",
    description:
      "부드러운 무드와 하의 비율 고민을 함께 살리는 제안에 강해요.",
    price: "7.2만 원 이하",
    occasions: "개강·OT·여행",
  },
  {
    id: "stylemate-02",
    name: "STYLEMATE 02",
    profileCompleted: true,
    primaryStyle: "오피스 & 비즈니스캐주얼",
    secondaryStyle: "캐주얼",
    bodyType: "웨이브",
    fitConcerns: ["밑위·하의 길이", "전체 기장·비율"],
    budgetCodes: [2, 3, 4],
    budgetApproach: "균형형",
    tpos: ["new_semester", "daily", "presentation_interview"],
    coachingType: "both",
    tagline: "깔끔한 꾸안꾸",
    description:
      "단정한 색감과 편안한 캠퍼스 조합을 자연스럽게 만들어요.",
    price: "6.5만 원 이하",
    occasions: "수업·과팅·나들이",
  },
  {
    id: "stylemate-03",
    name: "STYLEMATE 03",
    profileCompleted: true,
    primaryStyle: "캐주얼",
    secondaryStyle: "빈티지",
    bodyType: "내추럴",
    fitConcerns: ["전체 기장·비율", "가슴·상체 여유"],
    budgetCodes: [2, 3],
    budgetApproach: "가성비 중심",
    tpos: ["daily", "club_activity", "travel"],
    coachingType: "both",
    tagline: "보유템 활용",
    description:
      "기본 아이템을 중심으로 재현하기 쉬운 조합을 제안해요.",
    price: "7.8만 원 이하",
    occasions: "동아리·일상·여행",
  },
  {
    id: "stylemate-04",
    name: "STYLEMATE 04",
    profileCompleted: true,
    primaryStyle: "스트릿",
    secondaryStyle: "빈티지",
    bodyType: "스트레이트",
    fitConcerns: ["어깨선·소매 길이"],
    budgetCodes: [3, 4],
    budgetApproach: "투자 아이템 중심",
    tpos: ["club_activity", "festival", "friend_meeting"],
    coachingType: "personal",
    tagline: "스트릿 레이어드",
    description: "레이어드와 포인트 아이템으로 개성 있는 균형을 만들어요.",
    price: "10만 원 이하",
    occasions: "축제·공연·모임",
  },
  {
    id: "stylemate-05",
    name: "STYLEMATE 05",
    profileCompleted: true,
    primaryStyle: "오피스 & 비즈니스캐주얼",
    secondaryStyle: "로맨틱",
    bodyType: "스트레이트",
    fitConcerns: ["어깨선·소매 길이", "가슴·상체 여유"],
    budgetCodes: [3, 4],
    budgetApproach: "품질·소재 우선",
    tpos: ["presentation_interview", "date", "travel"],
    coachingType: "group",
    tagline: "단정한 시밀러룩",
    description:
      "서로 다른 취향을 색감과 소재로 연결하는 그룹 제안에 강해요.",
    price: "11만 원 이하",
    occasions: "발표·데이트·여행",
  },
];
