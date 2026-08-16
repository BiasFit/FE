# Style DNA and Diagnosis Save Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Style DNA 생성과 진단 DB 저장이 실제로 끝나기 전에는 사용자가 다음 필수 단계로 이동하지 못하게 해, 빠른 진행에서도 부탁해요 카드 전송 오류가 발생하지 않도록 한다.

**Architecture:** 두 개의 비관적 UI 게이트를 둔다. `DnaScreen`의 `TOP 3 보기`는 AI2 결과가 성공 상태일 때만 활성화하고, `Top3Screen`의 `선택하기`는 `savedResultId`가 생긴 뒤에만 활성화한다. UI 게이트와 별개로 부탁해요 카드 전송 단계의 `ensureSavedResultId()` 검증은 마지막 방어선으로 유지한다.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Testing Library, Vite

## Global Constraints

- `styleDnaStatus === "success"`이고 `styleDna !== null`이기 전에는 `TOP 3 보기`를 활성화하지 않는다.
- 진단 저장 API가 성공해 `savedResultId`가 생기기 전에는 TOP 3의 `선택하기`로 매칭 확정 화면에 이동하지 않는다.
- AI2 또는 저장 실패 시 빈 결과를 저장하거나 성공처럼 다음 화면으로 넘기지 않는다.
- 실패 상태에는 현재 화면에서 실행할 수 있는 `다시 시도`를 제공한다.
- 버튼의 HTML `disabled`와 클릭 handler 내부 검증을 함께 적용한다.
- `ensureSavedResultId()`와 `saveDiagnosisOnce()`의 중복 방지 로직은 제거하지 않는다.
- 부탁해요 카드는 저장된 `match_results.id`가 있을 때만 한 번 전송한다.
- 사용자 입력 원문, 인증 정보, 개인정보를 로그에 남기지 않는다.
- 새로운 런타임 의존성은 추가하지 않는다.
- 개인 흐름은 P1, 그룹 흐름은 P4/P5 페르소나로 회귀 검증한다.

---

## File Structure

| 파일 | 책임 | 계획된 변경 |
|---|---|---|
| `src/features/user/ResultScreens.tsx` | Style DNA와 TOP 3 화면, AI2/AI4 호출, 진단 저장 | AI2 완료 게이트, DB 저장 상태 표시, 저장 완료 전 선택 게이트, 저장 재시도 |
| `src/features/user/CoachingScreens.tsx` | 부탁해요 카드 전송 전 진단 id 확보 | 기존 최종 검증 유지, 누락 필드의 비민감 진단 로그 추가 |
| `src/features/flowScreens.test.tsx` | 사용자 전체 흐름 통합 테스트 | AI2 지연 gate, 저장 지연 gate, 실패·재시도 및 빠른 클릭 회귀 테스트 |

`AppState`에는 새 저장 상태를 추가하지 않는다. 실제 저장 완료의 source of truth는 이미 존재하는 `savedResultId`이고, 화면 표시용 `saveStatus`만 `Top3Screen`의 로컬 상태로 둔다. 이로써 세션 저장 구조와 reducer 변경을 피한다.

---

### Task 1: AI2 지연 재현 테스트 추가

**Files:**
- Modify: `src/features/flowScreens.test.tsx:18-31`
- Modify: `src/features/flowScreens.test.tsx:48-100`
- Modify: `src/features/flowScreens.test.tsx:334-360`

**Interfaces:**
- Consumes: `/api/ai/style-dna-explanation` fetch mock
- Produces: `holdStyleDna()`, `openStyleDnaGate`, `walkToDna()` 테스트 도우미

- [ ] **Step 1: AI2 응답을 붙잡는 테스트 gate를 추가한다**

```ts
let styleDnaGate: Promise<void> | null = null;
let openStyleDnaGate: (() => void) | null = null;

function holdStyleDna() {
  styleDnaGate = new Promise<void>((resolve) => {
    openStyleDnaGate = resolve;
  });
}
```

- [ ] **Step 2: `beforeEach`에서 AI2 gate를 초기화한다**

