import { useNavigate } from "react-router-dom";
import type { DiagnosisForm } from "../../app/types.js";
import { useAppState } from "../../app/AppStateProvider.js";
import {
  avoidedElements,
  bodyTypes,
  budgetApproaches,
  designElements,
  fitConcerns,
  keywords,
  preferredItems,
  sizeOptions,
  styleOptions,
  TPO_OPTIONS,
  type TpoCode,
} from "../../data/options.js";
import { MemberSwitch } from "../../shared/FlowShell.js";
import { BudgetRangeSlider } from "../../shared/BudgetRangeSlider.js";
import { PrimaryCta, SelectChip, StepHeader } from "../../shared/AppShell.js";
import iconAvatar from "../../assets/mypage/icon-avatar.svg";
import iconCheck from "../../assets/mypage/icon-check.svg";

/** 디자인 요소 26개·아이템 27개 참고 사진. 파일명이 `data/options.ts`의 항목 이름과 같아서
 * 번호 접두사만 떼면 바로 매칭된다 (2026-08-16). */
const styleImageFiles = import.meta.glob("../../assets/design-elements/fashion_style_images_square_1x1/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const itemImageFiles = import.meta.glob("../../assets/design-elements/fashion_item_images_square_1x1/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function imageLookup(files: Record<string, string>) {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const file = path.split("/").pop() ?? "";
    if (/^00_/.test(file)) continue;
    const name = file.replace(/^\d+_/, "").replace(/\.jpg$/, "");
    map[name] = url;
  }
  return map;
}
const styleImageByName = imageLookup(styleImageFiles);
const itemImageByName = imageLookup(itemImageFiles);
/** 파일명이 "H라인 미디·롱스커트"로 저장돼 있어 데이터의 "H라인 미디/롱스커트"와 문자만 다르다. */
function itemImage(name: string) {
  return itemImageByName[name] ?? itemImageByName[name.replace("/", "·")];
}

