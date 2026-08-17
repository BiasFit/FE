import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getDiagnosisResult,
  getInfluencers,
  getMyAccount,
  getMypageOverview,
  getOutfitCard,
  trackEvent,
  type DiagnosisResultView,
  type MypageDiagnosis,
  type MypageOverview,
  type MypagePending,
  type OutfitCardItemView,
  type OutfitCardView,
} from "../../lib/biasfitApi.js";
import { tpoLabel } from "../../data/options.js";
import { influencerPhotoStyle } from "../../shared/influencerPhoto.js";
import { useAuth } from "../../app/AuthProvider.js";
import { BottomTabBar, Pill, TopBar } from "../../shared/AppShell.js";
import type { MatchPriority } from "../../app/types.js";
import { PRIORITY_CATEGORY_TITLE } from "./PriorityQuestion.js";

import iconAvatar from "../../assets/mypage/icon-avatar.svg";
import iconChevronRight from "../../assets/mypage/icon-chevron-right.svg";
import iconCaretDown from "../../assets/mypage/icon-caret-down.svg";
import iconImagePlaceholder from "../../assets/mypage/icon-image-placeholder.svg";
import iconItemPlaceholder from "../../assets/mypage/icon-item-placeholder.svg";
import iconChevronDown from "../../assets/mypage/icon-chevron-down.svg";

/**
 * SCREEN_SPEC.md 3.9 마이페이지 (신설).
 * 피그마 `10 · v3 · 사용자 화면` 페이지의 U8(마이페이지 홈), U9(코디 카드 기록 상세)를
 * 그대로 옮기고, 진단 기록 상세는 명세 문구를 기준으로 같은 톤으로 새로 짰다
 * (피그마에 해당 프레임이 아직 없다).
 */

/* ---------------------------------- 표시용 유틸 ---------------------------------- */

function shortDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(iso: string | null): string {
  if (!iso) return "받은 날짜 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "받은 날짜 미상";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} 받음`;
}

function coachingTypeLabel(type: "personal" | "group") {
  return type === "group" ? "2인 그룹" : "개인";
}

/* ---------------------------------- 공용 조각 ----------------------------------
 * Pill/TopBar/BottomTabBar는 U2(CoachingScreen)와 함께 쓰려고 shared/AppShell.tsx로 옮겼다.
 */

