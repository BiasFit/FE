import { describe, expect, it } from "vitest";
import {
  CODED_OPTION_GROUPS,
  optionSeedRows,
  optionSeedSql,
} from "./optionsSeed.js";
import {
  TPO_CODES,
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
 * DB의 `diagnosis_options`와 앱의 어휘가 어긋나면 오류 없이 매칭 점수만 0점이 된다.
 * 이 프로젝트에서 두 번 난 사고다. 여기서 시드 정의가 options.ts를 벗어나지 못하게 막는다.
 *
 * DB가 실제로 낡았는지(= 시드를 다시 안 돌렸는지)는 파일로 알 수 없다.
 * 그쪽은 저장할 때 코드를 못 찾으면 오류를 내는 것으로 막는다.
 */
function codesFor(group: string) {
  return optionSeedRows()
    .filter((row) => row.optionGroup === group)
    .map((row) => row.code);
}

describe("diagnosis_options 시드", () => {
  it("모든 선택지 그룹의 코드가 options.ts와 같다", () => {
    expect(codesFor("body_type")).toEqual(bodyTypes.map((item) => item.name));
    expect(codesFor("style_type")).toEqual(styleOptions.map((item) => item.name));
    expect(codesFor("fit_concern")).toEqual(fitConcerns);
    expect(codesFor("keyword")).toEqual(keywords);
    expect(codesFor("design_element")).toEqual(designElements);
    expect(codesFor("preferred_item")).toEqual(preferredItems);
    expect(codesFor("avoid_element")).toEqual(avoidedElements);
    expect(codesFor("budget_range")).toEqual(budgets.map((item) => String(item.code)));
    expect(codesFor("budget_strategy")).toEqual([...budgetApproaches]);
    expect(codesFor("tpo")).toEqual(TPO_CODES);
  });

  it("TPO는 내부 코드로 저장한다. 한글 라벨이 code에 들어가면 안 된다", () => {
    // `개강·새학기` 같은 라벨이 code에 섞이면 TPO 적합도가 항상 0점이 된다.
    for (const code of codesFor("tpo")) {
      expect(code).toMatch(/^[a-z_]+$/);
    }
  });

  it("코드와 라벨이 다른 그룹은 tpo와 budget_range 둘뿐이다", () => {
    // 이 두 그룹만 화면 표시 시 라벨 변환이 필요하다.
    // 다른 그룹에 변환이 생기면 어긋날 틈도 함께 생긴다.
    const needsLabelLookup = [...new Set(
      optionSeedRows()
        .filter((row) => row.code !== row.label)
        .map((row) => row.optionGroup),
    )].sort();

    expect(needsLabelLookup).toEqual([...CODED_OPTION_GROUPS].sort());
  });

  it("그룹이 달라도 같은 code를 두 번 쓰지 않는다", () => {
    const owner = new Map<string, string>();
    const collisions: string[] = [];
    for (const row of optionSeedRows()) {
      const previous = owner.get(row.code);
      if (previous && previous !== row.optionGroup) {
        collisions.push(`${row.code}: ${previous} vs ${row.optionGroup}`);
      }
      owner.set(row.code, row.optionGroup);
    }

    expect(collisions).toEqual([]);
  });

  it("빈 code나 빈 label이 없다", () => {
    for (const row of optionSeedRows()) {
      expect(row.code.trim()).not.toBe("");
      expect(row.label.trim()).not.toBe("");
    }
  });

  it("생성한 SQL이 실행 가능한 형태다", () => {
    const sql = optionSeedSql();

    expect(sql).toContain("insert into public.diagnosis_options");
    expect(sql).toContain("on conflict (option_group, code) do update");
    // 작은따옴표가 든 값이 SQL을 깨지 않는지
    expect(optionSeedSql([
      { optionGroup: "test", code: "it's", label: "it's" },
    ])).toContain("('test', 'it''s', 'it''s', null, 1)");
  });
});
