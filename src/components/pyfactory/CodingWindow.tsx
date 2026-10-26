import { useEffect, useRef, type KeyboardEvent } from "react";
import { MACHINE_INFO, usePyfStore } from "../../game/pyfactory/store";

const INDENT = "    ";

/*
 * 원본의 코딩 창 + 설치물 정보 패널을 하나로 줄인 것. 게임창 위에 떠 있고 게임은 계속 돌아간다
 * (모달이 아니다 — 코드를 실행하고 기계가 움직이는 걸 바로 보게 하려는 것).
 */
export default function CodingWindow() {
  const id = usePyfStore((s) => s.codingOpen);
  const machine = usePyfStore((s) => (s.codingOpen ? s.machines[s.codingOpen] : null));
  const result = usePyfStore((s) => s.result);
  const { setCode, run, closeCoding } = usePyfStore.getState();
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, [id]);

  if (!id || !machine) return null;
  const info = MACHINE_INFO[id];

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // F5는 브라우저 새로고침이므로 반드시 막는다. Ctrl+Enter도 실행으로 받는다.
    if (e.key === "F5" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      run(id!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCoding();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: a, selectionEnd: b, value } = ta;
      setCode(id!, value.slice(0, a) + INDENT + value.slice(b));
      requestAnimationFrame(() => ta.setSelectionRange(a + INDENT.length, a + INDENT.length));
    }
  }

  return (
    <div className="coding-window" role="dialog" aria-label={`${info.title} 코딩 창`}>
      <div className="cw-head">
        <b>코딩 창 · {machine.name ?? info.title}</b>
        <button className="cw-close" onClick={closeCoding} aria-label="코딩 창 닫기">✕</button>
      </div>
      <p className="cw-info">
        필요 문법 <code>{info.syntax}</code>
        <span>{info.desc}</span>
      </p>
      <textarea
        ref={textRef}
        className="cw-code"
        value={machine.code}
        onChange={(e) => setCode(id, e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={`# 여기에 코드를 입력하세요\n${info.syntax}`}
        aria-label="코드 입력"
      />
      <div className="cw-actions">
        <button className="cw-run" onClick={() => run(id)}>▶ 실행 (F5)</button>
        <button className="cw-preset" onClick={() => setCode(id, info.preset)}>예시 넣기</button>
      </div>
      {result && (
        <p className={result.ok ? "cw-result ok" : "cw-result err"} role="status">{result.text}</p>
      )}
    </div>
  );
}
