// PubFeatures 코드 생성 단위 테스트 (브라우저 없이 실행)
// 실행: npm test
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { check, section, summary } from "./_harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "js/features.js"), "utf8");
const PubFeatures = new Function(`${src}; return PubFeatures;`)();

section("parseYoutubeId");
for (const [input, want] of Object.entries({
  "https://www.youtube.com/watch?v=6JHW52IOr2Q": "6JHW52IOr2Q",
  "https://youtu.be/6JHW52IOr2Q?t=10": "6JHW52IOr2Q",
  "https://www.youtube.com/embed/6JHW52IOr2Q?autoplay=1": "6JHW52IOr2Q",
  "https://www.youtube.com/shorts/6JHW52IOr2Q": "6JHW52IOr2Q",
  "6JHW52IOr2Q": "6JHW52IOr2Q",
  "https://example.com/x.mp4": "",
})) {
  const got = PubFeatures.parseYoutubeId(input);
  check(`${input} → ${want || "(없음)"}`, got === want, `got "${got}"`);
}

section("swapOnOff — 경로 중간의 '_' 를 건드리지 않는다");
check(
  "off → on",
  PubFeatures.swapOnOff(
    "https://cdns.tourvis.com/promotion/202409/58642/tab01_off.jpg",
    "on",
  ) === "https://cdns.tourvis.com/promotion/202409/58642/tab01_on.jpg",
);
check(
  "쿼리스트링/중간 언더스코어 보존",
  PubFeatures.swapOnOff(
    "https://cdn.x.com/my_promo_2024/img_tab_01_off.png?v=3",
    "on",
  ) === "https://cdn.x.com/my_promo_2024/img_tab_01_on.png?v=3",
);
check(
  "_on/_off 규칙이 없으면 원본 유지",
  PubFeatures.swapOnOff("https://x.com/a.jpg", "on") === "https://x.com/a.jpg",
);

section("영상 오버레이 — 유튜브");
const ytHtml = PubFeatures.buildVideoOverlay(
  { videoKind: "youtube", videoSrc: "https://youtu.be/6JHW52IOr2Q" },
  { left: "19.17", top: "14.37", width: "61.67", height: "8.28" },
  { w: 1200, h: 3000 },
);
check("embed URL", ytHtml.includes("youtube.com/embed/6JHW52IOr2Q"));
check(
  "loop 은 playlist 를 동반한다",
  ytHtml.includes("loop=1&playlist=6JHW52IOr2Q"),
);
check("aspect-ratio 560/315", ytHtml.includes("aspect-ratio: 560/315"));
check("%좌표 반영", ytHtml.includes("width: 61.67%; left: 19.17%"));
check("allowfullscreen", ytHtml.includes("allowfullscreen"));
check(
  "loop 해제 시 playlist 없음",
  !PubFeatures.buildVideoOverlay(
    { videoKind: "youtube", videoSrc: "6JHW52IOr2Q", videoLoop: false },
    { left: "0", top: "0", width: "50", height: "10" },
    null,
  ).includes("playlist="),
);

section("영상 오버레이 — mp4");
const mp4Html = PubFeatures.buildVideoOverlay(
  {
    videoKind: "mp4",
    videoSrc: "https://cdns.tourvis.com/x/movie_m_01.mp4",
    videoScale: 180,
  },
  { left: "23.50", top: "13.57", width: "53.25", height: "35.50" },
  { w: 800, h: 2129 },
);
// 800*0.5325 = 426, 2129*0.355 ≈ 756 — 레퍼런스(event_mobile.html)와 동일한 비율
check("aspect-ratio 계산", mp4Html.includes("aspect-ratio: 426/756"), mp4Html);
check("확대 비율", mp4Html.includes("height: 180%"));
check(
  "video 속성 순서",
  /<video autoplay loop muted playsinline /.test(mp4Html),
);
check("source type", mp4Html.includes('type="video/mp4"'));
check("overflow hidden", mp4Html.includes("overflow: hidden"));
const mp4NoNatural = PubFeatures.buildVideoOverlay(
  { videoKind: "mp4", videoSrc: "a.mp4", videoControls: true },
  { left: "0", top: "0", width: "50", height: "20" },
  null,
);
check(
  "원본 크기 미확보 시 height% 폴백",
  mp4NoNatural.includes("height: 20%;") &&
    !mp4NoNatural.includes("aspect-ratio"),
);
check("controls 옵션", mp4NoNatural.includes("controls"));

section("섹션 마커");
check(
  "가로 전체 폭 / 1px / '#' 제거",
  PubFeatures.buildSectionMarker("#a", "16.07", "") ===
    '<div class="section" id="a" style="position:absolute; left:0; top:16.07%; width:100%; height:1px;"></div>',
);