function ThumbnailSkeletonGrid() {
  return (
    <div className="grid w-full grid-cols-2 gap-x-[11px] gap-y-[22px]" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-[10px]">
          <div className="h-[206px] w-full animate-pulse rounded-[14px] bg-[#f2f2f5]" />
          <div className="h-[13px] w-3/4 animate-pulse rounded bg-[#f2f2f5]" />
          <div className="h-[11px] w-1/2 animate-pulse rounded bg-[#f2f2f5]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description, onStart }: { title: string; description: string; onStart: () => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-[14px] rounded-[20px] bg-[#f5f5f7] px-6 py-14 text-center">
      <p className="text-[15px] font-medium text-[#0a0a0a]">{title}</p>
      <p className="text-[13px] text-[#8e8e93]">{description}</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-full bg-[#0a0a0a] px-5 py-[10px] text-[13px] font-semibold text-white"
      >
        새 스타일 진단 시작하기
      </button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-[12px] rounded-[20px] bg-[#f5f5f7] px-6 py-14 text-center">
      <p className="text-[13px] text-[#8e8e93]">기록을 불러오지 못했어요.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-[#e8e8ec] bg-white px-5 py-[10px] text-[13px] font-semibold text-[#3c3c43]"
      >
        다시 시도
      </button>
    </div>
  );
}

/** `최신순` / `TPO별` 제어 + TPO 선택 시트. 코디 카드 탭과 진단 기록 탭이 함께 쓴다. */
function SortFilterRow({
  count,
  tpoCatalog,
  tpoFilter,
  onChangeTpoFilter,
}: {
  count: number;
  tpoCatalog: string[];
  tpoFilter: string | null;
  onChangeTpoFilter: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex w-full items-center gap-2">
      <button
        type="button"
        onClick={() => onChangeTpoFilter(null)}
        className={
          tpoFilter === null
            ? "inline-flex items-center rounded-full bg-[#0a0a0a] px-3 py-[6px] text-[11px] font-semibold text-white"
            : "inline-flex items-center rounded-full border border-[#e8e8ec] bg-white px-3 py-[6px] text-[11px] font-semibold text-[#3c3c43]"
        }
      >
        최신순
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          tpoFilter !== null
            ? "inline-flex items-center gap-[5px] rounded-full bg-[#0a0a0a] px-3 py-[6px] text-[11px] font-semibold text-white"
            : "inline-flex items-center gap-[5px] rounded-full border border-[#e8e8ec] bg-white px-3 py-[6px] text-[11px] font-semibold text-[#3c3c43]"
        }
      >
        {tpoFilter ? tpoLabel(tpoFilter) : "TPO별"}
        <img src={iconCaretDown} alt="" className="size-3" />
      </button>
      <div className="flex-1" />
      <p className="text-[11px] font-semibold text-[#8e8e93]">{count}개</p>

      {open ? (
        <div className="absolute left-0 top-[36px] z-10 w-[220px] rounded-[16px] border border-[#e8e8ec] bg-white p-2 shadow-[0_8px_24px_rgba(10,10,10,0.12)]">
          {tpoCatalog.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[#8e8e93]">선택할 수 있는 TPO가 없어요.</p>
          ) : (
            tpoCatalog.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChangeTpoFilter(code);
                  setOpen(false);
                }}
                className={
                  code === tpoFilter
                    ? "block w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold text-[#0a0a0a]"
                    : "block w-full rounded-[10px] px-3 py-2 text-left text-[13px] text-[#3c3c43] hover:bg-[#f5f5f7]"
                }
              >
                {tpoLabel(code)}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------- 3.9.1 마이페이지 홈 ---------------------------------- */

export function MypageScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [tab, setTab] = useState<"outfits" | "diagnoses">("outfits");
  const [tpoFilter, setTpoFilter] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [overview, setOverview] = useState<MypageOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  // 필터를 걸면 목록 세 개가 함께 좁혀진다. 그래도 프로필 카드의 "최근 진단"과
  // TPO 시트에 띄울 전체 TPO 목록은 필터 없이 받아온 값을 그대로 붙들고 있는다 —
  // 안 그러면 TPO별로 좁혔을 때 시트 선택지가 줄어들거나 프로필 카드가 흔들린다.
  const [tpoCatalog, setTpoCatalog] = useState<string[]>([]);
  const [latestDiagnosis, setLatestDiagnosis] = useState<MypageDiagnosis | null>(null);

  // 코디 카드 썸네일에 쓸 스타일메이트 사진. 없으면 influencerPhotoStyle이 중립 배경을 준다.
  const [photoByName, setPhotoByName] = useState<Record<string, string | null>>({});

  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getInfluencers(controller.signal)
      .then(({ influencers }) => {
        const map: Record<string, string | null> = {};
        for (const inf of influencers) map[inf.name] = inf.profileImageUrl;
        setPhotoByName(map);
      })
      .catch(() => {
        // 사진 매칭은 부가 기능이라 실패해도 화면을 막지 않는다.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void getMypageOverview(tpoFilter ?? undefined, controller.signal)
      .then((data) => {
        setOverview(data);
        setStatus("success");
        if (!tpoFilter) {
          const codes = Array.from(
            new Set([...data.outfits.map((o) => o.tpoCode), ...data.diagnoses.map((d) => d.tpoCode)]),
          );
          setTpoCatalog(codes);
          const sorted = [...data.diagnoses].sort(
            (a, b) => new Date(b.diagnosedAt).getTime() - new Date(a.diagnosedAt).getTime(),
          );
          setLatestDiagnosis(sorted[0] ?? null);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 마이페이지] 기록 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [tpoFilter, reloadKey]);

  const outfits = overview?.outfits ?? [];
  const diagnoses = overview?.diagnoses ?? [];
  const pending = overview?.pending ?? [];

  const handleLogout = () => {
    void signOut().then(() => navigate("/"));
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onLogout={handleLogout} />
      <div className="flex flex-1 flex-col gap-0 overflow-x-hidden px-5 pb-6 pt-2">
        {status === "loading" && !overview ? (
          <div className="flex flex-col gap-4 py-10">
            <div className="h-[150px] w-full animate-pulse rounded-[20px] bg-[#f5f5f7]" />
            <ThumbnailSkeletonGrid />
          </div>
        ) : status === "error" && !overview ? (
          <div className="py-10">
            <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        ) : overview ? (
          <>
            {/* 프로필 요약 카드 */}
            <div className="flex w-full flex-col rounded-[20px] bg-[#f5f5f7] px-5 pb-5 pt-[22px]">
              <div className="flex w-full items-center gap-[14px]">
                <span className="flex size-[50px] shrink-0 items-center justify-center rounded-full bg-[#ededf0]">
                  <img src={iconAvatar} alt="" className="size-[22px]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                  <p className="truncate text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">
                    {overview.displayName || overview.loginId}
                  </p>
                  <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
                    {latestDiagnosis
                      ? `최근 진단 · ${coachingTypeLabel(latestDiagnosis.coachingType)} · ${latestDiagnosis.tpoLabel}`
                      : "아직 완료된 진단이 없어요."}
                  </p>
                </div>
              </div>
              {latestDiagnosis ? (
                <>
                  <div className="h-3" />
                  <p className="w-full text-[15px] font-medium tracking-[-0.225px] text-[#0a0a0a]">
                    {latestDiagnosis.styleDnaSummary}
                  </p>
                  {latestDiagnosis.styleTags.length > 0 ? (
                    <>
                      <div className="h-3" />
                      <div className="flex w-full flex-wrap gap-[6px]">
                        {latestDiagnosis.styleTags.slice(0, 3).map((tag) => (
                          <Pill key={tag}>#{tag}</Pill>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
              <div className="h-[18px]" />
              <button
                type="button"
                onClick={() => navigate("/user/coaching")}
                className="flex w-full items-center gap-[6px] border-t border-[#e0e0e4] pt-4"
              >
                <span className="text-[13px] font-medium tracking-[-0.195px] text-[#0a0a0a]">
                  새 스타일 진단 시작하기
                </span>
                <div className="flex-1" />
                <img src={iconChevronRight} alt="" className="size-[18px]" />
              </button>
            </div>

            {/* 요약 지표 3개 (TPO 필터와 무관하게 전체 기준) */}
            <div className="flex w-full items-start pt-[22px]">
              <div className="flex flex-1 flex-col items-center gap-[6px]">
                <p className="text-[22px] font-bold tracking-[-0.44px] text-[#0a0a0a]">
                  {overview.summary.outfitCardCount}
                </p>
                <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">받은 코디 카드</p>
              </div>
              <div className="flex flex-1 flex-col items-center gap-[6px]">
                <p className="text-[22px] font-bold tracking-[-0.44px] text-[#0a0a0a]">
                  {overview.summary.diagnosisCount}
                </p>
                <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">진단 횟수</p>
              </div>
              <div className="flex flex-1 flex-col items-center gap-[6px]">
                <p className="text-[22px] font-bold tracking-[-0.44px] text-[#0a0a0a]">
                  {shortDate(overview.summary.lastActivityAt)}
                </p>
                <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">최근 활동</p>
              </div>
            </div>

            {/* 세그먼트: 코디 카드 / 진단 기록 */}
            <div className="mt-[28px] flex w-full gap-6 border-b border-[#e8e8ec]">
              <button
                type="button"
                onClick={() => setTab("outfits")}
                className="flex flex-col items-center gap-3 pb-3"
              >
                <span
                  className={
                    tab === "outfits"
                      ? "text-[17px] font-bold tracking-[-0.34px] text-[#0a0a0a]"
                      : "text-[17px] font-bold tracking-[-0.34px] text-[#8e8e93]"
                  }
                >
                  코디 카드
                </span>
                <span className={`h-[2px] w-[71px] ${tab === "outfits" ? "bg-[#0a0a0a]" : "bg-transparent"}`} />
              </button>
              <button
                type="button"
                onClick={() => setTab("diagnoses")}
                className="flex flex-col items-center gap-3 pb-3"
              >
                <span
                  className={
                    tab === "diagnoses"
                      ? "text-[17px] font-bold tracking-[-0.34px] text-[#0a0a0a]"
                      : "text-[17px] font-bold tracking-[-0.34px] text-[#8e8e93]"
                  }
                >
                  진단 기록
                </span>
                <span className={`h-[2px] w-[71px] ${tab === "diagnoses" ? "bg-[#0a0a0a]" : "bg-transparent"}`} />
              </button>
            </div>

            <div className="h-5" />

            <SortFilterRow
              count={tab === "outfits" ? outfits.length : diagnoses.length}
              tpoCatalog={tpoCatalog}
              tpoFilter={tpoFilter}
              onChangeTpoFilter={(code) => setTpoFilter(code)}
            />

            <div className="h-[18px]" />

            {status === "loading" ? (
              <ThumbnailSkeletonGrid />
            ) : tab === "outfits" ? (
              <>
                {pending.length > 0 ? (
                  <div className="flex w-full flex-col gap-3 pb-[18px]">
                    {pending.map((item) => (
                      <PendingRow
                        key={item.matchResultId}
                        item={item}
                        expanded={expandedPendingId === item.matchResultId}
                        onToggle={() =>
                          setExpandedPendingId((cur) => (cur === item.matchResultId ? null : item.matchResultId))
                        }
                      />
                    ))}
                  </div>
                ) : null}

                {outfits.length === 0 ? (
                  <EmptyState
                    title="아직 받은 코디 카드가 없어요."
                    description="새 요청을 보내면 여기에 기록이 쌓여요."
                    onStart={() => navigate("/user/coaching")}
                  />
                ) : (
                  <div className="grid w-full grid-cols-2 gap-x-[11px] gap-y-[22px]">
                    {outfits.map((outfit) => (
                      <OutfitThumbnail
                        key={outfit.outfitCardId}
                        outfit={outfit}
                        photoUrl={photoByName[outfit.influencerName] ?? null}
                        onOpen={() => navigate(`/user/mypage/outfit/${outfit.matchResultId}`)}
                      />
                    ))}
                  </div>
                )}
                <div className="h-5" />
                <p className="w-full text-[11px] font-semibold text-[#8e8e93]">
                  코디 카드는 받은 그대로 보관돼요. 기록은 나만 볼 수 있어요.
                </p>
              </>
            ) : diagnoses.length === 0 ? (
              <EmptyState
                title="아직 완료된 Style DNA 기록이 없어요."
                description="새 스타일 진단을 시작하면 여기에 기록이 쌓여요."
                onStart={() => navigate("/user/coaching")}
              />
            ) : (
              <div className="flex w-full flex-col">
                {diagnoses.map((diagnosis) => (
                  <DiagnosisRow
                    key={diagnosis.styleDnaResultId}
                    diagnosis={diagnosis}
                    onOpen={
                      diagnosis.matchResultId
                        ? () => navigate(`/user/mypage/diagnosis/${diagnosis.matchResultId}`)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      <BottomTabBar active="records" />
    </section>
  );
}

function PendingRow({
  item,
  expanded,
  onToggle,
}: {
  item: MypagePending;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="w-full rounded-[18px] border-[1.2px] border-dashed border-[#0a0a0a] bg-white p-4">
      <div className="flex w-full items-center gap-[14px]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ededf0]">
          <img src={iconAvatar} alt="" className="size-[22px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <div className="flex flex-wrap items-center gap-[7px]">
            <p className="text-[15px] font-semibold tracking-[-0.3px] text-[#0a0a0a]">
              {item.influencerName ?? "매칭 전"}
            </p>
            <Pill>코디 카드 준비 중</Pill>
          </div>
          <p className="truncate text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
            {coachingTypeLabel(item.coachingType)} · {item.tpoLabel} · {shortDate(item.requestSentAt)} 요청
          </p>
        </div>
        <button type="button" onClick={onToggle} className="shrink-0 text-[11px] font-semibold text-[#0a0a0a]">
          요청 보기
        </button>
      </div>
      {expanded ? (
        <p className="mt-3 whitespace-pre-wrap rounded-[12px] bg-[#f5f5f7] p-3 text-[13px] leading-[1.5] text-[#3c3c43]">
          {item.requestMessage || "작성한 요청 내용이 없어요."}
        </p>
      ) : null}
    </div>
  );
}

function OutfitThumbnail({
  outfit,
  photoUrl,
  onOpen,
}: {
  outfit: {
    outfitCardId: string;
    coachingType: "personal" | "group";
    tpoLabel: string;
    influencerName: string;
    deliveredAt: string | null;
  };
  photoUrl: string | null;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col items-start gap-[10px] text-left">
      <div
        className="relative h-[206px] w-full overflow-hidden rounded-[14px] bg-[#f2f2f5] bg-cover bg-center"
        style={influencerPhotoStyle(photoUrl)}
      >
        {!photoUrl ? (
          <img
            src={iconImagePlaceholder}
            alt=""
            className="absolute left-1/2 top-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2"
          />
        ) : null}
        <span className="absolute left-[10px] top-[10px]">
          <Pill>{outfit.tpoLabel}</Pill>
        </span>
        {outfit.coachingType === "group" ? (
          <span className="absolute left-[10px] top-[42px]">
            <Pill tone="dark">그룹</Pill>
          </span>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-1">
        <p className="w-full truncate text-[13px] font-bold tracking-[-0.195px] text-[#0a0a0a]">
          {outfit.influencerName}
        </p>
        <p className="w-full truncate text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
          {shortDate(outfit.deliveredAt)} · 코디 카드 도착
        </p>
      </div>
    </button>
  );
}

function DiagnosisRow({ diagnosis, onOpen }: { diagnosis: MypageDiagnosis; onOpen?: () => void }) {
  const Wrapper = onOpen ? "button" : "div";
  return (
    <Wrapper
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      className="flex w-full items-start justify-between gap-3 border-b border-[#e8e8ec] py-4 text-left"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
          {shortDate(diagnosis.diagnosedAt)} · {coachingTypeLabel(diagnosis.coachingType)} · {diagnosis.tpoLabel}
        </p>
        <p className="w-full text-[14px] font-medium tracking-[-0.21px] text-[#0a0a0a]">
          {diagnosis.styleDnaSummary}
        </p>
      </div>
      <p className="shrink-0 pt-[2px] text-[12px] font-semibold text-[#8e8e93]">
        {diagnosis.selectedInfluencerName ?? "매칭 전"}
      </p>
    </Wrapper>
  );
}

/* ---------------------------------- 3.9.2 코디 카드 기록 상세 ---------------------------------- */

export function MypageOutfitDetailScreen() {
  const navigate = useNavigate();
  const { matchResultId } = useParams<{ matchResultId: string }>();
  const cardRef = useRef<HTMLDivElement>(null);

  const [card, setCard] = useState<OutfitCardView | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultView | null>(null);
  const [account, setAccount] = useState<{ displayName: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<"dna" | "request" | null>(null);

  useEffect(() => {
    if (!matchResultId) return;
    const controller = new AbortController();
    setStatus("loading");
    Promise.all([
      getOutfitCard(matchResultId, controller.signal),
      getDiagnosisResult(matchResultId, controller.signal).catch(() => null),
      getMyAccount(controller.signal).catch(() => null),
    ])
      .then(([outfitResult, diagnosisResult, accountResult]) => {
        if (!outfitResult.card) {
          setStatus("error");
          return;
        }
        setCard(outfitResult.card);
        setDiagnosis(diagnosisResult);
        setAccount(accountResult);
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 마이페이지] 코디 카드 상세 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [matchResultId]);

  const download = async () => {
    if (!cardRef.current) return;
    // KPI: 이미지 저장 시도 (MEMO/KPI_측정_계획.md). U7과 같은 이벤트를 화면 이름으로 구분한다.
    trackEvent("outfit_image_save", "mypage_outfit");
    setSaving(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = "Fitto-outfit-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setSaving(false);
    }
  };

  const itemsByMember = useMemo(() => {
    if (!card) return [] as Array<{ label: string; items: OutfitCardItemView[] }>;
    const groups = new Map<string, OutfitCardItemView[]>();
    for (const item of card.items) {
      const list = groups.get(item.memberLabel) ?? [];
      list.push(item);
      groups.set(item.memberLabel, list);
    }
    return Array.from(groups.entries()).map(([memberLabel, items]) => ({
      label: memberLabel === "A" ? "구성원 A" : memberLabel === "B" ? "구성원 B" : "",
      items,
    }));
  }, [card]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/mypage")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[10px]">
        {status === "loading" ? (
          <div className="flex flex-col gap-4 py-10">
            <div className="h-6 w-2/3 animate-pulse rounded bg-[#f2f2f5]" />
            <div className="h-[420px] w-full animate-pulse rounded-[22px] bg-[#f5f5f7]" />
          </div>
        ) : status === "error" || !card ? (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-[13px] text-[#8e8e93]">코디 카드 정보를 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => navigate("/user/mypage")}
              className="rounded-full border border-[#e8e8ec] bg-white px-5 py-[10px] text-[13px] font-semibold text-[#3c3c43]"
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          <>
            <p className="text-[24px] font-bold tracking-[-0.6px] text-[#0a0a0a]">{card.tpoLabel} 코디</p>
            <div className="h-[10px]" />
            <p className="text-[15px] font-medium tracking-[-0.225px] text-[#8e8e93]">
              {longDate(card.deliveredAt)} · {card.influencerName}
            </p>
            <div className="h-[26px]" />

            <div ref={cardRef} className="w-full rounded-[22px] bg-[#f5f5f7] px-5 pb-5 pt-[22px]">
              <div className="flex w-full flex-wrap gap-[6px]">
                <Pill>{card.coachingType === "group" ? "그룹 스타일링" : "개인 스타일링"}</Pill>
                <Pill>{card.tpoLabel}</Pill>
                <Pill>{card.budgetLabel}</Pill>
              </div>
              <div className="h-5" />
              <p className="text-[13px] font-medium tracking-[-0.195px] text-[#8e8e93]">추천 코디</p>
              <div className="h-[10px]" />

              <div className="flex w-full flex-col gap-[10px]">
                {itemsByMember.map((group) => (
                  <div key={group.label || "self"} className="flex flex-col gap-[10px]">
                    {group.label ? (
                      <p className="text-[12px] font-bold text-[#0a0a0a]">{group.label}</p>
                    ) : null}
                    {group.items.map((item, index) => (
                      <div
                        key={`${item.itemType}-${index}`}
                        className="flex w-full items-center gap-[14px] rounded-[16px] bg-white p-[14px]"
                      >
                        <span className="relative flex h-[76px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-[#f2f2f5]">
                          <img src={iconItemPlaceholder} alt="" className="size-[22px]" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                          <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
                            {item.itemType === "top" ? "상의" : "하의"}
                          </p>
                          <p className="w-full text-[15px] font-medium tracking-[-0.225px] text-[#0a0a0a]">
                            {item.name}
                          </p>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full truncate text-[11px] font-semibold tracking-[-0.055px] text-[#3c3c43] underline decoration-[#e8e8ec] underline-offset-2"
                          >
                            {item.url}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="h-[22px]" />
              <p className="text-[13px] font-medium tracking-[-0.195px] text-[#8e8e93]">
                {account?.displayName ?? "회원"}님께 전하는 말
              </p>
              <div className="h-[10px]" />
              <div className="w-full rounded-[16px] bg-white p-4">
                <p className="whitespace-pre-wrap text-[15px] font-medium leading-[1.52] tracking-[-0.225px] text-[#0a0a0a]">
                  {card.message}
                </p>
              </div>
              <div className="h-[18px]" />
              <div className="flex w-full items-center gap-2">
                <p className="text-[11px] font-semibold tracking-[-0.055px] text-[#8e8e93]">
                  by {card.influencerName}
                </p>
                <div className="flex-1" />
                <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">Fitto</p>
              </div>
            </div>

            <div className="h-[26px]" />

            {/* 함께 보관되는 맥락 (아코디언, 기본 접힘) */}
            <div className="flex w-full flex-col">
              <button
                type="button"
                onClick={() => setOpenSection((s) => (s === "dna" ? null : "dna"))}
                className="flex w-full items-center gap-[10px] border-t border-[#e8e8ec] py-[18px]"
              >
                <span className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">그때의 Style DNA</span>
                <div className="flex-1" />
                <img
                  src={iconChevronDown}
                  alt=""
                  className={`size-5 transition-transform ${openSection === "dna" ? "rotate-180" : ""}`}
                />
              </button>
              {openSection === "dna" ? (
                <p className="pb-4 text-[13px] leading-[1.5] text-[#3c3c43]">
                  {diagnosis?.styleDnaSummary ?? "그때의 Style DNA 기록을 찾지 못했어요."}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setOpenSection((s) => (s === "request" ? null : "request"))}
                className="flex w-full items-center gap-[10px] border-t border-[#e8e8ec] py-[18px]"
              >
                <span className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">
                  그때 보낸 부탁해요 카드
                </span>
                <div className="flex-1" />
                <img
                  src={iconChevronDown}
                  alt=""
                  className={`size-5 transition-transform ${openSection === "request" ? "rotate-180" : ""}`}
                />
              </button>
              {openSection === "request" ? (
                <p className="whitespace-pre-wrap border-b border-[#e8e8ec] pb-4 text-[13px] leading-[1.5] text-[#3c3c43]">
                  {diagnosis?.requestCard?.messageText ?? "보낸 요청 내용을 찾지 못했어요."}
                </p>
              ) : null}
            </div>

            <div className="h-5" />
            <p className="w-full text-[11px] font-semibold text-[#8e8e93]">
              코디 카드는 전달 후 수정되지 않아요. 받은 그대로 보관돼요.
            </p>
            <div className="h-6" />

            <div className="flex w-full gap-[10px]">
              <button
                type="button"
                disabled={saving}
                onClick={download}
                className="flex min-h-[56px] flex-1 items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white disabled:opacity-60"
              >
                {saving ? "이미지 만드는 중…" : "이미지 저장"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={download}
                className="flex min-h-[56px] flex-1 items-center justify-center rounded-[14px] border border-[#e8e8ec] bg-white text-[15px] font-bold text-[#3c3c43] disabled:opacity-60"
              >
                다운로드
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- A7 · 마이페이지 진단 기록 상세 ----------------------------------
 * 피그마 `12 · v3 · 추가 화면`(A7)을 그대로 옮겼다. 날짜·해시태그는 `DiagnosisResultView`에 없어서
 * 마이페이지 개요(getMypageOverview)에서 같은 matchResultId 행을 찾아 함께 쓴다 — 값을 지어내지 않는다.
 */
function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="w-full border-t border-[#e8e8ec]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-[10px] py-[18px]">
        <span className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">{title}</span>
        <div className="flex-1" />
        <img src={iconChevronDown} alt="" className={`size-[22px] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

export function MypageDiagnosisDetailScreen() {
  const navigate = useNavigate();
  const { matchResultId } = useParams<{ matchResultId: string }>();
  const [diagnosis, setDiagnosis] = useState<DiagnosisResultView | null>(null);
  const [summaryRow, setSummaryRow] = useState<MypageDiagnosis | null>(null);
  const [hasOutfitCard, setHasOutfitCard] = useState(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [showAllScores, setShowAllScores] = useState(false);
  const [openSection, setOpenSection] = useState<"body" | "taste" | "budget" | null>(null);

  useEffect(() => {
    if (!matchResultId) return;
    const controller = new AbortController();
    setStatus("loading");
    Promise.all([
      getDiagnosisResult(matchResultId, controller.signal),
      getMypageOverview(undefined, controller.signal).catch(() => null),
      getOutfitCard(matchResultId, controller.signal).catch(() => null),
    ])
      .then(([result, overview, outfitResult]) => {
        setDiagnosis(result);
        setSummaryRow(overview?.diagnoses.find((d) => d.matchResultId === matchResultId) ?? null);
        setHasOutfitCard(Boolean(outfitResult?.card));
        setStatus("success");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.log("[BiasFit 마이페이지] 진단 기록 상세 조회 실패", error);
        setStatus("error");
      });
    return () => controller.abort();
  }, [matchResultId]);

  const member = diagnosis?.members[0];
  const sortedScores = member ? [...member.styleScores].sort((a, b) => b.score - a.score) : [];
  const visibleScores = showAllScores ? sortedScores : sortedScores.slice(0, 2);
  const priorityCode = (diagnosis?.priority as MatchPriority | undefined) ?? undefined;
  const priorityTitle = priorityCode ? PRIORITY_CATEGORY_TITLE[priorityCode] : null;
  const priorityDescription = diagnosis?.matchingPoints[0]?.text;

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-white">
      <TopBar onBack={() => navigate("/user/mypage")} />
      <div className="flex flex-1 flex-col px-5 pb-6 pt-[14px]">
        {status === "loading" ? (
          <div className="h-[320px] w-full animate-pulse rounded-[22px] bg-[#f5f5f7]" />
        ) : status === "error" || !diagnosis || !member ? (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-[13px] text-[#8e8e93]">진단 기록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => navigate("/user/mypage")}
              className="rounded-full border border-[#e8e8ec] bg-white px-5 py-[10px] text-[13px] font-semibold text-[#3c3c43]"
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          <>
            <div className="flex w-full flex-wrap gap-[6px]">
              <Pill>{coachingTypeLabel(diagnosis.coachingType)}</Pill>
              <Pill>{diagnosis.tpoLabel}</Pill>
            </div>
            <div className="h-[18px]" />
            <p className="w-full text-[24px] font-bold leading-[1.34] tracking-[-0.6px] text-[#0a0a0a]">
              {diagnosis.styleDnaSummary}
            </p>
            <div className="h-3" />
            <p className="text-[15px] font-medium tracking-[-0.225px] text-[#8e8e93]">
              {summaryRow ? `${longDate(summaryRow.diagnosedAt)} · ` : ""}
              {diagnosis.selectedInfluencerName ? `${diagnosis.selectedInfluencerName} 매칭` : "매칭 전"}
            </p>
            {summaryRow && summaryRow.styleTags.length > 0 ? (
              <>
                <div className="h-[14px]" />
                <div className="flex flex-wrap gap-[6px]">
                  {summaryRow.styleTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-[#e8e8ec] bg-white px-3 py-[6px] text-[11px] font-semibold tracking-[-0.055px] text-[#3c3c43]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <div className="h-9" />
            <div className="flex w-full items-center justify-between">
              <p className="text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">추구하는 스타일</p>
              {sortedScores.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setShowAllScores((v) => !v)}
                  className="text-[12px] text-[#8e8e93]"
                >
                  {showAllScores ? "간단히 보기" : "전체 보기"}
                </button>
              ) : null}
            </div>
            <div className="h-4" />
            <div className="flex flex-col gap-[18px]">
              {visibleScores.map((score) => (
                <div key={score.style} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-medium tracking-[-0.225px] text-[#3c3c43]">{score.style}</p>
                    <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">{score.score}</p>
                  </div>
                  <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#e8e8ec]">
                    <div className="h-[6px] rounded-full bg-[#0a0a0a]" style={{ width: `${score.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {priorityTitle ? (
              <>
                <div className="h-[30px]" />
                <p className="w-full text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">이때 선택한 우선순위</p>
                <div className="h-3" />
                <div className="w-full rounded-[18px] bg-[#f5f5f7] px-5 py-[18px]">
                  <p className="text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">{priorityTitle}</p>
                  {priorityDescription ? (
                    <>
                      <div className="h-2" />
                      <p className="text-[12px] leading-[1.5] text-[#3c3c43]">{priorityDescription}</p>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="h-[26px]" />
            <div className="flex w-full flex-col">
              <AccordionSection
                title="체형과 핏"
                open={openSection === "body"}
                onToggle={() => setOpenSection((s) => (s === "body" ? null : "body"))}
              >
                <p className="text-[13px] leading-[1.5] text-[#3c3c43]">
                  체형 {member.bodyType} · 핏 고민 {member.fitConcerns.join(" / ") || "특별히 없음"}
                </p>
              </AccordionSection>
              <AccordionSection
                title="취향"
                open={openSection === "taste"}
                onToggle={() => setOpenSection((s) => (s === "taste" ? null : "taste"))}
              >
                <p className="text-[13px] leading-[1.5] text-[#3c3c43]">
                  선호 {member.preferredStyle} · 비선호 {member.avoidedStyle}
                  {member.keywords.length > 0 ? ` · ${member.keywords.join(", ")}` : ""}
                </p>
              </AccordionSection>
              <AccordionSection
                title="예산과 상황"
                open={openSection === "budget"}
                onToggle={() => setOpenSection((s) => (s === "budget" ? null : "budget"))}
              >
                <p className="text-[13px] leading-[1.5] text-[#3c3c43]">
                  {member.budgetLabel} · {member.budgetApproach} · {diagnosis.tpoLabel}
                </p>
              </AccordionSection>
            </div>

            {hasOutfitCard ? (
              <>
                <div className="h-[26px]" />
                <p className="w-full text-[19px] font-bold tracking-[-0.38px] text-[#0a0a0a]">이 진단으로 받은 코디 카드</p>
                <div className="h-[14px]" />
                <button
                  type="button"
                  onClick={() => navigate(`/user/mypage/outfit/${matchResultId}`)}
                  className="flex w-full items-center gap-[14px] rounded-[18px] bg-[#f5f5f7] p-4"
                >
                  <span className="flex h-[70px] w-14 shrink-0 items-center justify-center rounded-[12px] bg-[#f2f2f5]">
                    <img src={iconItemPlaceholder} alt="" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[16px] font-semibold tracking-[-0.32px] text-[#0a0a0a]">
                      {diagnosis.tpoLabel} 코디
                    </p>
                    <p className="mt-[6px] truncate text-[11px] font-semibold text-[#8e8e93]">
                      {diagnosis.selectedInfluencerName ?? "매칭 전"} · 도착
                    </p>
                  </div>
                  <img src={iconChevronRight} alt="" className="size-5 shrink-0" />
                </button>
              </>
            ) : null}

            <div className="h-5" />
            <p className="w-full text-[12px] text-[#8e8e93]">
              진단 기록은 읽기 전용이에요. 이 진단으로 다시 요청할 수는 없어요.
            </p>
          </>
        )}
      </div>
      {status === "success" && diagnosis ? (
        <div className="px-5 pb-[26px] pt-[10px]">
          <button
            type="button"
            onClick={() => navigate("/user/coaching")}
            className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] bg-[#0a0a0a] text-[17px] font-bold text-white"
          >
            이 기준으로 새 진단 시작하기
          </button>
        </div>
      ) : null}
    </section>
  );
}