```ts
styleDnaGate = null;
openStyleDnaGate = null;
```

- [ ] **Step 3: AI2 fetch mock이 gate가 열릴 때까지 기다리게 한다**

`/api/ai/style-dna-explanation` 분기 첫 줄에 다음 코드를 넣는다.

```ts
if (styleDnaGate) await styleDnaGate;
```

- [ ] **Step 4: Style DNA 화면까지만 이동하는 도우미를 추가한다**

```ts
async function walkToDna() {
  window.location.hash = "#/user/priority";
  render(<App />);
  fireEvent.click(
    await screen.findByRole("radio", {
      name: "좋아하는 분위기를 먼저 지키고 싶어요",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: /진단 결과 보기/ }));
  return screen.findByRole("button", { name: /TOP 3|Style DNA 준비 중/ });
}
```

- [ ] **Step 5: AI2 완료 전 진행 불가 회귀 테스트를 작성한다**

```ts
it("Style DNA 생성 중에는 TOP 3로 이동할 수 없다", async () => {
  holdStyleDna();
  const topThreeButton = await walkToDna();

  expect(await screen.findByText("Style DNA 설명을 만들고 있어요.")).toBeVisible();
  expect(topThreeButton).toBeDisabled();

  fireEvent.click(topThreeButton);
  expect(window.location.hash).not.toBe("#/user/top3");

  openStyleDnaGate?.();
  await waitFor(() => expect(topThreeButton).toBeEnabled());

  fireEvent.click(topThreeButton);
  expect(
    await screen.findByRole("heading", {
      name: /스타일링을 받고 싶은\s*인플루언서를 선택해 주세요/,
    }),
  ).toBeVisible();
});
```

- [ ] **Step 6: 테스트를 실행해 현재 코드에서 실패하는지 확인한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx -t "Style DNA 생성 중에는"
```

Expected: FAIL. 현재 `TOP 3 보기` 버튼이 `styleDnaStatus === "loading"`에서도 활성화되어 있다.

- [ ] **Step 7: 테스트 변경만 커밋한다**

```bash
git add src/features/flowScreens.test.tsx
git commit -m "test: reproduce navigation before Style DNA is ready"
```

---

### Task 2: Style DNA 완료 전 TOP 3 버튼 비활성화

**Files:**
- Modify: `src/features/user/ResultScreens.tsx:303-316`
- Modify: `src/features/user/ResultScreens.tsx:331-346`
- Modify: `src/features/user/ResultScreens.tsx:446`
- Test: `src/features/flowScreens.test.tsx`

**Interfaces:**
- Consumes: `state.styleDnaStatus`, `state.styleDna`, 기존 AI2 `다시 시도`
- Produces: `canOpenTop3: boolean`, 진행 상태에 맞는 CTA

- [ ] **Step 1: Style DNA 준비 조건을 한 곳에서 계산한다**

`status`, `result` 선언 다음에 추가한다.

```ts
const canOpenTop3 = status === "success" && result !== null;
```

- [ ] **Step 2: CTA에 HTML 비활성 상태와 handler guard를 적용한다**

기존 CTA를 다음으로 교체한다.

```tsx
<PrimaryCta
  disabled={!canOpenTop3}
  onClick={() => {
    if (!canOpenTop3) return;
    navigate("/user/top3");
  }}
>
  {status === "loading" || status === "idle" ? "Style DNA 준비 중" : "TOP 3 보기"}
</PrimaryCta>
```

- [ ] **Step 3: AI2 실패 상태의 복구 행동을 확인한다**

기존 `다시 시도` 버튼은 `setRetry`를 증가시켜 AI2를 재호출한다. 이 상태에서는 `canOpenTop3`가 false이므로 CTA가 계속 비활성화되어야 한다. 성공 응답이 온 뒤에만 활성화된다.

- [ ] **Step 4: 기존 `walkToTopThree()`가 버튼 활성화를 기다리게 수정한다**

AI2 mock이 즉시 응답하더라도 React 상태 반영 전에는 버튼이 잠시 비활성 상태다. 모든 기존 흐름 테스트가 준비 완료 계약을 따르도록 helper를 수정한다.

```ts
const topThreeButton = await screen.findByRole("button", {
  name: /TOP 3|Style DNA 준비 중/,
});
await waitFor(() => expect(topThreeButton).toBeEnabled());
fireEvent.click(topThreeButton);
```

- [ ] **Step 5: Task 1 테스트를 다시 실행한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx -t "Style DNA 생성 중에는"
```

