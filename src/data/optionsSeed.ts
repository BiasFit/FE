import {
  TPO_OPTIONS,
  avoidedElements,
  bodyTypes,
  budgetApproaches,
  budgets,
  designElements,
  fitConcerns,
  keywords,
  preferredItems,
  styleOptions,
} from "./options.js";

/**
 * Supabase `diagnosis_options` 테이블에 넣을 선택지 행이다.
 *
 * DB의 어휘가 이 파일과 어긋나면 오류 없이 매칭 점수만 0점이 된다.
 * 이 프로젝트에서 두 번 난 사고다 (TPO `개강 행사` vs `개강·새학기`,
 * 예산 `총액 절약형` vs `가성비 중심`).
 *
 * 그래서 시드를 손으로 쓰지 않고 `options.ts`에서 만든다.
 * SQL 파일 재생성:
 *   cd FE && npx vite-node scripts/generateOptionsSeed.ts > schema/03_options_seed.sql
 */
export interface OptionSeedRow {
  optionGroup: string;
  code: string;
  label: string;
  description?: string;
}

/**
 * **내부 코드와 한글 라벨이 다른 그룹은 이 셋뿐이다.** 화면에 보여줄 때만 라벨로 바꾼다.
 *
 * | 그룹 | 코드 예 | 라벨 예 | 변환 함수 |
 * |---|---|---|---|
 * | `tpo` | `travel` | 여행 | `tpoLabel()` |
 * | `budget_range` | `2` | 3~6만 원 | `budgetRangeLabel()` |
 * | `relationship` | `friend` | 친구 | 화면에서 직접 |
 *
 * 나머지 그룹은 앱이 쓰는 한글 문자열이 곧 코드다. 일부러 그렇게 뒀다.
 * 영문 슬러그를 새로 만들면 변환 지점이 생기고, 두 번의 0점 사고가 정확히 그 틈에서 났다.
 */
export const CODED_OPTION_GROUPS = ["tpo", "budget_range", "relationship"] as const;

export function optionSeedRows(): OptionSeedRow[] {
  return [
    ...bodyTypes.map((item) => ({
      optionGroup: "body_type",
      code: item.name,
      label: item.name,
      description: item.description,
    })),
    ...styleOptions.map((item) => ({
      optionGroup: "style_type",
      code: item.name,
      label: item.name,
      description: item.description,
    })),
    ...fitConcerns.map((item) => ({ optionGroup: "fit_concern", code: item, label: item })),
    ...keywords.map((item) => ({ optionGroup: "keyword", code: item, label: item })),
    ...designElements.map((item) => ({ optionGroup: "design_element", code: item, label: item })),
    ...preferredItems.map((item) => ({ optionGroup: "preferred_item", code: item, label: item })),
    ...avoidedElements.map((item) => ({ optionGroup: "avoid_element", code: item, label: item })),
    // 예산은 숫자 코드가 따로 있다. 라벨(`3~6만 원`)을 코드로 쓰지 않는다.
    ...budgets.map((item) => ({
      optionGroup: "budget_range",
      code: String(item.code),
      label: item.label,
    })),
    ...budgetApproaches.map((item) => ({ optionGroup: "budget_strategy", code: item, label: item })),
    // TPO는 내부 코드로만 비교한다. 화면 표시는 tpoLabel()을 거친다.
    ...TPO_OPTIONS.map((item) => ({ optionGroup: "tpo", code: item.code, label: item.label })),
    // 그룹 관계는 appState의 group.relationship 값을 따른다.
    { optionGroup: "relationship", code: "friend", label: "친구" },
    { optionGroup: "relationship", code: "family", label: "가족" },
    { optionGroup: "relationship", code: "other", label: "기타" },
  ];
}

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function optionSeedSql(rows = optionSeedRows()) {
  const orderByGroup = new Map<string, number>();
  const values = rows.map((row) => {
    const sortOrder = (orderByGroup.get(row.optionGroup) ?? 0) + 1;
    orderByGroup.set(row.optionGroup, sortOrder);
    return `  (${quote(row.optionGroup)}, ${quote(row.code)}, ${quote(row.label)}, ${
      row.description ? quote(row.description) : "null"
    }, ${sortOrder})`;
  });

  return `-- 03. diagnosis_options 시드
--
-- 생성물이다. 이 파일을 직접 고치지 마라.
-- 출처: FE/src/data/optionsSeed.ts (그 안의 값은 FE/src/data/options.ts에서 온다)
-- 재생성: cd FE && npx vite-node scripts/generateOptionsSeed.ts > schema/03_options_seed.sql
--
-- 이 시드와 options.ts가 어긋나면 오류 없이 매칭 점수만 0점이 된다.
-- 총 ${rows.length}행

insert into public.diagnosis_options (option_group, code, label, description, sort_order)
values
${values.join(",\n")}
on conflict (option_group, code) do update
  set label       = excluded.label,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_active   = true;
`;
}
