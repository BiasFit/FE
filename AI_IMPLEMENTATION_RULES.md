# BiasFit AI 기능 구현 작업 규칙

## 1. 작업 원칙

- OpenAI API 키는 서버에서 `process.env.OPENAI_API_KEY`로 읽는다.
- 모델은 서버에서 `process.env.OPENAI_MODEL`로 읽으며 코드에 고정하지 않는다.
- API 키와 모델 환경변수를 `VITE_` 접두사로 노출하지 않는다.
- OpenAI는 문장 생성과 안전 표현 검수만 담당한다.
- 점수, 후보 필터, 순위, TOP 3, 링크 검사는 코드가 담당한다.
- OpenAI 응답은 서버에서 스키마와 근거를 검증한 뒤 프런트엔드에 전달한다.
- 아래 허용 파일 외에는 생성·수정·삭제하지 않는다.

## 2. 작업 허용 파일

### 공통 기반

- 생성·수정: `.env` (`OPENAI_API_KEY`, `OPENAI_MODEL`만 허용)
- 확인·필요 시 수정: `.gitignore` (`.env` 제외 규칙만 허용)
- 생성: `api/_lib/openai.ts`
- 생성: `api/_lib/http.ts`
- 생성: `src/domain/aiContracts.ts`
- 생성: `src/lib/biasfitApi.ts`

### 맞춤 우선순위 선택지

- 수정: `src/app/types.ts`
- 수정: `src/app/appState.ts`
- 수정: `src/features/user/DiagnosisScreens.tsx`
- 생성: `api/ai/priority-options.ts`
- 생성: `src/features/user/PriorityQuestion.tsx`
- 수정: `src/features/flowScreens.test.tsx`

### Style DNA·그룹 조합 설명

- 수정: `src/domain/scoring.ts`
- 수정: `src/app/types.ts`
- 수정: `src/features/user/ResultScreens.tsx`
- 생성: `api/ai/style-dna-explanation.ts`
- 생성: `src/features/user/StyleDnaExplanation.tsx`
- 수정: `src/domain/scoring.test.ts`
- 수정: `src/features/flowScreens.test.tsx`

### 매칭 점수·TOP 3

- 수정: `src/domain/scoring.ts`
- 수정: `src/data/influencers.ts`
- 수정: `src/features/user/ResultScreens.tsx`
- 생성: `src/domain/matchPriority.ts`
- 생성: `api/matches/top-three.ts`
- 수정: `src/domain/scoring.test.ts`

### TOP 3 추천 근거

- 수정: `src/features/user/ResultScreens.tsx`
- 생성: `api/ai/match-explanations.ts`
- 생성: `src/features/user/MatchReason.tsx`
- 수정: `src/features/flowScreens.test.tsx`
- 생성: `api/ai/match-explanations.test.ts`

### 코디 카드 안전 표현·링크 검수

- 수정: `src/app/types.ts`
- 수정: `src/features/influencer/InfluencerScreens.tsx`
- 수정: `src/domain/outfit.ts`
- 생성: `api/outfit/review.ts`
- 생성: `api/_lib/safe-language.ts`
- 생성: `api/_lib/link-checker.ts`
- 생성: `src/features/influencer/OutfitReviewPanel.tsx`
- 수정: `src/domain/outfit.test.ts`
- 생성: `api/outfit/review.test.ts`

### 작업 규칙

- 생성·수정: `AI_IMPLEMENTATION_RULES.md`

## 3. 기능별 구현 규칙

### 3.1 맞춤 우선순위 선택지

- `src/app/types.ts`에 `MatchPriority`, `PriorityOption`, 요청·응답 타입을 정의한다.
- `src/app/appState.ts`에 선택 우선순위, 선택지, 요청 상태와 reducer action을 추가한다.
- `api/ai/priority-options.ts`는 진단 입력을 받아 다음 네 코드의 맞춤 문구만 생성한다.
  - `style_first`
  - `fit_first`
  - `budget_first`
  - `tpo_first`
- `src/features/user/PriorityQuestion.tsx`는 네 선택지와 로딩·오류·재시도를 표시한다.
- `src/features/user/DiagnosisScreens.tsx`는 결과 버튼 바로 위에 질문을 표시하고, 미선택 시 결과 진행을 막는다.

### 3.2 Style DNA·그룹 조합 설명