Expected: PASS.

- [ ] **Step 6: DnaScreen 관련 기존 테스트를 실행한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx -t "Style DNA|TOP 3"
```

Expected: 관련 테스트 전체 PASS.

- [ ] **Step 7: 구현을 커밋한다**

```bash
git add src/features/user/ResultScreens.tsx src/features/flowScreens.test.tsx
git commit -m "fix: gate TOP 3 until Style DNA is ready"
```

---

### Task 3: 진단 DB 저장 지연·실패 테스트 추가

**Files:**
- Modify: `src/features/flowScreens.test.tsx:14-31`
- Modify: `src/features/flowScreens.test.tsx:48-58`
- Modify: `src/features/flowScreens.test.tsx:157-160`
- Modify: `src/features/flowScreens.test.tsx:361-394`

**Interfaces:**
- Consumes: `/api/results/save` fetch mock, `savedPayloads`, `holdExplanations()`
- Produces: `holdDiagnosisSave()`, `openDiagnosisSaveGate`, `failDiagnosisSave` 테스트 제어값

- [ ] **Step 1: 저장 응답 gate와 실패 제어값을 추가한다**

```ts
let diagnosisSaveGate: Promise<void> | null = null;
let openDiagnosisSaveGate: (() => void) | null = null;
let failDiagnosisSave = false;

function holdDiagnosisSave() {
  diagnosisSaveGate = new Promise<void>((resolve) => {
    openDiagnosisSaveGate = resolve;
  });
}
```

- [ ] **Step 2: `beforeEach`에서 저장 제어값을 초기화한다**

```ts
diagnosisSaveGate = null;
openDiagnosisSaveGate = null;
failDiagnosisSave = false;
```

- [ ] **Step 3: 저장 fetch mock에 지연과 실패를 적용한다**

```ts
if (url.endsWith("/api/results/save")) {
  if (diagnosisSaveGate) await diagnosisSaveGate;
  if (failDiagnosisSave) {
    return new Response(JSON.stringify({ error: "진단 결과 저장에 실패했습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  savedPayloads.push(body);
  return jsonResponse({ id: `saved-${savedPayloads.length}` });
}
```

- [ ] **Step 4: 실제 저장 완료 전 선택 불가 테스트를 작성한다**

```ts
it("진단 결과가 실제 저장되기 전에는 스타일메이트를 확정할 수 없다", async () => {
  holdDiagnosisSave();
  await walkToTopThree();

  const selectButton = await screen.findByRole("button", { name: /진단 결과 저장 중|선택하기/ });
  expect(selectButton).toBeDisabled();

  fireEvent.click(selectButton);
  expect(window.location.hash).toBe("#/user/top3");

  openDiagnosisSaveGate?.();
  await waitFor(() => expect(savedPayloads).toHaveLength(1));
  await waitFor(() => expect(selectButton).toBeEnabled());

  fireEvent.click(selectButton);
  expect(window.location.hash).toBe("#/user/match");
});
```

- [ ] **Step 5: 저장 실패 후 재시도 전까지 진행 불가 테스트를 작성한다**

```ts
it("진단 저장 실패 시 다음 단계로 가지 않고 같은 화면에서 재시도한다", async () => {
  failDiagnosisSave = true;
  await walkToTopThree();

  expect(await screen.findByText("진단 결과 저장에 실패했어요.")).toBeVisible();
  expect(screen.getByRole("button", { name: "선택하기" })).toBeDisabled();
  expect(window.location.hash).toBe("#/user/top3");

  failDiagnosisSave = false;
  fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));

  await waitFor(() => expect(savedPayloads).toHaveLength(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "선택하기" })).toBeEnabled());
});
```

- [ ] **Step 6: 테스트를 실행해 현재 코드에서 실패하는지 확인한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx -t "진단 결과가 실제 저장|진단 저장 실패"
```

