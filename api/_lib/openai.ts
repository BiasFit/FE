import type { JsonSchema } from "../../src/domain/aiContracts";

declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

export interface StructuredOpenAiRequest {
  schemaName: string;
  schema: JsonSchema;
  systemPrompt: string;
  input: unknown;
  /** 직전 응답이 거절된 이유. 재시도할 때만 채워 모델이 같은 실수를 반복하지 않게 한다. */
  repairNote?: string;
}

export type StructuredOpenAiCaller = (
  request: StructuredOpenAiRequest,
) => Promise<unknown>;

/**
 * 검증에 실패하면 거절 사유를 프롬프트에 실어 다시 호출한다.
 * 같은 프롬프트를 그대로 반복하면 모델이 같은 실수를 되풀이하기 때문이다.
 */
export async function generateWithRepair<T>(
  generate: StructuredOpenAiCaller,
  request: StructuredOpenAiRequest,
  validate: (result: unknown) => T,
  options: { label: string; attempts?: number },
): Promise<T> {
  const attempts = options.attempts ?? 3;
  let repairNote: string | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return validate(await generate({ ...request, repairNote }));
    } catch (error) {
      lastError = error;
      repairNote = error instanceof Error ? error.message : String(error);
      console.log(
        `[BiasFit ${options.label}] attempt ${attempt}/${attempts} rejected: ${repairNote}`,
      );
    }
  }
  throw lastError;
}

function requiredEnvironment(name: "OPENAI_API_KEY" | "OPENAI_MODEL") {
  const value =
    typeof process === "undefined" ? undefined : process.env?.[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return value;
}

function extractOutputText(response: unknown) {
  if (typeof response !== "object" || response === null) {
    throw new Error("OpenAI 응답 형식이 올바르지 않습니다.");
  }
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    throw new Error("OpenAI 응답에 output이 없습니다.");
  }
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "output_text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  throw new Error("OpenAI가 구조화된 텍스트를 반환하지 않았습니다.");
}

export const callOpenAiStructured: StructuredOpenAiCaller = async ({
  schemaName,
  schema,
  systemPrompt,
  input,
  repairNote,
}) => {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: requiredEnvironment("OPENAI_MODEL"),
      store: false,
      input: [
        {
          role: "system",
          content: repairNote
            ? `${systemPrompt}\n\n직전 응답은 다음 이유로 거절됐다: ${repairNote}\n지적된 부분만 고쳐 규칙을 지키는 응답을 다시 작성하라.`
            : systemPrompt,
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 요청 실패 (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = (await response.json()) as unknown;
  const text = extractOutputText(payload);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("OpenAI 구조화 응답을 JSON으로 해석하지 못했습니다.");
  }
};
