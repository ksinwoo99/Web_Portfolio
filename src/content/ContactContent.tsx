import { useState } from "react";

// 메일 주소는 스팸 수집기가 긁어가지 못하게(사용자 요청, 2026-10-26) 조각으로 나눠 두고,
// "메일 주소 보기"를 눌렀을 때만 이어 붙여 보여준다 — 페이지 소스·스크립트 어디에도 주소가 통째로 남지 않는다.
const MAIL_PARTS = ["ksinwoo", "2520", "gmail", "com"];
const joinMail = () => `${MAIL_PARTS[0]}${MAIL_PARTS[1]}${String.fromCharCode(64)}${MAIL_PARTS[2]}.${MAIL_PARTS[3]}`;

export default function ContactContent() {
  const [mail, setMail] = useState<string | null>(null);

  return (
    <>
      <ul>
        <li>
          메일 —{" "}
          {mail ? (
            <a href={`mailto:${mail}`}>{mail}</a>
          ) : (
            <button className="reveal-mail" onClick={() => setMail(joinMail())}>메일 주소 보기</button>
          )}
        </li>
        <li>
          GitHub — <a href="https://github.com/ksinwoo99" target="_blank" rel="noopener">github.com/ksinwoo99</a>
        </li>
      </ul>
    </>
  );
}
