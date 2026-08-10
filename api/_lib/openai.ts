import type { JsonSchema } from "../../src/domain/aiContracts";

declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;

export interface StructuredOpenAiRequest {
  schemaName: string;
  schema: JsonSchema;
  systemPrompt: string;
  input: unknown;
}

export type StructuredOpenAiCaller = (
  request: StructuredOpenAiRequest,
) => Promise<unknown>;

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
        { role: "system", content: systemPrompt },
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