section("스티키 탭 마크업");
const sticky = {
  enabled: true,
  menuId: "menu",
  maxWidth: 800,
  tabs: [
    {
      id: "a",
      label: "탭1",
      offUrl: "https://x.com/tab01_off.jpg",
      startIndex: 1,
    },
    {
      id: "b",
      label: "탭2",
      offUrl: "https://x.com/tab02_off.jpg",
      startIndex: 3,
    },
  ],
};
const bar = PubFeatures.buildStickyTabBar(sticky);
check(
  "첫 탭만 _on",
  bar.includes("tab01_on.jpg") && bar.includes("tab02_off.jpg"),
);
check("첫 탭에 li.on", bar.includes('<li class="on"'));
check("탭 폭 균등 분할", bar.includes("width: 50.0000%"));
check("앵커 href", bar.includes('href="#a"') && bar.includes('href="#b"'));

const blocks = ["<!--0-->", "<!--1-->", "<!--2-->", "<!--3-->", "<!--4-->"];
const wrapped = PubFeatures.wrapBlocksWithStickyTabs(blocks, sticky);
check(
  "탭바 앞에 상단 공통 영역",
  wrapped.indexOf("<!--0-->") < wrapped.indexOf("tab-box"),
);
check(
  "탭 a 구간",
  /<div id="a" class="tab-area">\s*<!--1-->\s*<!--2-->/.test(wrapped),
);
check(
  "탭 b 구간(마지막까지)",
  /<div id="b" class="tab-area">\s*<!--3-->\s*<!--4-->/.test(wrapped),
);
check(
  "비활성 시 원본 그대로",
  PubFeatures.wrapBlocksWithStickyTabs(blocks, {
    ...sticky,
    enabled: false,
  }) === blocks.join("\n"),
);

section("생성 스크립트의 유효성");
const stripTags = (s) => s.replace(/^<script>/, "").replace(/<\/script>$/, "");
const stickyScript = PubFeatures.buildStickyTabScript(sticky);
check("script 태그로 감쌈", /^<script>[\s\S]*<\/script>$/.test(stickyScript));
check("menu id 주입", stickyScript.includes("getElementById('menu')"));
check("레이아웃 점프 방지 스페이서", stickyScript.includes("spacer"));
check(
  "on/off 치환 정규식 보존",
  stickyScript.includes("_(on|off)(\\.[A-Za-z0-9]+)"),
);
try {
  new Function(stripTags(stickyScript));
  check("스티키 탭 스크립트 문법", true);
} catch (e) {
  check("스티키 탭 스크립트 문법", false, e.message);
}

const offsetScript = PubFeatures.buildAnchorOffsetScript(60);
check("offset 주입", offsetScript.includes("var OFFSET = 60;"));
try {
  new Function(stripTags(offsetScript));
  check("앵커 보정 스크립트 문법", true);
} catch (e) {
  check("앵커 보정 스크립트 문법", false, e.message);
}

section("앱 알림 설정");
const notify = PubFeatures.buildAppNotifyScript();
try {
  new Function(stripTags(notify));
  check("앱 알림 스크립트 문법", true);
} catch (e) {
  check("앱 알림 스크립트 문법", false, e.message);
}
// 사내 하이브리드 앱 가이드의 스킴과 정확히 일치해야 한다.
check("투어비스 스킴", notify.includes("'tourvis://Preference?memberNo='"));
check("투어비스 UA 식별자", notify.includes("'tourvis_'"));
check("회원번호 쿠키 고정", notify.includes("readCookie('custId')"));
// 프리비아는 생성기 대상이 아니다.
check("프리비아 스킴은 없다", !notify.includes("priviatravel://"));
check(
  "iOS 는 webkit 핸들러로 전달",
  notify.includes("webkit.messageHandlers.observe.postMessage"),
);
check(
  "안드로이드는 window.location 이동",
  notify.includes("window.location ="),
);
check(
  "webkit 핸들러가 없으면 건너뛴다 (스크립트 오류 방지)",
  notify.includes("window.webkit && webkit.messageHandlers"),
);
check(
  "페이지의 getCookie 를 우선 사용",
  notify.includes("typeof getCookie === 'function'"),
);

// 인라인 onclick 안에 들어가므로 따옴표·역슬래시·줄바꿈이 깨지면 안 된다.
check(
  "jsString: 작은따옴표 이스케이프",
  PubFeatures.jsString(`it's`) === `it\\'s`,
  PubFeatures.jsString(`it's`),
);
check(
  "jsString: 역슬래시 이스케이프",
  PubFeatures.jsString(`a\\b`) === `a\\\\b`,
  PubFeatures.jsString(`a\\b`),
);
check(
  "jsString: 줄바꿈 제거",
  PubFeatures.jsString("a\nb") === "a b",
  PubFeatures.jsString("a\nb"),
);
check("jsString: null 은 빈 문자열", PubFeatures.jsString(null) === "");

summary();
