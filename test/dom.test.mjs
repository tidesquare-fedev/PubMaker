// index.html 을 jsdom 에 올려 실제 UI 배선을 검증한다.
// 실행: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { check, section, summary } from "./_harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const errors = [];

const dom = new JSDOM(read("index.html"), {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const { window } = dom;
const { document } = window;

// jsdom 미구현 API 보강
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 은 레이아웃을 계산하지 않는다. 미리보기 좌표 로직이 동작하도록 크기를 흉내낸다.
const FAKE_W = 600;
const FAKE_H = 2000;
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    left: 0,
    top: 0,
    right: FAKE_W,
    bottom: FAKE_H,
    width: FAKE_W,
    height: FAKE_H,
    x: 0,
    y: 0,
    toJSON() {},
  };
};
window.alert = (msg) => errors.push(`alert: ${msg}`);
window.addEventListener("error", (e) =>
  errors.push(String(e.error || e.message)),
);

for (const file of [
  "js/common.js",
  "js/features.js",
  "js/tourism.js",
  "js/benefia.js",
  "js/skt.js",
]) {
  try {
    window.eval(read(file));
  } catch (e) {
    errors.push(`${file}: ${e.message}`);
  }
}
// 스크립트들이 DOMContentLoaded 에서 초기화되므로 수동으로 발화
document.dispatchEvent(new window.Event("DOMContentLoaded"));

const $ = (sel) => document.querySelector(sel);
const fire = (el, type) =>
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
const setValue = (el, value, type = "input") => {
  el.value = value;
  fire(el, type);
};
const setChecked = (el, value) => {
  el.checked = value;
  fire(el, "change");
};

section("초기 로드");
check(
  "스크립트 로드 중 오류 없음",
  errors.length === 0,
  errors.join("\n       "),
);
check("PubFeatures 전역 노출", typeof window.PubFeatures === "object");
check("투어비스 이미지 행 자동 생성", !!$("#image-list .image-row"));
check(
  "스티키 탭 패널 3개 모두 렌더",
  ["#tourism-sticky-panel", "#benefia-sticky-panel", "#skt-sticky-panel"].every(
    (sel) => $(sel)?.querySelector(".sticky-enabled"),
  ),
);

// 기능 블록마다 구분선(.panel-section)이 붙어야 한다. 첫 블록만 선이 없다.
["tourism", "benefia", "skt"].forEach((tab) => {
  const panels = document.querySelectorAll(`#${tab}-tab .panel-section`);
  const titles = [...panels].map((p) =>
    p.querySelector("h3")?.textContent.trim(),
  );
  check(
    `${tab}: 기능 블록마다 구분선`,
    ["이미지 정보 입력", "탭 스크롤", "스티키 탭", "탭 콘텐츠 전환"].every(
      (t) => titles.includes(t),
    ),
    titles.join(" / "),
  );
  check(
    `${tab}: 첫 블록에만 is-first`,
    panels[0]?.classList.contains("is-first") &&
      [...panels].filter((p) => p.classList.contains("is-first")).length === 1,
    titles.join(" / "),
  );
});

// ---------------------------------------------------------------- 베네피아
section("베네피아 — 영상 오버레이");
$("#benefia-add-image-row").click();
const benefiaUrl = $("#benefia-image-rows .image-url");
setValue(benefiaUrl, "https://cdn.example.com/promo/img_01.jpg");
fire(benefiaUrl, "change");

$("#add-benefia-area-video").click();
const videoKind = $('#benefia-areas select[data-field="videoKind"]');
check("영상 영역의 종류 선택이 렌더됨", !!videoKind);
setValue(
  $('#benefia-areas input[data-field="videoSrc"]'),
  "https://youtu.be/6JHW52IOr2Q",
);
$("#generate-benefia-code").click();

let out = $("#benefia-code-output").value;
check(
  "유튜브 iframe 출력",
  out.includes("youtube.com/embed/6JHW52IOr2Q"),
  out.slice(0, 300),
);
check("loop+playlist 동반", out.includes("playlist=6JHW52IOr2Q"));

section("베네피아 — mp4 로 전환");
setValue(videoKind, "mp4", "change");
setValue(
  $('#benefia-areas input[data-field="videoSrc"]'),
  "https://cdn.example.com/movie.mp4",
);
check(
  "mp4 전환 시 확대 비율 필드 노출",
  !!$('#benefia-areas input[data-field="videoScale"]'),
);
$("#generate-benefia-code").click();
out = $("#benefia-code-output").value;
check(
  "video 태그 출력",
  out.includes("<video") && out.includes('type="video/mp4"'),
  out.slice(0, 300),
);
check("유튜브 iframe 은 사라짐", !out.includes("youtube.com/embed"));

section("베네피아 — 탭 스크롤 세트");
setValue($("#benefia-tabscroll-count"), "3");
$("#add-benefia-tabscroll").click();
out = $("#benefia-code-output").value;
const sectionCount = (out.match(/class="section"/g) || []).length;
check("섹션 마커 3개 생성", sectionCount === 3, `got ${sectionCount}`);
check(
  "섹션 마커는 가로 전체 폭",
  out.includes("left:0;") && out.includes("width:100%; height:1px;"),
);
// 탭 메뉴가 섹션마다 반복되므로 링크는 N×N 개여야 한다.
const linkCount = (out.match(/href="#[abc]"/g) || []).length;
check("탭 링크 3×3 = 9개 생성", linkCount === 9, `got ${linkCount}`);
["a", "b", "c"].forEach((id) => {
  const n = (out.match(new RegExp(`href="#${id}"`, "g")) || []).length;
  check(`#${id} 링크가 섹션마다 1개씩 (3개)`, n === 3, `got ${n}`);
});
check("smooth scroll 스타일 포함", out.includes("scroll-behavior: smooth"));