const lookImageFiles = import.meta.glob("../../assets/design-elements/fashion_reference_based_looks_3x4/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const bodyTypeImageFiles = import.meta.glob("../../assets/design-elements/body_type_human_like_3x4/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const lookImageByName = imageLookup(lookImageFiles);
const bodyTypeImageByName = imageLookup(bodyTypeImageFiles);
/** 파일명은 "비즈니스"인데 데이터는 "오피스 & 비즈니스캐주얼"이다. */
function styleLookImage(name: string) {
  return lookImageByName[name] ?? (name.includes("비즈니스") ? lookImageByName["비즈니스"] : undefined);
}

function useCurrentDiagnosis() {
  const { state, dispatch } = useAppState();
  const form =
    state.mode === "personal"
      ? state.personal
      : state.group.members[state.activeMember];
  const update = (patch: Partial<DiagnosisForm>) => {
    if (state.mode === "personal") {
      dispatch({ type: "updatePersonal", patch });
    } else {
      dispatch({
        type: "updateGroupMember",
        member: state.activeMember,
        patch,
      });
    }
  };
  return { state, dispatch, form, update };
}


/** U3-1 · 체형 정보. 이전에는 핏 고민까지 한 화면이었는데, 피그마에서 U3-2로 분리됐다 (2026-08-15). */
export function BodyScreen() {
  const navigate = useNavigate();
  const { state, dispatch, form, update } = useCurrentDiagnosis();

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="1 / 5"
        progress={0.2}
        onBack={() => navigate("/user/coaching")}
        title="본인의 체형 정보를 알려주세요."
        description={
          <>
            입력한 정보는 스타일링 추천의
            <br />
            참고 기준으로만 사용해요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6">
        {state.mode === "group" ? (
          <div className="mt-[22px] rounded-[16px] bg-[#f5f5f7] p-4">
            <p className="text-[15px] font-bold text-[#0a0a0a]">함께 스타일링받을 두 사람</p>
            <p className="mt-1 text-[13px] text-[#8e8e93]">관계를 먼저 정하고 구성원별 정보를 입력해요.</p>
            <select
              className="mt-3 h-[44px] w-full rounded-[12px] border border-[#e8e8ec] bg-white px-3 text-[14px] text-[#0a0a0a]"
              aria-label="관계 유형"
              value={state.group.relationship}
              onChange={(event) =>
                dispatch({
                  type: "updateGroup",
                  patch: { relationship: event.target.value as "friend" | "family" | "other" },
                })
              }
            >
              <option value="friend">친구</option>
              <option value="family">가족</option>
              <option value="other">기타</option>
            </select>
            {state.group.relationship === "other" ? (
              <input
                className="mt-2 h-[44px] w-full rounded-[12px] border border-[#e8e8ec] px-3 text-[14px]"
                value={state.group.relationshipOther}
                placeholder="예: 룸메이트, 동아리 친구"
                onChange={(event) =>
                  dispatch({ type: "updateGroup", patch: { relationshipOther: event.target.value } })
                }
              />
            ) : null}
          </div>
        ) : null}
        <div className="mt-[22px]">
          <MemberSwitch />
        </div>

        <p className="mt-[22px] text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">키</p>
        <div className="mt-3 flex min-h-[56px] items-center rounded-[14px] bg-[#f5f5f7] px-[18px]">
          <input
            aria-label="키"
            type="number"
            min={130}
            max={200}
            value={form.height}
            onChange={(event) => update({ height: Number(event.target.value) })}
            className="w-full bg-transparent text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a] outline-none"
          />
          <span className="shrink-0 text-[13px] text-[#8e8e93]">cm</span>
        </div>

        <p className="mt-[30px] text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">상의 사이즈</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sizeOptions.map((size) => (
            <SelectChip key={size} selected={form.topSize === size} onClick={() => update({ topSize: size })}>
              {size}
            </SelectChip>
          ))}
        </div>

        <p className="mt-[30px] text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">하의 사이즈</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sizeOptions.map((size) => (
            <SelectChip key={size} selected={form.bottomSize === size} onClick={() => update({ bottomSize: size })}>
              {size}
            </SelectChip>
          ))}
        </div>

        <div className="mt-[34px] flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">체형 유형</p>
          <p className="text-[13px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex gap-[10px]" role="radiogroup" aria-label="체형 유형">
          {bodyTypes.map((bodyType) => {
            const selected = form.bodyType === bodyType.name;
            return (
              <button
                key={bodyType.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ bodyType: bodyType.name })}
                className="flex w-[111px] flex-col items-start gap-[9px]"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[148px] w-[111px] items-center justify-center overflow-hidden rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[148px] w-[111px] items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  {bodyTypeImageByName[bodyType.name] ? (
                    <img src={bodyTypeImageByName[bodyType.name]} alt="" className="size-full object-cover" />
                  ) : (
                    <img src={iconAvatar} alt="" className="size-[24px]" />
                  )}
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-[22px]" /> : null}
                </span>
                <span
                  className={
                    selected
                      ? "text-[13px] font-bold tracking-[-0.195px] text-[#0a0a0a]"
                      : "text-[13px] font-medium tracking-[-0.195px] text-[#3c3c43]"
                  }
                >
                  {bodyType.name}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-[14px] rounded-[14px] bg-[#f5f5f7] px-4 py-[14px]">
          <p className="text-[13px] leading-[1.5] text-[#3c3c43]">
            {bodyTypes.find((b) => b.name === form.bodyType)?.description ?? "체형 유형을 선택하면 설명이 나와요."}
          </p>
        </div>

        <p className="mt-[14px] text-[13px] text-[#8e8e93]">체형 정보로 외모나 몸매를 평가하지 않아요.</p>
      </div>
      <PrimaryCta
        onClick={() => navigate("/user/fit")}
        disabled={
          state.mode === "group" &&
          state.group.relationship === "other" &&
          !state.group.relationshipOther.trim()
        }
      >
        다음
      </PrimaryCta>
    </section>
  );
}

/** U3-2 · 핏 고민. U3-1에서 분리된 화면 (2026-08-15). */
export function FitScreen() {
  const navigate = useNavigate();
  const { form, update } = useCurrentDiagnosis();

  const toggleFitConcern = (value: string) => {
    if (form.fitConcerns.includes(value)) {
      update({ fitConcerns: form.fitConcerns.filter((item) => item !== value) });
    } else if (form.fitConcerns.length < 2) {
      update({ fitConcerns: [...form.fitConcerns, value] });
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="2 / 5"
        progress={0.4}
        onBack={() => navigate("/user/body")}
        title={
          <>
            평소 핏에 대해
            <br />
            느끼는 고민을 알려주세요.
          </>
        }
        description="패션 인플루언서가 가장 먼저 확인하는 항목이에요."
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[34px]">
        <MemberSwitch />
        <div className="flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">핏 고민</p>
          <p className="text-[13px] text-[#8e8e93]">{form.fitConcerns.length} / 2</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {fitConcerns.map((concern) => (
            <SelectChip
              key={concern}
              selected={form.fitConcerns.includes(concern)}
              onClick={() => toggleFitConcern(concern)}
              disabled={!form.fitConcerns.includes(concern) && form.fitConcerns.length >= 2}
            >
              {concern}
            </SelectChip>
          ))}
        </div>

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">조금 더 알려주기</p>
          <p className="text-[13px] text-[#8e8e93]">선택</p>
        </div>
        <textarea
          className="mt-3 min-h-[132px] w-full rounded-[14px] bg-[#f5f5f7] px-[18px] py-4 text-[15px] text-[#0a0a0a] outline-none placeholder:text-[#8e8e93]"
          value={form.fitNote}
          onChange={(event) => update({ fitNote: event.target.value })}
          placeholder="체형이나 핏과 관련해 평소 고민하는 부분을 자세히 적어주세요."
        />
      </div>
      <PrimaryCta onClick={() => navigate("/user/style")}>다음</PrimaryCta>
    </section>
  );
}

/**
 * U3-3A · 스타일과 키워드. 예전 StyleScreen(선호/기피 스타일)에
 * SignalsScreen이 갖고 있던 "선호 키워드"가 합쳐졌다 (2026-08-15).
 */
export function StyleScreen() {
  const navigate = useNavigate();
  const { form, update } = useCurrentDiagnosis();

  const toggleKeyword = (value: string) => {
    if (form.keywords.includes(value)) {
      update({ keywords: form.keywords.filter((item) => item !== value) });
    } else if (form.keywords.length < 3) {
      update({ keywords: [...form.keywords, value] });
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="3 / 5"
        progress={0.55}
        onBack={() => navigate("/user/fit")}
        title={
          <>
            어떤 스타일을
            <br />
            좋아하나요?
          </>
        }
        description={
          <>
            좋아하는 스타일 1개와
            <br />
            피하고 싶은 스타일 1개를 골라주세요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[32px]">
        <MemberSwitch />
        <div className="flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">선호 스타일</p>
          <p className="text-[13px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div
          className="mt-[14px] flex gap-[11px] overflow-x-auto pb-1"
          role="radiogroup"
          aria-label="선호 스타일"
        >
          {styleOptions.map((style) => {
            const selected = form.preferredStyle === style.name;
            return (
              <button
                key={style.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (style.name !== form.avoidedStyle) update({ preferredStyle: style.name });
                }}
                className="flex w-[122px] shrink-0 flex-col items-start gap-[9px]"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[162px] w-[122px] items-center justify-center overflow-hidden rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[162px] w-[122px] items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  {styleLookImage(style.name) ? (
                    <img src={styleLookImage(style.name)} alt="" className="size-full object-cover" />
                  ) : (
                    <img src={iconAvatar} alt="" className="size-[24px]" />
                  )}
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-[22px]" /> : null}
                </span>
                <span
                  className={
                    selected
                      ? "text-[13px] font-bold tracking-[-0.195px] text-[#0a0a0a]"
                      : "text-[13px] font-medium tracking-[-0.195px] text-[#3c3c43]"
                  }
                >
                  {style.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-[10px] text-[13px] text-[#8e8e93]">옆으로 밀면 나머지 스타일도 볼 수 있어요.</p>

        <div className="mt-[34px] flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">피하고 싶은 스타일</p>
          <p className="text-[13px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {styleOptions.map((style) => (
            <SelectChip
              key={style.name}
              selected={form.avoidedStyle === style.name}
              disabled={form.preferredStyle === style.name}
              onClick={() => update({ avoidedStyle: style.name })}
            >
              {style.name}
            </SelectChip>
          ))}
        </div>

        <div className="mt-[34px] flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">선호 키워드</p>
          <p className="text-[13px] text-[#8e8e93]">{form.keywords.length} / 3</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <SelectChip
              key={keyword}
              selected={form.keywords.includes(keyword)}
              disabled={!form.keywords.includes(keyword) && form.keywords.length >= 3}
              onClick={() => toggleKeyword(keyword)}
            >
              {keyword}
            </SelectChip>
          ))}
        </div>
      </div>
      <PrimaryCta onClick={() => navigate("/user/design")} disabled={form.keywords.length !== 3}>
        다음
      </PrimaryCta>
    </section>
  );
}

/**
 * U3-3B · 디자인 요소. 예전 SignalsScreen에서 "선호 디자인 요소"만 남기고
 * 키워드는 위 화면으로, 선호 아이템·피하고 싶은 요소는 화면에서 뺐다 (2026-08-15,
 * 매칭 점수 계산 로직은 그대로 둔다는 결정에 따름 — 두 값은 그대로 저장된 기본값을 쓴다).
 *
 * 피그마에는 스타일별 필터 탭(전체/캐주얼/로맨틱…)이 있지만, `designElements`
 * 데이터에 스타일 태그가 없어서 실제로 거를 방법이 없다. 필터처럼 보이는 UI만
 * 두면 "눌러도 안 되는 버튼"이 되므로, 지금은 정적 표시만 하고 실제 필터링은
 * 데이터가 갖춰지면 연결한다.
 */
export function DesignScreen() {
  const navigate = useNavigate();
  const { form, update } = useCurrentDiagnosis();

  const toggleDesign = (value: string) => {
    if (form.designElements.includes(value)) {
      update({ designElements: form.designElements.filter((item) => item !== value) });
    } else if (form.designElements.length < 3) {
      update({ designElements: [...form.designElements, value] });
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="3 / 5"
        progress={0.62}
        onBack={() => navigate("/user/style")}
        title={
          <>
            내가 좋아하는
            <br />
            패션 요소를 골라보세요.
          </>
        }
        description={
          <>
            가장 끌리는 3개를 골라주세요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[24px]">
        <MemberSwitch />
        <div
          className="mt-[22px] grid grid-cols-2 gap-x-[11px] gap-y-[20px]"
          role="group"
          aria-label="선호 디자인 요소"
        >
          {designElements.map((element) => {
            const selected = form.designElements.includes(element);
            const disabled = !selected && form.designElements.length >= 3;
            return (
              <button
                key={element}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleDesign(element)}
                className="flex flex-col items-start gap-[9px] disabled:opacity-40"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[190px] w-full items-center justify-center overflow-hidden rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[190px] w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  {styleImageByName[element] ? (
                    <img src={styleImageByName[element]} alt="" className="size-full object-cover" />
                  ) : (
                    <img src={iconAvatar} alt="" className="size-[24px]" />
                  )}
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-[22px]" /> : null}
                </span>
                <span
                  className={
                    selected
                      ? "text-[13px] font-bold tracking-[-0.195px] text-[#0a0a0a]"
                      : "text-[13px] font-medium tracking-[-0.195px] text-[#3c3c43]"
                  }
                >
                  {element}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 장바구니처럼 스크롤해도 화면 하단에 계속 붙어 있게 sticky로 묶었다 (피드백 2026-08-15). */}
      <div className="sticky bottom-0 z-10 bg-white">
        <div className="flex flex-col gap-3 rounded-t-[20px] bg-white px-5 py-4 shadow-[0_-6px_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between text-[#0a0a0a]">
            <p className="text-[16px] font-semibold tracking-[-0.32px]">고른 항목</p>
            <p className="text-[13px] tracking-[-0.195px]">{form.designElements.length} / 3</p>
          </div>
          {form.designElements.length > 0 ? (
            <div className="flex flex-wrap gap-[6px]">
              {form.designElements.map((element) => (
                <SelectChip key={element} selected onClick={() => toggleDesign(element)}>
                  {element} ✕
                </SelectChip>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8e8e93]">아직 고른 항목이 없어요.</p>
          )}
        </div>
        <PrimaryCta onClick={() => navigate("/user/item")} disabled={form.designElements.length !== 3}>
          다음
        </PrimaryCta>
      </div>
    </section>
  );
}

/**
 * U3-3C · 아이템 + 피하고 싶은 요소. SCREEN_SPEC.md 3.3.3의 "3-C" 하위 단계다.
 * 피그마 v3 재작업 때 프레임이 없어서 화면만 빼고(preferredItems·avoidedElements는
 * DiagnosisForm·점수 계산에 계속 남아 있었다) 값이 항상 빈 배열로 들어가고 있었는데,
 * 이제 프레임(node 142:2)이 생겨서 되살렸다 (2026-08-16).
 */
export function ItemScreen() {
  const navigate = useNavigate();
  const { form, update } = useCurrentDiagnosis();

  const toggleItem = (value: string) => {
    if (form.preferredItems.includes(value)) {
      update({ preferredItems: form.preferredItems.filter((item) => item !== value) });
    } else if (form.preferredItems.length < 3) {
      update({ preferredItems: [...form.preferredItems, value] });
    }
  };

  const toggleAvoided = (value: string) => {
    if (form.avoidedElements.includes(value)) {
      update({ avoidedElements: form.avoidedElements.filter((item) => item !== value) });
    } else if (form.avoidedElements.length < 3) {
      update({ avoidedElements: [...form.avoidedElements, value] });
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="3 / 5"
        progress={0.71}
        onBack={() => navigate("/user/design")}
        title={
          <>
            입고 싶은 아이템을
            <br />
            골라보세요.
          </>
        }
        description={
          <>
            가장 끌리는 3개를 골라주세요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[24px]">
        <MemberSwitch />
        <div
          className="mt-[22px] grid grid-cols-2 gap-x-[11px] gap-y-[20px]"
          role="group"
          aria-label="선호 아이템"
        >
          {preferredItems.map((item) => {
            const selected = form.preferredItems.includes(item);
            const disabled = !selected && form.preferredItems.length >= 3;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleItem(item)}
                className="flex flex-col items-start gap-[9px] disabled:opacity-40"
              >
                <span
                  className={
                    selected
                      ? "relative flex h-[190px] w-full items-center justify-center overflow-hidden rounded-[14px] border-2 border-[#0a0a0a] bg-[#f2f2f5]"
                      : "relative flex h-[190px] w-full items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f5]"
                  }
                >
                  {itemImage(item) ? (
                    <img src={itemImage(item)} alt="" className="size-full object-cover" />
                  ) : (
                    <img src={iconAvatar} alt="" className="size-[24px]" />
                  )}
                  {selected ? <img src={iconCheck} alt="" className="absolute right-1.5 top-1.5 size-[22px]" /> : null}
                </span>
                <span
                  className={
                    selected
                      ? "text-[13px] font-bold tracking-[-0.195px] text-[#0a0a0a]"
                      : "text-[13px] font-medium tracking-[-0.195px] text-[#3c3c43]"
                  }
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-9 flex items-center justify-between border-t border-[#e8e8ec] pt-[22px]">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">피하고 싶은 요소</p>
          <p className="text-[12px] text-[#8e8e93]">{form.avoidedElements.length} / 3 · 선택</p>
        </div>
        <div className="mt-[10px] text-[12px] text-[#8e8e93]">
          <p>없어도 괜찮아요.</p>
          <p>코디에서 빼고 싶은 느낌이 있다면 골라주세요.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-[8px]" role="group" aria-label="피하고 싶은 요소">
          {avoidedElements.map((element) => {
            const selected = form.avoidedElements.includes(element);
            const disabled = !selected && form.avoidedElements.length >= 3;
            return (
              <SelectChip key={element} selected={selected} disabled={disabled} onClick={() => toggleAvoided(element)}>
                {element}
              </SelectChip>
            );
          })}
        </div>
      </div>

      {/* 장바구니처럼 스크롤해도 화면 하단에 계속 붙어 있게 sticky로 묶었다 — 디자인 요소 화면과 같은 방식(2026-08-15). */}
      <div className="sticky bottom-0 z-10 bg-white">
        <div className="flex flex-col gap-3 rounded-t-[20px] bg-white px-5 py-4 shadow-[0_-6px_20px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between text-[#0a0a0a]">
            <p className="text-[16px] font-semibold tracking-[-0.32px]">고른 아이템</p>
            <p className="text-[13px] tracking-[-0.195px]">{form.preferredItems.length} / 3</p>
          </div>
          {form.preferredItems.length > 0 ? (
            <div className="flex flex-wrap gap-[6px]">
              {form.preferredItems.map((item) => (
                <SelectChip key={item} selected onClick={() => toggleItem(item)}>
                  {item} ✕
                </SelectChip>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#8e8e93]">아직 고른 아이템이 없어요.</p>
          )}
        </div>
        <PrimaryCta onClick={() => navigate("/user/budget")} disabled={form.preferredItems.length !== 3}>
          다음
        </PrimaryCta>
      </div>
    </section>
  );
}

/**
 * U3-4 · 예산과 TPO. 예전 BudgetScreen에 TpoScreen의 TPO 선택이 합쳐졌다 (2026-08-15).
 * 그룹 모드에서는 TPO가 구성원별이 아니라 약속 하나라, `state.group.tpo`를 그대로 쓴다
 * (기존 TpoScreen의 분기 로직을 그대로 옮겼다).
 */
export function BudgetScreen() {
  const navigate = useNavigate();
  const { state, dispatch, form, update } = useCurrentDiagnosis();
  const tpoValue = state.mode === "group" ? state.group.tpo : form.tpo;
  const setTpo = (tpo: TpoCode) => {
    if (state.mode === "group") {
      dispatch({ type: "updateGroup", patch: { tpo } });
    } else {
      update({ tpo });
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <StepHeader
        stepLabel="4 / 5"
        progress={0.8}
        onBack={() => navigate("/user/item")}
        title={
          <>
            평소 패션에 사용하는
            <br />
            비용을 알려주세요.
          </>
        }
        description={
          <>
            상의 1개와 하의 1개를 함께 살 때를
            <br />
            기준으로 골라주세요.
          </>
        }
      />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[34px]">
        <MemberSwitch />
        <BudgetRangeSlider
          minCode={form.budgetMinCode}
          maxCode={form.budgetMaxCode}
          onChange={({ minCode, maxCode }) =>
            update({
              budgetMinCode: minCode,
              budgetMaxCode: maxCode,
              budgetCode: Math.round((minCode + maxCode) / 2),
            })
          }
        />

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">평소 구매 기준</p>
          <p className="text-[13px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2">
          {budgetApproaches.map((approach) => (
            <SelectChip
              key={approach}
              selected={form.budgetApproach === approach}
              onClick={() => update({ budgetApproach: approach })}
            >
              {approach}
            </SelectChip>
          ))}
        </div>

        <div className="mt-9 flex items-center justify-between">
          <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">필요한 상황 (TPO)</p>
          <p className="text-[13px] text-[#8e8e93]">1개 선택</p>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-2" role="radiogroup" aria-label="TPO">
          {TPO_OPTIONS.map((tpo) => (
            <SelectChip key={tpo.code} selected={tpoValue === tpo.code} onClick={() => setTpo(tpo.code)}>
              {tpo.label}
            </SelectChip>
          ))}
        </div>
      </div>
      <PrimaryCta onClick={() => navigate("/user/priority")}>다음</PrimaryCta>
    </section>
  );
}

// TpoScreen은 U3-4(BudgetScreen)에 TPO가 합쳐지고, 우선순위는 PriorityScreen(U3-5,
// PriorityQuestion.tsx)으로 독립하면서 없어졌다 (2026-08-15).
