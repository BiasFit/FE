import type { StyleName } from "../domain/scoring";

export const bodyTypes = [
  { name: "스트레이트", description: "상체와 하체의 균형감을 바탕으로 깔끔한 실루엣을 보는 유형", tone: "#F1F4FF" },
  { name: "웨이브", description: "부드러운 곡선과 하체 비율을 함께 보는 유형", tone: "#F6F1FF" },
  { name: "내추럴", description: "여유 있는 실루엣과 자연스러운 소재감을 보는 유형", tone: "#EEF8F7" },
] as const;

export const fitConcerns = [
  "전체 기장·비율", "밑위·하의 길이", "힙·허벅지 여유", "어깨선·소매 길이", "가슴·상체 여유", "허리·복부 여유",
];

export const styleOptions: { name: StyleName; description: string }[] = [
  { name: "캐주얼", description: "편안하고 자연스러운 일상 중심 스타일" },
  { name: "로맨틱", description: "부드럽고 화사한 분위기를 살린 스타일" },
  { name: "스트릿", description: "자유롭고 개성 있는 포인트 중심 스타일" },
  { name: "빈티지", description: "감성적인 소재와 패턴을 활용한 스타일" },
  { name: "오피스 & 비즈니스캐주얼", description: "단정함과 실용성을 함께 갖춘 스타일" },
];

export const keywords = [
  "편안한", "꾸안꾸", "자연스러운", "무난한", "심플한",
  "부드러운", "어른여자", "화사한", "페미닌한", "청순한",
  "힙한", "래퍼여친", "자유로운", "강렬한", "스포티한",
  "보헤미안", "모리걸", "에스닉", "레트로", "감성적인",
  "단정한", "깔끔한", "고급스러운", "세련된", "차분한",
];

export const designElements = [
  "무지", "데님 소재감", "루즈핏 실루엣", "베이직 디자인", "스트라이프 패턴",
  "쉬폰", "프릴", "수채화 색감", "리본",
  "그래픽 프린트", "데미지 디테일", "강렬한 컬러조합", "볼드한 타이포그래피",
  "빈티지 워싱", "믹스 패턴", "더스티 컬러",
  "테일러드 구조", "단색 디자인", "스트랩 디자인", "빳빳한 소재감", "핀턱 디자인", "정돈된 실루엣",
  "무채색", "레이스", "플라워 패턴", "레이어드",
];

export const preferredItems = [
  "스트라이프 셔츠", "데님 팬츠", "기본 슬리브리스", "깔끔한 반팔티셔츠", "에코백", "볼캡",
  "새틴 미디 스커트", "블랙 카프리 팬츠", "오프숄더 상의",
  "두꺼운 벨트", "찢어진 청바지", "크롭티", "그래픽 티셔츠", "볼드한 액세서리", "레더 부츠",
  "스카프", "니삭스", "캉캉 미디 스커트", "패턴 블라우스", "레이스 슬리브리스", "빈티지 워싱 데님",
  "단색 셔츠", "슬랙스", "재킷", "H라인 미디/롱스커트", "쉬폰 블라우스", "플리츠 니트",
];

export const avoidedElements = [
  "무난하고 평범한 데일리 룩", "힘을 뺀 꾸안꾸 스타일", "데님·티셔츠 중심의 캐주얼한 조합",
  "쉬폰·새틴처럼 하늘하늘한 소재", "청순하고 페미닌한 분위기가 돋보이는 스타일", "프릴·레이스·리본 등 페미닌한 장식이 들어간 룩",
  "그래픽·로고가 큰 룩", "힙한 분위기가 돋보이는 룩", "액세서리·컬러 포인트가 많은 룩",
  "빈티지 워싱처럼 낡고 바랜 듯한 소재감", "플라워·에스닉·믹스 패턴이 눈에 띄는 룩", "더스티 컬러처럼 채도를 낮춘 차분한 색감",
  "정장처럼 딱딱한 룩", "너무 성숙해 보이는 룩", "포멀한 재킷·슬랙스 중심 룩",
];

export const budgets = [
  { code: 1, label: "3만 원 미만" }, { code: 2, label: "3~6만 원" }, { code: 3, label: "6~9만 원" },
  { code: 4, label: "9~12만 원" }, { code: 5, label: "12~15만 원" }, { code: 6, label: "15~18만 원" }, { code: 7, label: "18만 원 이상" },
];

export function budgetRangeLabel(minCode: number, maxCode: number) {
  const safeMin = Math.max(1, Math.min(minCode, maxCode, budgets.length));
  const safeMax = Math.min(budgets.length, Math.max(minCode, maxCode, 1));
  if (safeMin === safeMax) return budgets.find((budget) => budget.code === safeMin)?.label ?? "";
  const minLabel = safeMin === 1 ? "3만 원 미만" : `${(safeMin - 1) * 3}만 원`;
  const maxLabel = safeMax === 7 ? "18만 원 이상" : `${safeMax * 3}만 원`;
  return `${minLabel}~${maxLabel}`;
}

export const budgetApproaches = ["총액 절약형", "일상 활용형", "소재·품질 우선형", "포인트 아이템 투자형"] as const;

/**
 * TPO는 사용자와 인플루언서가 같은 내부 코드로 비교한다.
 * 화면과 AI 프롬프트에는 label을 쓰고, 점수 계산에는 code만 쓴다.
 */
export const TPO_OPTIONS = [
  { code: "daily", label: "평소 일상 (등교)" },
  { code: "new_semester", label: "개강 행사" },
  { code: "presentation_interview", label: "발표·취업 면접" },
  { code: "date", label: "데이트·소개팅" },
  { code: "festival", label: "축제·공연 관람" },
  { code: "travel", label: "여행" },
  { code: "friend_meeting", label: "친구 모임" },
  { code: "club_activity", label: "동아리 활동" },
] as const;

export type TpoCode = (typeof TPO_OPTIONS)[number]["code"];

export const TPO_CODES = TPO_OPTIONS.map((tpo) => tpo.code);

export function tpoLabel(code: string) {
  return TPO_OPTIONS.find((tpo) => tpo.code === code)?.label ?? code;
}

export function isTpoCode(value: unknown): value is TpoCode {
  return TPO_CODES.includes(value as TpoCode);
}