section("베네피아 — 앵커 보정 스크립트 옵션");
setChecked($("#benefia-anchor-offset-enabled"), true);
setValue($("#benefia-anchor-offset"), "80");
out = $("#benefia-code-output").value;
check(
  "offset 스크립트 삽입",
  out.includes("var OFFSET = 80;"),
  out.slice(-400),
);
setChecked($("#benefia-anchor-offset-enabled"), false);

section("베네피아 — 스티키 탭");
const bPanel = $("#benefia-sticky-panel");
setChecked(bPanel.querySelector(".sticky-enabled"), true);
check(
  "활성화 시 본문 노출",
  !bPanel.querySelector(".sticky-body").classList.contains("hidden"),
);
bPanel.querySelector(".sticky-add-tab").click();
$("#benefia-sticky-panel").querySelector(".sticky-add-tab").click();
const tabRows = $("#benefia-sticky-panel").querySelectorAll(".sticky-tab-row");
check("탭 2개 추가됨", tabRows.length === 2, `got ${tabRows.length}`);
setValue(
  tabRows[0].querySelector(".sticky-tab-off"),
  "https://cdn.example.com/tab01_off.jpg",
);
out = $("#benefia-code-output").value;
check("탭바 마크업 출력", out.includes('class="tab-box"'), out.slice(0, 400));
check("첫 탭 활성 이미지 자동 유추", out.includes("tab01_on.jpg"));
check("tab-area 래핑", out.includes('class="tab-area"'));
check("스티키 스크립트 포함", out.includes("classList.add('fix')"));

// fixed 는 뷰포트 기준이라 CSS 로 left/right:0 을 주면 컨테이너 padding/margin 을 무시한다.
// 좌표는 스크립트가 고정 직전의 실제 위치를 재서 넣어야 한다.
check(
  "고정 CSS 가 화면 끝까지 퍼지지 않는다",
  !/\.tab-box\.fix \{[^}]*left: 0/.test(out) &&
    !/\.tab-box\.fix \{[^}]*width: 100%/.test(out),
  out.match(/\.tab-box\.fix \{[^}]*\}/)?.[0],
);
check(
  "고정 전 실제 위치·폭을 잰다",
  out.includes("baseLeft = window.pageXOffset + rect.left") &&
    out.includes("baseWidth = rect.width"),
);
check(
  "잰 값을 고정 시 좌표로 넣는다",
  out.includes("menu.style.left = (baseLeft - window.pageXOffset) + 'px'") &&
    out.includes("menu.style.width = baseWidth + 'px'"),
);
check(
  "해제 시 인라인 좌표를 되돌린다",
  out.includes("menu.style.left = ''") && out.includes("menu.style.width = ''"),
);

// 헤더 높이 보정 — 0 이면 자동 측정, 값을 넣으면 그 값을 우선한다.
check(
  "기본값 0 (자동 측정)",
  out.includes("var HEADER_OFFSET = 0;"),
  out.match(/var HEADER_OFFSET = [^\n]*/)?.[0],
);
check("자동 측정 폴백 유지", out.includes("document.querySelector('header')"));
setValue(
  $("#benefia-sticky-panel").querySelector(".sticky-header-offset"),
  "64",
);
out = $("#benefia-code-output").value;
check(
  "입력한 헤더 높이가 스크립트에 반영",
  out.includes("var HEADER_OFFSET = 64;"),
  out.match(/var HEADER_OFFSET = [^\n]*/)?.[0],
);
check(
  "값이 있으면 자동 측정보다 우선",
  out.includes("if (HEADER_OFFSET > 0) return HEADER_OFFSET;"),
);
setValue(
  $("#benefia-sticky-panel").querySelector(".sticky-header-offset"),
  "0",
);

// ---------------------------------------------------------------- SKT
section("베네피아 — 배경색 UI 제거 / 생성 버튼 라벨");
check(
  "이미지 행에 배경색 입력칸이 없다 (통이미지 관행상 미사용)",
  !$("#benefia-image-rows").querySelector(".bg-color, .bg-color-text"),
);
// 앵커 추가 버튼은 '앵커 영역 설정' 한 곳에만 있어야 한다 (SKT 와 동일).
check(
  "'이미지맵 영역 추가' 에는 앵커 추가 버튼이 없다",
  !$("#add-benefia-anchor"),
);
check(
  "'앵커 영역 설정' 의 + 새 앵커 추가 는 그대로 동작한다",
  (() => {
    const before = $("#benefia-anchors").children.length;
    $("#add-benefia-anchor-secondary").click();
    return $("#benefia-anchors").children.length === before + 1;
  })(),
);
check(
  "베네피아·SKT 의 앵커 추가 버튼 구성이 같다",
  !!$("#add-benefia-anchor-secondary") &&
    !!$("#add-skt-anchor-secondary") &&
    !$("#add-benefia-anchor") &&
    !$("#add-skt-anchor"),
);
const bGenBtn = $("#generate-benefia-code");
const bGenLabel = bGenBtn.textContent;
bGenBtn.click();
check("클릭 직후 '생성 완료' 표시", bGenBtn.textContent === "생성 완료");
await new Promise((r) => setTimeout(r, 1700));
check(
  "1.5초 뒤 원래 문구로 복원",
  bGenBtn.textContent === bGenLabel,
  `"${bGenBtn.textContent}" vs "${bGenLabel}"`,
);