Expected: FAIL. 현재 선택 버튼은 저장 상태와 무관하게 활성화되고, 저장 실패 UI가 없다.

- [ ] **Step 7: 테스트 변경을 커밋한다**

```bash
git add src/features/flowScreens.test.tsx
git commit -m "test: require diagnosis save before influencer selection"
```

---

### Task 4: DB 저장 완료 전 선택 게이트와 저장 재시도 구현

**Files:**
- Modify: `src/features/user/ResultScreens.tsx:475-489`
- Modify: `src/features/user/ResultScreens.tsx:527-553`
- Modify: `src/features/user/ResultScreens.tsx:634-642`
- Modify: `src/features/user/ResultScreens.tsx:712-721`
- Test: `src/features/flowScreens.test.tsx`

**Interfaces:**
- Consumes: `saveDiagnosisOnce(snapshot)`, `state.savedResultId`, `state.matchExplanations`
- Produces: `saveStatus: AiRequestStatus`, `canSelectInfluencer: boolean`, `persistResult(explanations)` 재시도 경로

- [ ] **Step 1: Top3Screen에 저장 화면 상태를 추가한다**

`AiRequestStatus`가 이미 `app/types.ts`에서 export되므로 `ResultScreens.tsx`의 type import에 추가하고 다음 상태를 선언한다.

```ts
const [saveStatus, setSaveStatus] = useState<AiRequestStatus>(
  state.savedResultId ? "success" : "idle",
);
const canSelectInfluencer = Boolean(state.savedResultId);
```

실제 활성 조건은 로컬 상태가 아니라 서버가 돌려준 id인 `savedResultId`로 계산한다.

- [ ] **Step 2: `persistResult`가 저장 상태를 갱신하게 한다**

```ts
function persistResult(explanations: MatchExplanation[]) {
  const snapshot = buildResultSnapshot(
    { ...state, matchExplanations: explanations },
    ranked,
  );
  if (!snapshot) {
    setSaveStatus("error");
    console.log("[BiasFit 저장] 진단 스냅샷 준비 안 됨", {
      hasPriority: Boolean(state.matchPriority),
      hasStyleDna: Boolean(state.styleDna),
      rankedCount: ranked.length,
    });
    return;
  }

  setSaveStatus("loading");
  void saveDiagnosisOnce(snapshot)
    .then(({ id }) => {
      dispatch({ type: "setSavedResultId", id });
      setSaveStatus("success");
    })
    .catch((error: unknown) => {
      console.log("[BiasFit 저장] 진단 결과 저장 실패", error);
      setSaveStatus("error");
    });
}
```

로그는 boolean과 후보 수만 포함하며 사용자 입력이나 부탁해요 카드 본문을 포함하지 않는다.

- [ ] **Step 3: 저장 준비·실패 UI를 TOP 3 카드 위에 추가한다**

```tsx
{ranked.length > 0 && !canSelectInfluencer ? (
  <div className="rounded-[18px] bg-[#f5f5f7] p-4" aria-live="polite">
    {saveStatus === "error" ? (
      <>
        <p className="text-[13px] text-[#3c3c43]">진단 결과 저장에 실패했어요.</p>
        <button
          type="button"
          onClick={() => persistResult(state.matchExplanations)}
          className="mt-2 rounded-full border border-[#e8e8ec] bg-white px-4 py-2 text-[13px] font-semibold text-[#3c3c43]"
        >
          저장 다시 시도
        </button>
      </>
    ) : (
      <p className="text-[13px] text-[#8e8e93]">
        진단 결과를 안전하게 저장하고 있어요.
      </p>
    )}
  </div>
) : null}
```

