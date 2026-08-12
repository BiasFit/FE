/**
 * `diagnosis_options` 시드 SQL을 stdout으로 뱉는다.
 *
 *   cd FE && npx vite-node scripts/generateOptionsSeed.ts > schema/03_options_seed.sql
 *
 * 실제 내용은 `src/data/optionsSeed.ts`에 있다. 여기는 출력만 맡는다.
 * `dev/localApiPlugin.ts`와 마찬가지로 tsconfig 범위 밖이라 브라우저 번들에 들어가지 않는다.
 */
import { optionSeedRows, optionSeedSql } from "../src/data/optionsSeed";

declare const process: {
  stdout: { write(text: string): unknown };
};

const rows = optionSeedRows();
process.stdout.write(optionSeedSql(rows));

const byGroup = new Map<string, number>();
for (const row of rows) byGroup.set(row.optionGroup, (byGroup.get(row.optionGroup) ?? 0) + 1);
console.error(`행 ${rows.length}개`);
console.error([...byGroup].map(([group, count]) => `${group}=${count}`).join(", "));
