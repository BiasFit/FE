import type { StyleName } from "../domain/scoring";

export const bodyTypes = [
  {
    name: "스트레이트",
    description: "상·하체의 선이 비교적 곧고 중심감이 느껴지는 유형",
    tone: "#F1F4FF",
  },
  {
    name: "웨이브",
    description: "부드러운 곡선과 하체 쪽 비율을 함께 보는 유형",
    tone: "#F6F1FF",
  },
  {
    name: "내추럴",
    description: "여유 있는 실루엣과 자연스러운 선을 보는 유형",
    tone: "#EEF8F7",
  },
] as const;

export const fitConcerns = [
  "어깨선·소매 길이",
  "가슴·상체 여유",
  "허리·복부 여유",
  "힙·허벅지 여유",
  "밑위·하의 길이",
  "전체 기장·비율",
];

export const styleOptions: {
  name: StyleName;
  description: string;
}[] = [
  { name: "캐주얼", description: "편안하고 자연스러운 데일리 스타일" },
  {
    name: "로맨틱",
    description: "부드럽고 사랑스러운 디테일과 실루엣",
  },
  { name: "스트릿", description: "자유롭고 트렌디한 레이어드 스타일" },
  { name: "빈티지", description: "감성적인 소재와 클래식한 디테일" },
  {
    name: "오피스 & 비즈니스캐주얼",
    description: "단정하고 프로페셔널한 캠퍼스 스타일",
  },
];

export const keywords = [
  "부드러운",
  "사랑스러운",
  "자연스러운",
  "편안한",
  "실용적인",
  "은은한",
  "힙한",
  "개성 있는",
  "유니크한",
  "레트로",
  "클래식한",
  "감성적인",
  "단정한",
  "깔끔한",
  "신뢰감 있는",
];

export const designElements = [
  "리본",
  "셔링",
  "데님 소재감",
  "심플한 무지 디자인",
  "스포티한 배색",
  "스티치 포인트",
  "레이스",
  "플라워 패턴",
  "그래픽 프린트",
  "카고 포켓",
  "대미지 디테일",
  "레이어드 연출",
  "체크 패턴",
  "워싱 질감",
  "코듀로이 소재",
  "레더 소재",
  "테일러드 구조",
  "톤온톤 색감",
  "군더더기 없는 미니멀 디자인",
  "정돈된 단색 디자인",
];

export const preferredItems = [
  "A라인·플레어 스커트",
  "메리제인 슈즈",
  "기본 가디건",
  "반팔 티셔츠",
  "맨투맨",
  "에코백",
  "리본·셔링 블라우스",
  "원피스",
  "그래픽 티셔츠",
  "카고 팬츠",
  "바시티 재킷",
  "볼캡",
  "체크 셔츠",
  "코듀로이 팬츠",
  "니트 베스트",
  "레더 재킷",
  "셔츠",
  "슬랙스",
  "재킷",
  "H라인 스커트",
];

export const avoidedElements = [
  "정장처럼 딱딱한 룩",
  "과한 프릴 장식",
  "튀는 로고 플레이",
  "지나치게 편한 일상복",
];

export const budgets = [
  { code: 1, label: "3만 원 미만" },
  { code: 2, label: "3만~6만 원" },
  { code: 3, label: "6만~9만 원" },
  { code: 4, label: "9만~12만 원" },
  { code: 5, label: "12만~15만 원" },
  { code: 6, label: "15만~18만 원" },
  { code: 7, label: "18만 원 이상" },
];

export function budgetRangeLabel(minCode: number, maxCode: number) {
  const safeMin = Math.max(1, Math.min(minCode, maxCode, budgets.length));
  const safeMax = Math.min(budgets.length, Math.max(minCode, maxCode, 1));
  if (safeMin === safeMax) {
    return budgets.find((budget) => budget.code === safeMin)?.label ?? "";
  }
  const minLabel = safeMin === 1 ? "3만 원 미만" : `${(safeMin - 1) * 3}만`;
  const maxLabel = safeMax === 7 ? "18만 원 이상" : `${safeMax * 3}만 원`;
  return `${minLabel}~${maxLabel}`;
}

export const budgetApproaches = [
  "가성비 중심",
  "균형형",
  "품질·소재 우선",
  "투자 아이템 중심",
] as const;

export const tpos = [
  "등교·일상",
  "개강·새학기",
  "발표·면접",
  "데이트·소개팅",
  "축제·공연",
  "여행·사진",
  "동아리·모임",
  "인턴·출근",
  "격식 있는 자리",
];