AI4가 실패한 경우에는 기존 `추천 근거 다시 시도` 버튼이 표시되고 `savedResultId`가 없으므로 선택 버튼은 계속 잠긴다.

- [ ] **Step 4: `선택하기`에 실제 저장 완료 게이트를 적용한다**

```tsx
<button
  type="button"
  disabled={!canSelectInfluencer}
  onClick={() => {
    if (!canSelectInfluencer) return;
    select();
    navigate("/user/match");
  }}
  className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-40"
>
  {canSelectInfluencer ? "선택하기" : "진단 결과 저장 중"}
</button>
```

- [ ] **Step 5: Task 3 테스트를 다시 실행한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx -t "진단 결과가 실제 저장|진단 저장 실패"
```

Expected: PASS.

- [ ] **Step 6: AI4 실패 기존 테스트를 엄격한 게이트 정책에 맞춘다**

기존 `추천 근거 호출이 실패해도 전송 시점에 저장하고 카드가 나간다` 테스트는 다음 계약으로 변경한다.

```ts
it("추천 근거 호출 실패 시 선택을 막고 재시도 성공 후 저장한다", async () => {
  failExplanations = true;
  await walkToTopThree();

  expect(await screen.findByRole("button", { name: "추천 근거 다시 시도" })).toBeVisible();
  expect(screen.getByRole("button", { name: /진단 결과 저장 중/ })).toBeDisabled();
  expect(savedPayloads).toHaveLength(0);
  expect(sentCards).toHaveLength(0);

  failExplanations = false;
  fireEvent.click(screen.getByRole("button", { name: "추천 근거 다시 시도" }));

  await waitFor(() => expect(savedPayloads).toHaveLength(1));
  expect(await screen.findByRole("button", { name: "선택하기" })).toBeEnabled();
});
```

- [ ] **Step 7: 구현과 정책 변경 테스트를 커밋한다**

```bash
git add src/features/user/ResultScreens.tsx src/features/flowScreens.test.tsx
git commit -m "fix: gate influencer selection until diagnosis is saved"
```

---

### Task 5: 전송 단계 최종 방어선과 전체 회귀 검증

**Files:**
- Modify: `src/features/user/CoachingScreens.tsx:192-201`
- Test: `src/features/flowScreens.test.tsx`
- Verify: `src/features/user/ResultScreens.tsx`

**Interfaces:**
- Consumes: `buildResultSnapshot`, `saveDiagnosisOnce`, `sendRequestCard`
- Produces: 누락 상태 진단 로그, 저장 성공 뒤 한 번만 전송되는 검증

- [ ] **Step 1: `ensureSavedResultId()`의 마지막 방어선을 유지하고 누락 상태만 기록한다**

```ts
const snapshot = buildResultSnapshot(state, state.rankedInfluencers);
if (!snapshot) {
  console.log("[BiasFit 전송] 진단 스냅샷 준비 안 됨", {
    hasPriority: Boolean(state.matchPriority),
    hasStyleDna: Boolean(state.styleDna),
    rankedCount: state.rankedInfluencers.length,
  });
  setNeedsDiagnosis(true);
  throw new Error("진단 결과가 없어요. 진단을 다시 확인해 주세요.");
}
```

버튼 게이트가 있어도 새로고침, 직접 URL 진입, 오래된 sessionStorage 등 비정상 경로를 막기 위해 이 검증을 제거하지 않는다.

- [ ] **Step 2: 빠른 진행 통합 테스트를 최종 사용자 계약으로 수정한다**

기존 AI4 빠른 진행 테스트는 “일찍 선택해도 된다”가 아니라 “저장이 끝나기 전에는 선택할 수 없다”를 검증해야 한다.

```ts
it("빠르게 진행해도 저장 완료 전에는 선택되지 않고 완료 후 카드가 한 번 나간다", async () => {
  holdExplanations();
  await walkToTopThree();

  const waitingButton = await screen.findByRole("button", { name: /진단 결과 저장 중/ });
  expect(waitingButton).toBeDisabled();
  fireEvent.click(waitingButton);
  expect(window.location.hash).toBe("#/user/top3");

  openExplanationGate?.();
  await waitFor(() => expect(savedPayloads).toHaveLength(1));

  fireEvent.click(await screen.findByRole("button", { name: "선택하기" }));
  await writeAndSend();

  await waitFor(() => expect(sentCards).toHaveLength(1));
  expect(sentCards[0].matchResultId).toBe("saved-1");
  expect(savedPayloads).toHaveLength(1);
});
```

- [ ] **Step 3: 사용자 전체 흐름 테스트를 실행한다**

Run:

```bash
npm test -- src/features/flowScreens.test.tsx
```

Expected: 모든 `flowScreens` 테스트 PASS.

- [ ] **Step 4: 전체 테스트를 실행한다**

Run:

```bash
npm test
```

Expected: 전체 테스트 PASS. 기존 기준 173개 이상이며 새 회귀 테스트가 추가된 수만큼 증가한다.

- [ ] **Step 5: 타입 검사와 배포 빌드를 실행한다**

Run:

```bash
npm run build
```

Expected: `tsc -b`와 `vite build` 모두 exit code 0.

- [ ] **Step 6: 로컬 브라우저에서 P1과 P4/P5 흐름을 수동 검증한다**

개인 P1:

1. 우선순위 선택 후 진단 결과 진입
2. AI2 로딩 중 `TOP 3 보기` 비활성 확인
3. AI2 성공 후 버튼 활성 확인
4. TOP 3 진입 후 저장 중 `선택하기` 비활성 확인
5. 저장 성공 후 선택·확정·부탁해요 카드 전송
6. 진단 결과 1건, 부탁해요 카드 1건 확인

그룹 P4/P5:

1. A/B 입력과 그룹 TPO 유지 확인
2. 그룹 Style DNA 완료 전 TOP 3 이동 불가 확인
3. 저장 완료 후에만 선택 가능 확인
4. 그룹 요청이 수신 한도에서 1건으로 계산되는지 확인

- [ ] **Step 7: 최종 검증 변경을 커밋한다**

```bash
git add src/features/user/CoachingScreens.tsx src/features/flowScreens.test.tsx
git commit -m "test: verify strict diagnosis readiness gates"
```

---

## Deployment Verification Checklist

구현과 로컬 검증 뒤 별도 배포 권한을 받아 배포한 경우에만 수행한다.

- [ ] 배포 번들이 구현 커밋을 포함하는지 확인
- [ ] 실제 `/api/ai/style-dna-explanation` 응답 중 `TOP 3 보기`가 비활성인지 확인
- [ ] AI2 성공 후에만 TOP 3로 이동하는지 확인
- [ ] `/api/results/save` 완료 전 `선택하기`가 비활성인지 확인
- [ ] 저장 실패를 강제로 만들었을 때 같은 화면에서 재시도 가능한지 확인
- [ ] `mimi` 또는 수신 여유 프로필로 더미 부탁해요 카드 1건 전송
- [ ] `match_results` 1건과 `request_cards` 1건이 같은 id로 연결되는지 확인
- [ ] 연속 클릭에도 중복 저장·중복 전송이 없는지 확인
- [ ] 수신 한도 409가 진단 저장 오류와 다른 안내로 보이는지 확인

## Definition of Done

- AI2 로딩·실패 중에는 TOP 3로 이동할 수 없다.
- Style DNA가 성공한 경우에만 TOP 3 버튼이 활성화된다.
- 진단 DB 저장 완료 전에는 인플루언서를 확정할 수 없다.
- 저장 실패 시 다음 단계로 넘어가지 않고 같은 화면에서 재시도할 수 있다.
- 전송 handler는 저장된 진단 id를 다시 확인하며, 카드 전송은 한 번만 발생한다.
- P1 개인 및 P4/P5 그룹 회귀 테스트가 통과한다.
- 전체 테스트와 배포 빌드가 통과한다.
- 실제 배포 검증은 별도 배포 승인 후 수행한다.
