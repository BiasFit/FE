import type { DiagnosisForm } from "../app/types.js";

export const personaForms: Record<DiagnosisForm["personaId"], DiagnosisForm> = {
  P1: {
    personaId: "P1", height: 158, topSize: "55 (S)", bottomSize: "55 (S)", bodyType: "웨이브",
    fitConcerns: ["전체 기장·비율", "밑위·하의 길이"], fitNote: "긴 바지나 치마를 입으면 비율이 답답해 보인다.",
    preferredStyle: "로맨틱", avoidedStyle: "스트릿",
    keywords: ["부드러운", "심플한", "자연스러운"], designElements: ["리본", "레이스", "데님 소재감"],
    preferredItems: ["새틴 미디 스커트", "쉬폰 블라우스", "데님 팬츠"], avoidedElements: ["정장처럼 딱딱한 룩"],
    budgetCode: 2, budgetMinCode: 2, budgetMaxCode: 2, budgetApproach: "총액 절약형", tpo: "new_semester",
  },
  P2: {
    personaId: "P2", height: 163, topSize: "66 (M)", bottomSize: "66 (M)", bodyType: "내추럴",
    fitConcerns: ["힙·허벅지 여유", "어깨선·소매 길이"], fitNote: "힙과 허벅지가 편하고 어깨선이 어색하지 않은 기본 코디를 찾고 있다.",
    preferredStyle: "오피스 & 비즈니스캐주얼", avoidedStyle: "로맨틱",
    keywords: ["단정한", "깔끔한", "세련된"], designElements: ["테일러드 구조", "단색 디자인", "핀턱 디자인"],
    preferredItems: ["단색 셔츠", "슬랙스", "플리츠 니트"], avoidedElements: ["무난하고 평범한 데일리 룩"],
    budgetCode: 3, budgetMinCode: 3, budgetMaxCode: 3, budgetApproach: "일상 활용형", tpo: "daily",
  },
  P3: {
    personaId: "P3", height: 166, topSize: "66 (M)", bottomSize: "66 (M)", bodyType: "스트레이트",
    fitConcerns: ["어깨선·소매 길이", "가슴·상체 여유"], fitNote: "재킷이나 셔츠를 입으면 어깨가 넓어 보이거나 상체가 답답하게 느껴진다.",
    preferredStyle: "오피스 & 비즈니스캐주얼", avoidedStyle: "스트릿",
    keywords: ["단정한", "고급스러운", "부드러운"], designElements: ["테일러드 구조", "단색 디자인", "쉬폰"],
    preferredItems: ["단색 셔츠", "재킷", "쉬폰 블라우스"], avoidedElements: ["프릴·레이스·리본 등 페미닌한 장식이 들어간 룩"],
    budgetCode: 4, budgetMinCode: 4, budgetMaxCode: 4, budgetApproach: "소재·품질 우선형", tpo: "presentation_interview",
  },
  P4: {
    personaId: "P4", height: 157, topSize: "55 (S)", bottomSize: "55 (S)", bodyType: "웨이브",
    fitConcerns: ["전체 기장·비율", "밑위·하의 길이"], fitNote: "사진에서 다리가 짧아 보이지 않도록 하의 길이를 조절하고 싶다.",
    preferredStyle: "캐주얼", avoidedStyle: "오피스 & 비즈니스캐주얼",
    keywords: ["편안한", "자연스러운", "부드러운"], designElements: ["무지", "데님 소재감", "리본"],
    preferredItems: ["깔끔한 반팔티셔츠", "에코백", "새틴 미디 스커트"], avoidedElements: ["힙한 분위기가 돋보이는 룩"],
    budgetCode: 2, budgetMinCode: 2, budgetMaxCode: 2, budgetApproach: "총액 절약형", tpo: "travel",
  },
  P5: {
    personaId: "P5", height: 165, topSize: "66 (M)", bottomSize: "66 (M)", bodyType: "내추럴",
    fitConcerns: ["가슴·상체 여유", "어깨선·소매 길이"], fitNote: "오래 움직여도 상체가 답답하지 않고 어깨선이 자연스러운 옷을 원한다.",
    preferredStyle: "오피스 & 비즈니스캐주얼", avoidedStyle: "로맨틱",
    keywords: ["단정한", "깔끔한", "세련된"], designElements: ["테일러드 구조", "단색 디자인", "핀턱 디자인"],
    preferredItems: ["단색 셔츠", "슬랙스", "플리츠 니트"], avoidedElements: ["무난하고 평범한 데일리 룩"],
    budgetCode: 3, budgetMinCode: 3, budgetMaxCode: 3, budgetApproach: "일상 활용형", tpo: "travel",
  },
};

export const requestCopy = {
  personal: "개강 첫 주에 입을 옷이 필요해요. 너무 꾸민 느낌보다 편하게 학교에 갈 수 있으면서 사진에도 괜찮은 코디를 받고 싶어요.",
  group: "친구와 사진을 많이 찍을 예정이라 어느 정도 연결감은 있었으면 해요. 각자의 취향은 살리면서 오래 걸어도 편한 코디로 부탁해요.",
};