- `src/domain/scoring.ts`가 `styleScores`와 그룹 조합 수치를 먼저 계산한다.
- `api/ai/style-dna-explanation.ts`는 확정된 계산값을 변경하지 않고 요약과 중요 포인트만 생성한다.
- 개인 요약은 15~35자 내외이며 `~한 스타일`로 끝낸다.
- 그룹 요약은 20~45자 내외이며 A·B 근거를 모두 포함하고 `~한 스타일`로 끝낸다.
- 중요 포인트는 2~3개이며 각 문장에 `evidenceRefs`를 포함한다.
- `src/features/user/ResultScreens.tsx`는 AI 설명을 표시하고 실패 시 계산 결과를 유지한 채 재시도를 제공한다.

### 3.3 매칭 점수·TOP 3

- `src/domain/scoring.ts`에서 코칭 지원 유형 점수를 제거하고 후보 필터로만 사용한다.
- `src/domain/matchPriority.ts`는 개인·그룹 우선순위별 90점 배점표와 가중치 적용을 담당한다.
- 개인은 스타일·핏·예산·TPO, 그룹은 스타일·핏·예산·공통 TPO를 계산한다.
- 그룹 구성원 점수는 `round(낮은 점수 × 0.7 + 평균 점수 × 0.3)`으로 합친다.
- 표시 점수는 `round(원점수 / 90 × 100)`으로 계산한다.
- `api/matches/top-three.ts`는 후보 필터, 점수 계산, 환산, 정렬, 상위 3명 선정을 순서대로 실행한다.
- 동점은 선택 우선순위 항목 점수, 기본 스타일 점수, `influencerId` 오름차순으로 정렬한다.

### 3.4 TOP 3 추천 근거

- `api/ai/match-explanations.ts`는 확정된 TOP 3와 항목별 계산 근거만 OpenAI에 전달한다.
- OpenAI는 후보, 순위, 점수를 생성하거나 변경하지 않고 추천 근거 문장만 생성한다.
- 서버는 응답의 `influencerId`와 `evidenceRefs`가 요청의 TOP 3 및 계산 근거에 포함되는지 검증한다.
- 그룹 설명은 구성원 A·B의 실제 계산 근거를 모두 포함한다.
- `src/features/user/MatchReason.tsx`는 추천 근거의 로딩·성공·오류·재시도 상태를 표시한다.

### 3.5 코디 카드 안전 표현·링크 검수

- `api/_lib/safe-language.ts`는 OpenAI로 외모·몸매 평가, 결함·교정, 비하, 비교, 강요 표현을 검사한다.
- OpenAI는 문제 위치·이유·수정 제안만 반환하며 원문을 자동 수정하지 않는다.
- `api/_lib/link-checker.ts`는 상의·하의 URL 형식, 리다이렉트, 응답 상태와 시간 초과를 검사한다.
- 링크 검사에서 `localhost`, 사설 IP, 내부 주소, 비 HTTP(S), 과도한 리다이렉트를 차단한다.
- `api/outfit/review.ts`는 안전 표현 검사와 링크 검사를 병렬 실행한다.
- 결과 상태는 `pass`, `needs_revision`, `operations_review`, `blocked`만 사용한다.
- `src/features/influencer/OutfitReviewPanel.tsx`는 문제와 수정 제안을 표시한다.
- `src/features/influencer/InfluencerScreens.tsx`는 `pass`일 때만 코디 카드 전달을 확정한다.

## 4. 검증 규칙

- 우선순위 API가 네 고정 코드 외 값을 반환하면 실패 처리한다.
- 개인·그룹 설명의 길이, 종결형, 포인트 개수와 `evidenceRefs`를 검증한다.
- P1~P3 개인 점수와 P4·P5 그룹 점수를 회귀 테스트한다.
- 코칭 지원 불가 후보가 TOP 3에서 제외되는지 검증한다.
- 모든 우선순위 프로필이 90점 원점수를 유지하는지 검증한다.
- 동일 입력에서 TOP 3 순서가 항상 같은지 검증한다.
- TOP 3 추천 근거가 후보·순위·점수를 변경하지 않는지 검증한다.
- 그룹 추천 근거가 A·B 데이터를 모두 보존하는지 검증한다.
- 안전 표현 문제와 링크 상태별 최종 전달 상태를 검증한다.
- `pass`가 아닌 코디 카드의 전달 확정 버튼이 비활성화되는지 검증한다.

## 5. 작업 금지

- 허용 목록 밖 파일의 생성·수정·삭제
- API 키 또는 모델명의 코드 하드코딩
- 브라우저에서 OpenAI API 직접 호출
- OpenAI를 이용한 점수·순위·TOP 3 결정
- OpenAI 응답으로 기존 계산 결과 덮어쓰기
- 신발·기타 아이템을 코디 카드 검수 범위에 추가
- 사용자와 인플루언서 간 채팅·답장 기능 추가
- 코디 카드 문구 자동 수정 또는 자동 전달
