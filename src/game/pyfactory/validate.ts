import type { MachineId } from "./store";

/*
 * 원본처럼 진짜 파이썬을 실행하지 않고 정해진 문법 패턴만 찾는다
 * (logic_Miner_Master.ValidateCode, logic_Productor_Master, GameCodeValidator 참고).
 * 간소화판이라 반복문·조건문은 막고, 가공기는 A상품 한 가지만 허용한다.
 */

export type ValidateResult = { ok: true; name: string | null } | { ok: false; message: string };

const fail = (message: string): ValidateResult => ({ ok: false, message });

/** # 주석을 지운다(문자열 안의 #은 그대로). */
function stripComments(code: string) {
  return code
    .split("\n")
    .map((line) => {
      let out = "", quote: string | null = null;
      for (const ch of line) {
        if (!quote && ch === "#") break;
        if (ch === "'" || ch === '"') quote = quote === null ? ch : quote === ch ? null : quote;
        out += ch;
      }
      return out;
    })
    .join("\n");
}

function syntaxError(code: string): string | null {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let depth = 0, quote: string | null = null;
    for (const ch of lines[i]) {
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth < 0) break;
    }
    if (quote) return `문법 오류 (${i + 1}번째 줄): 따옴표가 닫히지 않았어요.`;
    if (depth !== 0) return `문법 오류 (${i + 1}번째 줄): 괄호 짝이 맞지 않아요.`;
  }
  return null;
}

export function validateCode(id: MachineId, code: string): ValidateResult {
  const src = stripComments(code);
  const clean = src.replace(/\s+/g, "").toLowerCase();
  if (!clean) return fail(id === "miner" ? "코드가 비어 있어요. mining(Common)을 적어 보세요." : "코드가 비어 있어요. producting(Common, 'A')를 적어 보세요.");

  const syn = syntaxError(src);
  if (syn) return fail(syn);
  if (/^\s*(for|while)\b/m.test(src)) return fail("반복문은 아직 잠겨 있어요. 실제 게임에서는 퀘스트를 진행하면 해금됩니다.");
  if (/^\s*(if|elif|else)\b/m.test(src)) return fail("이 체험판에서는 조건문 없이 명령 한 줄만 씁니다.");

  if (id === "miner") {
    if (clean.includes("producting(")) return fail("producting은 가공기 전용 명령이에요.");
    const calls = [...clean.matchAll(/mining\(([^)]*)\)/g)];
    if (!calls.length) return fail("필요 문법이 없어요: mining(Common)");
    if (calls.some((c) => c[1] !== "common")) return fail("이 채굴기는 mining(Common)만 실행할 수 있어요.");
  } else {
    if (clean.includes("mining(")) return fail("mining은 채굴기 전용 명령이에요.");
    const calls = [...clean.matchAll(/producting\(([^,)]*)(?:,['"]?([^'")]*)['"]?)?\)/g)];
    if (!calls.length) return fail("필요 문법이 없어요: producting(Common, 'A')");
    if (calls.some((c) => c[1] !== "common")) return fail("이 가공기는 Common 자원만 가공할 수 있어요.");
    if (calls.some((c) => c[2] !== "a")) return fail("이 체험판의 가공기는 A상품만 만들 수 있어요: producting(Common, 'A')");
  }

  const name = code.match(/name\s*=\s*(['"])(.*?)\1/)?.[2].trim().slice(0, 12) || null;
  return { ok: true, name };
}