// ---------------------------------------------------------------- SKT
section("SKT");
$("#skt-add-image-row").click();
const sktUrl = $("#skt-image-rows .image-url");
setValue(sktUrl, "https://cdn.example.com/promo/skt_01.jpg");
fire(sktUrl, "change");
$("#add-skt-area-video").click();
setValue(
  $('#skt-areas input[data-field="videoSrc"]'),
  "https://youtu.be/6JHW52IOr2Q",
);
$("#generate-skt-code").click();
let sktOut = $("#skt-code-output").value;
check(
  "유튜브 iframe 출력",
  sktOut.includes("youtube.com/embed/6JHW52IOr2Q"),
  sktOut.slice(0, 300),
);
const styleCount = (sktOut.match(/skt-anchor-link \{/g) || []).length;
check("앵커 스타일 블록은 1회만 출력", styleCount === 1, `got ${styleCount}`);
check(
  "이미지 행에 배경색 입력칸이 없다",
  !$("#skt-image-rows").querySelector(".bg-color, .bg-color-text"),
);

$("#add-skt-tabscroll").click();
sktOut = $("#skt-code-output").value;
check(
  "섹션 마커 2개 생성",
  (sktOut.match(/class="section"/g) || []).length === 2,
);
check(
  "탭 링크 2×2 = 4개 생성",
  (sktOut.match(/href="#[ab]"/g) || []).length === 4,
  `got ${(sktOut.match(/href="#[ab]"/g) || []).length}`,
);

// ---------------------------------------------------------------- 투어비스
section("투어비스 — 타입별 추가 버튼");
const tourRow = $("#image-list .image-row");
setValue(
  tourRow.querySelector(".image-url"),
  "https://cdn.example.com/pc_02.jpg",
);
check(
  "영상/앵커/섹션 전용 추가 버튼 존재",
  [".add-video-btn", ".add-anchor-btn", ".add-section-btn"].every((s) =>
    tourRow.querySelector(s),
  ),
);
tourRow.querySelector(".add-video-btn").click();
let configRow = tourRow.querySelector(".button-config-row");
check(
  "영상 버튼이 타입을 미리 선택",
  configRow.querySelector(".button-type").value === "video",
);
check(
  "영상 필드 즉시 노출",
  !configRow.querySelector(".video-fields").classList.contains("hidden"),
);
check(
  "다른 타입 필드는 숨김",
  configRow.querySelector(".booking-fields").classList.contains("hidden"),
);

// 삭제 시 남은 행의 설정이 보존되는지 확인
tourRow.querySelector(".add-anchor-btn").click();
setValue(
  tourRow.querySelectorAll(".button-config-row")[1].querySelector(".anchor-id"),
  "zz",
);
tourRow
  .querySelectorAll(".button-config-row")[0]
  .querySelector(".remove-button-btn")
  .click();
const remaining = tourRow.querySelectorAll(".button-config-row");
check("행 1개만 남음", remaining.length === 1, `got ${remaining.length}`);
check(
  "남은 행의 타입 보존",
  remaining[0].querySelector(".button-type").value === "anchor",
);
check(
  "남은 행의 입력값 보존",
  remaining[0].querySelector(".anchor-id").value === "zz",
);
check("인덱스 재부여", remaining[0].dataset.buttonIndex === "0");

section("투어비스 — 앱 알림 설정");
tourRow.querySelector(".buttons-container").innerHTML = "";
tourRow.dataset.buttons = JSON.stringify([]);
tourRow.querySelector(".add-new-button-btn").click();
const anRow = tourRow.querySelector(".button-config-row");
check(
  "요소 타입에 '앱 알림 설정' 이 있다",
  !!anRow.querySelector('.button-type option[value="appnotify"]'),
);
setValue(anRow.querySelector(".button-type"), "appnotify", "change");
check(
  "선택 시 전용 입력만 노출",
  !anRow.querySelector(".appnotify-fields").classList.contains("hidden") &&
    anRow.querySelector(".booking-fields").classList.contains("hidden") &&
    anRow.querySelector(".video-fields").classList.contains("hidden"),
);
// 회원번호 쿠키(custId)는 고정이고, 버튼마다 다른 값은 설치 링크뿐이다.
check("쿠키 이름 입력칸은 없다", !anRow.querySelector(".appnotify-cookie"));
check("브랜드 선택은 없다", !anRow.querySelector(".appnotify-brand"));
check("안내 문구 입력칸은 없다", !anRow.querySelector(".appnotify-message"));
check(
  "입력은 앱 설치 링크 하나뿐",
  anRow.querySelectorAll(".appnotify-fields input").length === 1 &&
    !!anRow.querySelector(".appnotify-install"),
);
check(
  "요소 제목에 종류 표시",
  anRow.querySelector(".config-row-title").textContent.includes("앱 알림 설정"),
  anRow.querySelector(".config-row-title").textContent,
);

// 좌표는 매퍼 없이 주입한다 (영역 지정 자체는 다른 절에서 검증).
tourRow.dataset.buttons = JSON.stringify([
  {
    coords: {
      left: "10.00",
      bottom: "20.00",
      top: "70.00",
      width: "80.00",
      height: "10.00",
      nW: 800,
      nH: 2000,
    },
  },
]);
setValue(anRow.querySelector(".appnotify-install"), "https://abr.ge/uysf2c");

// 모바일 — href 에 설치 링크를 두고, 앱 안일 때만 스크립트가 끼어든다.
document.getElementById("platform-mo").checked = true;
fire($("#platform-mo"), "change");
$("#generate-btn").click();
let anOut = $("#code-output").value;
check(
  "모바일: href 가 앱 설치 링크",
  anOut.includes('href="https://abr.ge/uysf2c"'),
  anOut.match(/<a data-map-anchor[^>]*앱 알림/)?.[0],
);
check(
  "모바일: onclick 이 pubAppNotify 결과를 반환",
  anOut.includes('onclick="return pubAppNotify();"'),
  anOut.match(/onclick="[^"]*"/)?.[0],
);
check(
  "모바일: 공용 스크립트가 한 번만 출력된다",
  (anOut.match(/function pubAppNotify/g) || []).length === 1,
);
check(
  "회원번호 쿠키는 스크립트에 고정",
  anOut.includes(`readCookie('custId')`),
);
// 앱이 아니면 true 를 돌려 href(설치 링크)로 진행한다.
check("앱이 아니면 href 로 진행", anOut.includes("if (!isApp) return true;"));

// PC — 앱이 열릴 수 없으므로 단순 링크로 끝나고 스크립트가 붙지 않는다.
document.getElementById("platform-pc").checked = true;
fire($("#platform-pc"), "change");
$("#generate-btn").click();
anOut = $("#code-output").value;
check(
  "PC: 설치 링크로 가는 단순 링크",
  anOut.includes('href="https://abr.ge/uysf2c" target="_blank"'),
  anOut.match(/<a data-map-anchor[^>]*앱 알림/)?.[0],
);
check("PC: onclick 없음", !anOut.includes("pubAppNotify"));
check("PC: UA 판별 코드 없음", !anOut.includes("tourvis_"));

// 설치 링크를 비우면 href 가 빈 문자열이 되지 않도록 막는다.
setValue(anRow.querySelector(".appnotify-install"), "");
document.getElementById("platform-mo").checked = true;
fire($("#platform-mo"), "change");
$("#generate-btn").click();
check(
  "링크를 비우면 href 는 javascript:void(0)",
  $("#code-output").value.includes(
    'href="javascript:void(0)" onclick="return pubAppNotify();"',
  ),
  $("#code-output").value.match(/<a data-map-anchor[^>]*앱 알림/)?.[0],
);

// 앱 알림 버튼이 없으면 스크립트도 나오지 않아야 한다.
setValue(anRow.querySelector(".button-type"), "link", "change");
setValue(anRow.querySelector(".link-url"), "https://example.com");
$("#generate-btn").click();
check(
  "앱 알림 요소가 없으면 스크립트도 없다",
  !$("#code-output").value.includes("pubAppNotify"),
);
document.getElementById("platform-pc").checked = true;
fire($("#platform-pc"), "change");

// 영역 설정 버튼 상태 — 추가 직후 미설정 → '적용' 후 완료
section("투어비스 — 영역 설정 상태 표시");
tourRow.querySelector(".buttons-container").innerHTML = "";
tourRow.dataset.buttons = JSON.stringify([]);
tourRow.querySelector(".add-new-button-btn").click();
const areaRow = tourRow.querySelector(".button-config-row");
const areaBtn = areaRow.querySelector(".set-area-btn");
check(
  "+ 버튼 추가 직후는 미설정",
  areaBtn.dataset.areaState === "none" &&
    areaBtn.textContent.trim() === "영역 설정하기" &&
    areaBtn.classList.contains("bg-indigo-500"),
  `${areaBtn.dataset.areaState} / ${areaBtn.textContent.trim()}`,
);
areaBtn.click();
check("매퍼가 열린다", !$("#image-map-section").classList.contains("hidden"));
check(
  "매퍼 제목에 편집 중인 요소가 표시된다",
  $("#mapper-title").textContent.includes("요소 #1"),
  $("#mapper-title").textContent,
);
// jsdom 은 이미지를 로드하지 않으므로 원본 크기를 흉내낸다.
Object.defineProperty($("#mapper-image"), "naturalWidth", {
  value: 800,
  configurable: true,
});
Object.defineProperty($("#mapper-image"), "naturalHeight", {
  value: 2000,
  configurable: true,
});
$("#apply-area-btn").click();
check(
  "'적용' 후 완료로 바뀐다",
  areaBtn.dataset.areaState === "done" &&
    areaBtn.textContent.includes("영역 설정 완료") &&
    areaBtn.classList.contains("bg-green-500"),
  `${areaBtn.dataset.areaState} / ${areaBtn.textContent.trim()}`,
);
check("매퍼가 닫힌다", $("#image-map-section").classList.contains("hidden"));
check(
  "미리보기 갱신 후에도 완료 표시가 유지된다",
  (() => {
    setValue(
      tourRow.querySelector(".image-url"),
      "https://cdn.example.com/x.jpg",
    );
    const b = tourRow.querySelector(".button-config-row .set-area-btn");
    return b.dataset.areaState === "done";
  })(),
);
// 대상이 사라진 채 '적용'을 누르면(이미지 로드 실패 등) 조용히 삼키지 않는다.
const errCountBefore = errors.length;
$("#apply-area-btn").click();
check(
  "대상이 없으면 '적용'이 조용히 무시되지 않는다",
  errors.length > errCountBefore &&
    errors[errors.length - 1].includes("저장할 대상이 없습니다"),
  errors[errors.length - 1],
);
errors.length = errCountBefore;

tourRow.querySelector(".buttons-container").innerHTML = "";
tourRow.dataset.buttons = JSON.stringify([]);

// 이후 검증을 위해 영상 요소로 되돌린다.
tourRow.querySelector(".buttons-container").innerHTML = "";
tourRow.dataset.buttons = JSON.stringify([]);
tourRow.querySelector(".add-video-btn").click();
configRow = tourRow.querySelector(".button-config-row");
// 영역 설정은 이미지 로드가 필요하므로 좌표를 직접 주입한다.
tourRow.dataset.buttons = JSON.stringify([
  {
    coords: {
      left: "19.17",
      bottom: "77.35",
      top: "14.37",
      width: "61.67",
      height: "8.28",
      nW: 1200,
      nH: 3000,
    },
  },
]);
setValue(configRow.querySelector(".video-src"), "https://youtu.be/6JHW52IOr2Q");
$("#generate-btn").click();
let tourOut = $("#code-output").value;
check(
  "유튜브 iframe 출력",
  tourOut.includes("youtube.com/embed/6JHW52IOr2Q"),
  tourOut.slice(0, 400),
);
check("전체 문서 형태 유지", tourOut.startsWith("<!DOCTYPE html>"));

setValue(configRow.querySelector(".video-kind"), "mp4", "change");
check(
  "mp4 전환 시 확대 비율 노출",
  !configRow.querySelector(".video-scale-wrap").classList.contains("hidden"),
);
setValue(
  configRow.querySelector(".video-src"),
  "https://cdn.example.com/movie.mp4",
);
$("#generate-btn").click();
tourOut = $("#code-output").value;
// 1200*0.6167 = 740, 3000*0.0828 = 248
check(
  "mp4 aspect-ratio 계산",
  tourOut.includes("aspect-ratio: 740/248"),
  tourOut.match(/aspect-ratio[^;]*/)?.[0],
);

setValue(configRow.querySelector(".button-type"), "section", "change");
setValue(configRow.querySelector(".section-id"), "#a");
$("#generate-btn").click();
tourOut = $("#code-output").value;
check(
  "섹션 마커 출력('#' 제거)",
  tourOut.includes('<div class="section" id="a"'),
  tourOut.match(/<div class="section"[^>]*>/)?.[0],
);

setValue(configRow.querySelector(".button-type"), "anchor", "change");
setValue(configRow.querySelector(".anchor-id"), "top");
$("#generate-btn").click();
tourOut = $("#code-output").value;
check("앵커 링크 출력", tourOut.includes('href="#top"'));
check(
  "앵커 사용 시 smooth scroll 스타일",
  tourOut.includes("scroll-behavior: smooth"),
);

section("투어비스 — 탭 스크롤 세트 (섹션 = 이미지)");
// 세트용 이미지 3장 추가 (이미지 #1 은 앞선 검증에서 사용 중)
for (let i = 0; i < 3; i++) $("#add-image-btn").click();
const allRows = () => $("#image-list").querySelectorAll(".image-row");
[1, 2, 3].forEach((i) =>
  setValue(
    allRows()[i].querySelector(".image-url"),
    `https://cdn.example.com/pc_0${i + 2}.jpg`,
  ),
);
check(
  "시작 이미지 선택지 갱신",
  $("#tourism-tabscroll-target").options.length === 4,
  `got ${$("#tourism-tabscroll-target").options.length}`,
);

// 남은 이미지가 탭 개수보다 적으면 생성하지 않고 안내
setValue($("#tourism-tabscroll-count"), "3");
setValue($("#tourism-tabscroll-target"), "3", "change");
$("#add-tourism-tabscroll").click();
check(
  "이미지 부족 시 안내 후 중단",
  errors.some((e) => e.includes("이미지 3장이 필요")),
  errors.join(" | "),
);
check(
  "중단 시 요소가 생성되지 않음",
  allRows()[3].querySelectorAll(".button-config-row").length === 0,
);
errors.length = 0;

setValue($("#tourism-tabscroll-target"), "1", "change");
$("#add-tourism-tabscroll").click();

const rowsOf = (i) => allRows()[i].querySelectorAll(".button-config-row");
check(
  "이미지 3장에 각각 요소 4개 (섹션 1 + 탭메뉴 3)",
  [1, 2, 3].every((i) => rowsOf(i).length === 4),
  [1, 2, 3].map((i) => rowsOf(i).length).join(","),
);
check(
  "각 이미지의 첫 요소는 섹션",
  [1, 2, 3].every(
    (i) => rowsOf(i)[0].querySelector(".button-type").value === "section",
  ),
);
check(
  "섹션 ID 가 이미지 순서대로 a/b/c",
  [1, 2, 3]
    .map((i) => rowsOf(i)[0].querySelector(".section-id").value)
    .join("") === "abc",
);
check(
  "이미지마다 탭 메뉴 한 벌(a/b/c)이 반복",
  [1, 2, 3].every(
    (i) =>
      [1, 2, 3]
        .map((t) => rowsOf(i)[t].querySelector(".anchor-id").value)
        .join("") === "abc",
  ),
);
check(
  "세트 자동 생성분은 '완료'가 아니라 '조정 필요' 로 표시된다",
  rowsOf(1)[0].querySelector(".set-area-btn").dataset.areaState === "pending" &&
    rowsOf(1)[0]
      .querySelector(".set-area-btn")
      .textContent.includes("조정 필요") &&
    !rowsOf(1)[0].querySelector(".set-area-btn").textContent.includes("완료"),
  rowsOf(1)[0].querySelector(".set-area-btn").textContent,
);
check(
  "섹션은 '세로 위치' 문구를 쓴다",
  rowsOf(1)[0].querySelector(".set-area-btn").textContent.includes("세로 위치"),
  rowsOf(1)[0].querySelector(".set-area-btn").textContent,
);
// 한 이미지에 섹션 1 + 탭 링크 N 개가 들어가므로 제목으로 구분되어야 한다.
check(
  "요소 제목에 종류와 대상 ID 가 표시된다",
  [
    "요소 #1 · 섹션 시작점 #a",
    "요소 #2 · 앵커 이동 → #a",
    "요소 #3 · 앵커 이동 → #b",
  ].every(
    (want, i) =>
      rowsOf(1)[i].querySelector(".config-row-title").textContent === want,
  ),
  Array.from(rowsOf(1))
    .map((r) => r.querySelector(".config-row-title").textContent)
    .join(" | "),
);

$("#generate-btn").click();
tourOut = $("#code-output").value;
check(
  "섹션 마커 3개 출력",
  (tourOut.match(/class="section"/g) || []).length === 3,
  `got ${(tourOut.match(/class="section"/g) || []).length}`,
);
check(
  "탭 링크 3×3 = 9개 출력",
  (tourOut.match(/href="#[abc]"/g) || []).length === 9,
  `got ${(tourOut.match(/href="#[abc]"/g) || []).length}`,
);
check(
  "탭 링크가 가로 균등 분할",
  ["left: 0.00%", "left: 33.33%", "left: 66.66%"].every((s) =>
    tourOut.includes(s),
  ),
  tourOut.match(/left: [\d.]+%/g)?.join(" "),
);

section("투어비스 — PC 좌우 여백 시 가로 좌표 환산");
// 레퍼런스: D:\프로모션\투어비스_항공\60492 (PC/모바일이 같은 이미지를 사용)
//   모바일 (여백 없음)               left: 5%   width: 90%
//   PC     (좌우 여백 16.66667%)     left: 20%  width: 60%
//   세로(bottom / height)는 양쪽 동일
const padRow = allRows()[1];
padRow.querySelector(".buttons-container").innerHTML = "";
padRow.dataset.buttons = JSON.stringify([
  {
    coords: {
      left: "5.00",
      bottom: "15.44",
      top: "69.12",
      width: "90.00",
      height: "15.44",
      nW: 900,
      nH: 3000,
    },
  },
]);
padRow.querySelector(".add-new-button-btn").click();
// 위 클릭이 buttons 배열에 빈 항목을 덧붙이므로 좌표만 다시 세팅한다.
padRow.dataset.buttons = JSON.stringify([
  {
    coords: {
      left: "5.00",
      bottom: "15.44",
      top: "69.12",
      width: "90.00",
      height: "15.44",
      nW: 900,
      nH: 3000,
    },
  },
]);
const padCfg = padRow.querySelector(".button-config-row");
setValue(padCfg.querySelector(".airline-code"), "7C");
setValue(padRow.querySelector(".bg-color-text"), "#DFF2F9");

// 모바일 — 여백이 없으므로 이미지 기준 좌표 그대로
document.getElementById("platform-mo").checked = true;
$("#generate-btn").click();
let padOut = $("#code-output").value;
check("모바일은 padding 없음", !padOut.includes("padding: 0 16.66667%;"));
check(
  "모바일 좌표는 그대로 (left 5% / width 90%)",
  padOut.includes("left: 5.00%; width: 90.00%"),
  padOut.match(/left: [\d.]+%; width: [\d.]+%/)?.[0],
);
check("모바일은 compactPopOpen", padOut.includes("compactPopOpen('7C')"));
check(
  "모바일 래퍼는 900px 상한 + 가운데 정렬 (레퍼런스 event_mobile.html)",
  padOut.includes(
    'style="position: relative; max-width: 900px; margin: auto; line-height: 0; overflow: hidden;"',
  ),
  padOut.match(/class="new-pb-container[^>]*/)?.[0],
);
check(
  "모바일은 body 여백 제거",
  padOut.includes('<body style="margin: 0">'),
  padOut.match(/<body[^>]*>/)?.[0],
);

// PC — 여백이 붙으므로 래퍼 기준으로 환산
document.getElementById("platform-pc").checked = true;
$("#generate-btn").click();
padOut = $("#code-output").value;
check("PC + 배경색이면 padding 적용", padOut.includes("padding: 0 16.66667%;"));
check(
  "PC 좌표가 레퍼런스와 동일하게 환산 (left 20% / width 60%)",
  padOut.includes("left: 20.00%; width: 60.00%"),
  padOut.match(/left: [\d.]+%; width: [\d.]+%/)?.[0],
);
check(
  "세로 좌표는 환산하지 않는다",
  padOut.includes("bottom: 15.44%") && padOut.includes("height: 15.44%"),
  padOut.match(/bottom: [\d.]+%[\s\S]{0,90}?height: [\d.]+%/)?.[0],
);
check("PC 는 promoFixPop", padOut.includes("promoFixPop('7C')"));
check(
  "PC 래퍼는 1200px 상한 + 가운데 정렬",
  padOut.includes(
    'class="new-pb-container event-wrap" style="position: relative; width: 100%; max-width: 1200px; margin: 0 auto;"',
  ),
  padOut.match(/class="new-pb-container[^>]*/)?.[0],
);
check(
  "PC 는 body 에 별도 스타일 없음",
  /<body>\s/.test(padOut),
  padOut.match(/<body[^>]*>/)?.[0],
);
check(
  "레퍼런스와 동일한 평평한 구조 (중첩 div 없음)",
  !/<div style="position: relative;">\s*<div style="position: relative;">/.test(
    padOut,
  ),
);

// 배경색이 흰색(기본)이면 PC 라도 여백이 없으므로 환산도 하지 않는다
setValue(padRow.querySelector(".bg-color-text"), "");
$("#generate-btn").click();
padOut = $("#code-output").value;
check(
  "배경색 없으면 PC 라도 padding 없음",
  !padOut.includes("padding: 0 16.66667%;"),
);
check(
  "여백이 없으면 환산도 없다 (left 5% / width 90%)",
  padOut.includes("left: 5.00%; width: 90.00%"),
  padOut.match(/left: [\d.]+%; width: [\d.]+%/)?.[0],
);

section("투어비스 — 래퍼 최대 폭 입력");
const wrapAttr = () =>
  $("#code-output").value.match(/class="new-pb-container[^>]*/)[0];

document.getElementById("platform-pc").checked = true;
fire($("#platform-pc"), "change");
check(
  "PC 선택 시 입력칸이 PC 값을 보여준다",
  $("#platform-max-width").value === "1200" &&
    $("#platform-max-width-target").textContent === "PC",
);
check(
  "여백 사용 시 이미지 실폭 힌트",
  $("#platform-max-width-hint").textContent.includes("800px"),
  $("#platform-max-width-hint").textContent,
);

setValue($("#platform-max-width"), "1000");
$("#generate-btn").click();
check(
  "입력한 최대 폭이 PC 래퍼에 반영",
  wrapAttr().includes("max-width: 1000px;"),
  wrapAttr(),
);
check(
  "힌트도 함께 갱신 (1000 × 2/3)",
  $("#platform-max-width-hint").textContent.includes("667px"),
  $("#platform-max-width-hint").textContent,
);
check(
  "최대 폭을 바꿔도 PC 는 가운데 정렬 유지",
  wrapAttr().includes("margin: 0 auto;"),
  wrapAttr(),
);

document.getElementById("platform-mo").checked = true;
fire($("#platform-mo"), "change");
check(
  "모바일로 바꾸면 모바일 값(900)으로 전환",
  $("#platform-max-width").value === "900" &&
    $("#platform-max-width-target").textContent === "모바일",
);
setValue($("#platform-max-width"), "750");
$("#generate-btn").click();
check(
  "모바일 래퍼에도 반영",
  wrapAttr().includes("max-width: 750px;") &&
    wrapAttr().includes("margin: auto"),
  wrapAttr(),
);

document.getElementById("platform-pc").checked = true;
fire($("#platform-pc"), "change");
check(
  "플랫폼별 값이 각각 기억된다",
  $("#platform-max-width").value === "1000",
  $("#platform-max-width").value,
);

$("#reset-btn").click();
check(
  "초기화하면 기본값(PC 1200)으로 복귀",
  $("#platform-max-width").value === "1200",
  $("#platform-max-width").value,
);
// 초기화로 이미지가 비었으므로 이후 검증을 위해 다시 채운다.
setValue(
  $("#image-list .image-row .image-url"),
  "https://cdn.example.com/pc_02.jpg",
);

section("투어비스 — 스티키 탭");
const tPanel = $("#tourism-sticky-panel");
setChecked(tPanel.querySelector(".sticky-enabled"), true);
$("#tourism-sticky-panel").querySelector(".sticky-add-tab").click();
setValue(
  $("#tourism-sticky-panel").querySelector(".sticky-tab-off"),
  "https://cdn.example.com/tab01_off.jpg",
);
$("#generate-btn").click();
tourOut = $("#code-output").value;
check("탭바 출력", tourOut.includes('class="tab-box"'), tourOut.slice(0, 600));
check(
  "스티키 스타일이 head 안",
  tourOut.indexOf(".tab-box.fix") < tourOut.indexOf("<body"),
);
check(
  "스티키 스크립트가 body 끝",
  tourOut.lastIndexOf("<script>") > tourOut.indexOf("<body"),
);

// ---------------------------------------------------------------- 탭 콘텐츠 전환
section("투어비스 — 탭 콘텐츠 전환");
// 이미지 4장: #1 공통, #2·#3 이 탭 콘텐츠, #4 공통
// (레퍼런스 51714: 상단 공통 → 탭 그룹 → 하단 공통)
$("#reset-btn").click(); // 앞선 검증 상태를 비운다
["a", "b", "c", "d"].forEach((n, i) => {
  if (i > 0) $("#add-image-btn").click();
  setValue(
    $("#image-list")
      .querySelectorAll(".image-row")
      [i].querySelector(".image-url"),
    `https://cdn.example.com/img_0${i + 1}.jpg`,
  );
});

const tsPanel = () => $("#tourism-tabswitch-panel");
tsPanel().querySelector(".ts-add-group").click();
let group = tsPanel().querySelector(".tab-switch-group");
check(
  "그룹 추가 시 탭 2개가 기본 생성",
  group.querySelectorAll(".ts-tab-row").length === 2,
);

// 탭1 = 이미지 #2, 탭2 = 이미지 #3, 그룹 끝 = 이미지 #3
const tabRowsOf = () => tsPanel().querySelectorAll(".ts-tab-row");
setValue(tabRowsOf()[0].querySelector(".ts-label"), "음악과 자연");
setValue(tabRowsOf()[0].querySelector(".ts-start-index"), "1", "change");
setValue(tabRowsOf()[0].querySelector(".ts-active-bg"), "#f3e8d1");
setValue(tabRowsOf()[1].querySelector(".ts-label"), "여유로운 휴식");
setValue(tabRowsOf()[1].querySelector(".ts-start-index"), "2", "change");
setValue(tabRowsOf()[1].querySelector(".ts-active-bg"), "#ffebc3");
setValue(tsPanel().querySelector(".ts-end-index"), "2", "change");

$("#generate-btn").click();
let tsOut = $("#code-output").value;
check(
  "탭 그룹 래퍼 출력",
  tsOut.includes('class="tab-switch tab-switch-1"'),
  tsOut.slice(0, 500),
);
check(
  "첫 탭만 on",
  tsOut.includes('<li class="on" data-tabnum="0">') &&
    tsOut.includes('<li data-tabnum="1">'),
);
check("탭 이름이 텍스트로 출력", tsOut.includes(">음악과 자연</a>"));
check(
  "첫 콘텐츠만 on",
  (tsOut.match(/class="tabCont on"/g) || []).length === 1 &&
    (tsOut.match(/class="tabCont"/g) || []).length === 1,
  `on=${(tsOut.match(/class="tabCont on"/g) || []).length}, off=${(tsOut.match(/class="tabCont"/g) || []).length}`,
);
check(
  "탭1 콘텐츠 = 이미지 #2",
  /class="tabCont on">[\s\S]*?img_02\.jpg[\s\S]*?<\/div>/.test(tsOut),
);
check(
  "탭2 콘텐츠 = 이미지 #3",
  /class="tabCont">[\s\S]*?img_03\.jpg[\s\S]*?<\/div>/.test(tsOut),
);
check(
  "그룹 밖 이미지는 그대로 남는다 (#1 은 앞, #4 는 뒤)",
  // 'tabCont' 는 스크립트 문자열에도 등장하므로 마크업 형태로 비교한다.
  tsOut.indexOf("img_01.jpg") < tsOut.indexOf('class="tab-switch') &&
    tsOut.indexOf("img_04.jpg") > tsOut.lastIndexOf('class="tabCont"'),
);
check(
  "탭별 활성 배경색 규칙 생성",
  tsOut.includes(
    ".tab-switch-1 .tab-mn li:nth-child(1).on a { background-color: #f3e8d1; }",
  ) &&
    tsOut.includes(
      ".tab-switch-1 .tab-mn li:nth-child(2).on a { background-color: #ffebc3; }",
    ),
  tsOut.match(/\.tab-switch-1[^\n]*/g)?.join("\n"),
);
check(
  "전환 스크립트 포함",
  tsOut.includes("group.querySelectorAll('.tabCont')"),
);
// 탭 클릭은 콘텐츠 교체만 한다 — href="#" 로 인한 스크롤 점프를 막아야 한다.
check(
  "클릭 시 기본 동작(앵커 점프) 차단",
  tsOut.includes("e.preventDefault()"),
);
// 선택된 탭은 _on, 해제된 탭은 _off 로 되돌아간다.
check(
  "활성 탭 이미지 _on/_off 양방향 교체",
  tsOut.includes("swapOnOff(src, on ? 'on' : 'off')"),
);

section("투어비스 — 탭 콘텐츠 전환: 이미지 탭 / 스티키 탭 우선순위");
setValue(tsPanel().querySelector(".ts-button-type"), "image", "change");
setValue(
  tsPanel().querySelectorAll(".ts-tab-row")[0].querySelector(".ts-off-url"),
  "https://cdn.example.com/tab01_off.jpg",
);
setValue(
  tsPanel().querySelectorAll(".ts-tab-row")[1].querySelector(".ts-off-url"),
  "https://cdn.example.com/tab02_off.jpg",
);
$("#generate-btn").click();
tsOut = $("#code-output").value;
check(
  "이미지 탭 모드 클래스",
  tsOut.includes("tab-switch tab-switch-1 is-image"),
);
check(
  "첫 탭만 _on 으로 유추",
  tsOut.includes("tab01_on.jpg") && tsOut.includes("tab02_off.jpg"),
);

// 스티키 탭을 함께 켜도 콘텐츠 전환이 우선
const tPanel2 = $("#tourism-sticky-panel");
setChecked(tPanel2.querySelector(".sticky-enabled"), true);
$("#tourism-sticky-panel").querySelector(".sticky-add-tab").click();
$("#generate-btn").click();
tsOut = $("#code-output").value;
check("동시 사용 시 콘텐츠 전환이 우선", tsOut.includes('class="tab-switch'));
check("스티키 탭바는 출력되지 않음", !tsOut.includes('class="tab-box"'));

section("런타임 오류");
check(
  "전 과정에서 예외/alert 없음",
  errors.length === 0,
  errors.join("\n       "),
);

summary();
