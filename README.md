# BiasFit (BF) Frontend

BiasFit (BF)는 19~24세 여성 대학생이 체형, 취향, 예산, 대학생활 TPO에 맞는 스타일 기준을 찾고 인플루언서에게 1:1 스타일링 코칭을 받을 수 있도록 돕는 AI 패션 매칭 웹 확장 MVP다.

사용자는 자신의 입력값으로 `Style DNA(매칭용 구조화 데이터)`를 만들고, 잘 맞는 스타일메이트(인플루언서) TOP 3를 확인한 뒤 1명을 선택해 코칭 채팅을 시작한다. 인플루언서는 매칭된 사용자의 Style DNA 요약을 확인하고 코칭 답변과 코디 카드를 전달한다.

이 저장소의 인플루언서 계정과 테스트 결과는 팀이 만든 샘플 데이터로 검증한다. 실제 인플루언서 모집·계약·정산, 상품 구매와 커머스 연동은 MVP 범위에 포함하지 않는다.

## MVP Scope

### 사용자 흐름

1. 사용자 회원가입 또는 로그인
2. 코칭 유형 선택: 개인 / 그룹
3. 체형·취향·예산·TPO 입력
4. Style DNA 진단 결과 확인
5. 인플루언서 TOP 3 카드 확인
6. 인플루언서 1명 선택 및 코칭 매칭
7. 1:1 스타일링 코칭 채팅 요청 및 답변 확인
8. 코디 카드 이미지 저장 또는 다운로드

체형 입력은 키, 상·하의 평소 사이즈, 스트레이트·웨이브·내추럴 중 체형 유형, 서술형 체형 고민으로 구성한다. 체형 유형과 스타일 선택 화면에는 설명과 샘플 이미지를 제공한다.

스타일 입력은 선호 스타일과 피하고 싶은 스타일을 각각 캐주얼·로맨틱·스트릿·빈티지·오피스 중 1개 선택하는 방식으로 구성한다. 예산은 다음의 사전 정의된 구간을 사용한다.

- 10,000원 이상 30,000원 미만
- 30,000원 이상 60,000원 미만
- 60,000원 이상 90,000원 미만
- 90,000원 이상 120,000원 미만
- 120,000원 이상 150,000원 미만
- 150,000원 이상 180,000원 미만
- 180,000원 이상

개인 진단은 개인 Style DNA를 보여주고, 그룹 진단은 구성원별 Style DNA 요약과 그룹 전체 스타일 방향을 함께 보여준다. 그룹 코디는 2인으로 제한하며, 관계 유형은 친구 / 가족 / 기타(직접 입력)로 선택한다. 그룹 테스트에서는 P4와 P5의 서로 다른 취향과 핏 고민을 모두 반영한다.

### 인플루언서 흐름

1. 인플루언서 회원가입 또는 로그인
2. 사용자와 구분되는 인플루언서 역할 확인
3. 체형·취향·예산·TPO 입력
4. 매칭된 사용자 Style DNA 요약 확인
5. 1:1 코칭 채팅으로 답변 및 코디 카드 전달

### AI 기능

- 사용자 입력값 구조화 및 Style DNA 생성·요약
- Style DNA와 인플루언서 프로필 비교 및 매칭 점수 계산
- 매칭 점수가 높은 TOP 3 추천
- 추천 가격대, 대표 스타일, 매칭 근거 생성
- 코디 카드 초안 문구와 보유 아이템 대체 팁 생성

AI 결과는 사용자의 외모나 몸매를 평가하지 않으며, 체형 정보는 스타일 선택을 돕는 참고 정보로만 사용한다.

### MVP 제외 범위

- 소셜 로그인 및 실제 개인정보 기반 인증 운영
- 결제, 구독, 유료 코디권, 정산
- 실제 인플루언서 모집·계약·정산
- 인플루언서 운영용 정교한 대시보드
- 상품 구매, 장바구니, 커머스 연동, 제휴 링크
- 친구 목록, 팔로우, 사용자 간 DM 및 공개 커뮤니티
- 공유 링크, 익명 투표, 친구 코멘트 수집
- 정밀 신체 치수 측정, 의료적 또는 피트니스적 체형 판단
- 네이티브 iOS·Android 앱

## Project Files

- `src/App.tsx`: React 앱 진입 화면과 주요 화면 구성
- `src/main.tsx`: React 앱 마운트
- `src/styles.css`: 전역 스타일
- `PRD.md`: 확장 MVP 제품 요구사항과 성공 기준
- `BiasFit_USER_PERSONAS.md`: P1~P5 입력·매칭·코디 카드 검증 데이터
- `AGENTS.md`: 작업 범위와 안전 원칙
- `vercel.json`: Vercel 배포 설정

## Stack

- React
- TypeScript
- Vite
- Vite PWA
- Vercel deployment config

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

`npm run build`는 현재 프론트엔드 소스의 빌드 가능 여부를 확인하는 명령이다. 기능별 구현 상태는 `PRD.md`의 요구사항과 `src` 소스를 함께 확인한다.

## Layout Baseline

The default app shell is sized for the iPhone 16 CSS viewport:

- Width: `393px`
- Height: `852px`

On smaller mobile screens, the shell uses the full available viewport.

## Deployment

This project includes `vercel.json` with:

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- SPA fallback rewrite to `index.html`

## Data Safety

- 테스트에는 실제 사용자 개인정보, 사진, 설문 응답, 친구 연락처를 사용하지 않는다.
- 회원가입과 로그인 검증에는 팀이 만든 더미 계정과 샘플 입력값만 사용한다.
- API 키, 비밀번호, 토큰, 인증 정보를 저장소에 기록하지 않는다.
