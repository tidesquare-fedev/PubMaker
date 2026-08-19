// 공통 기능 모듈: 탭 스크롤 / 스티키 탭 / 영상 첨부
// 투어비스 · 베네피아 · SKT 3개 생성기 탭이 공유한다.
// 전역에 PubFeatures 하나만 노출.

const PubFeatures = (() => {
  // ---------------------------------------------------------------- 공통 유틸

  // 이미지가 아직 배치되지 않은 상태에서 0 으로 나누면 NaN/Infinity 가 나올 수 있다.
  // 코드에 NaN% 가 새어나가지 않도록 여기서 한 번에 막는다.
  function pct(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  // 영역 좌표 → % 사각형. benefia/skt/tourism 에 흩어져 있던 로직 통합.
  function toPctRect(area, nW, nH) {
    if (area.coordsPct) {
      return {
        left: pct(area.coordsPct.x1 * 100),
        top: pct(area.coordsPct.y1 * 100),
        width: pct((area.coordsPct.x2 - area.coordsPct.x1) * 100),
        height: pct((area.coordsPct.y2 - area.coordsPct.y1) * 100),
      };
    }
    if (area.coords && nW && nH) {
      const { x1, y1, x2, y2 } = area.coords;
      return {
        left: pct((x1 / nW) * 100),
        top: pct((y1 / nH) * 100),
        width: pct(((x2 - x1) / nW) * 100),
        height: pct(((y2 - y1) / nH) * 100),
      };
    }
    return { left: "0", top: "0", width: "0", height: "0" };
  }

  function escAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 앵커 ID 정규화: 선행 '#' 제거 + 공백을 '-' 로
  function normalizeAnchorId(value, fallback = "anchor") {
    const v = String(value || "")
      .replace(/^#/, "")
      .trim()
      .replace(/\s+/g, "-");
    return v || fallback;
  }

  // ---------------------------------------------------------------- 영상 첨부

  // 유튜브 URL(watch / youtu.be / embed / shorts) 또는 11자 ID → ID
  function parseYoutubeId(input) {
    const s = String(input || "").trim();
    if (!s) return "";
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|live\/|watch\?v=|.*[?&]v=))([A-Za-z0-9_-]{11})/,
    );
    return m ? m[1] : "";
  }

  // 영상 기본 옵션
  function videoDefaults(video) {
    return {
      kind: video.videoKind || "youtube",
      src: video.videoSrc || "",
      scale: Number(video.videoScale) > 0 ? Number(video.videoScale) : 100,
      autoplay: video.videoAutoplay !== false,
      muted: video.videoMuted !== false,
      loop: video.videoLoop !== false,
      controls: video.videoControls === true,
    };
  }

  /**
   * 이미지 위 %좌표 영상 오버레이 HTML 생성.
   * @param {object} video  영역 객체 (videoKind / videoSrc / videoScale / videoAutoplay ...)
   * @param {object} rect   { left, top, width, height } — % 문자열
   * @param {object} natural { w, h } 이미지 원본 픽셀 크기 (mp4 aspect-ratio 계산용, 없으면 폴백)
   * @param {string} indent 들여쓰기
   */
  function buildVideoOverlay(video, rect, natural, indent = "      ") {
    const o = videoDefaults(video);
    const pad = indent;
    const pad2 = indent + "  ";
    const pad3 = indent + "    ";

    if (o.kind === "mp4") {
      // 바깥 박스는 aspect-ratio 로 비율을 고정하는 편이 반응형에서 안정적이다.
      let boxRatio = "";
      if (natural && natural.w && natural.h) {
        const wPx = Math.round((parseFloat(rect.width) / 100) * natural.w);
        const hPx = Math.round((parseFloat(rect.height) / 100) * natural.h);
        if (wPx > 0 && hPx > 0) boxRatio = `aspect-ratio: ${wPx}/${hPx}; `;
      }
      const sizeStyle = boxRatio || `height: ${rect.height}%; `;
      const attrs = [
        o.autoplay ? "autoplay" : "",
        o.loop ? "loop" : "",
        o.muted ? "muted" : "",
        "playsinline",
        o.controls ? "controls" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return (
        `${pad}<div style="position: absolute; width: ${rect.width}%; left: ${rect.left}%; ${sizeStyle}top: ${rect.top}%; overflow: hidden">\n` +
        `${pad2}<div class="emped-vide" style="position: absolute; width: 100%; height: ${o.scale}%; top: 50%; left: 0; right: 0; transform: translateY(-50%)">\n` +
        `${pad3}<video ${attrs} style="width: 100%; height: 100%">\n` +
        `${pad3}  <source src="${escAttr(o.src)}" type="video/mp4" />\n` +
        `${pad3}</video>\n` +
        `${pad2}</div>\n` +
        `${pad}</div>`
      );
    }

    // 유튜브
    const id = parseYoutubeId(o.src);
    const params = [];
    if (o.autoplay) params.push("autoplay=1");
    if (o.muted) params.push("mute=1");
    // loop 는 playlist 파라미터가 동반되어야 실제로 반복된다.
    if (o.loop) params.push("loop=1", `playlist=${id}`);
    if (!o.controls) params.push("controls=0");
    const query = params.length ? `?${params.join("&")}` : "";
    const src = id
      ? `https://www.youtube.com/embed/${id}${query}`
      : escAttr(o.src);

    return (
      `${pad}<div style="position: absolute; width: ${rect.width}%; left: ${rect.left}%; height: ${rect.height}%; top: ${rect.top}%">\n` +
      `${pad2}<iframe style="position: absolute; width: 100%; left: 0; aspect-ratio: 560/315; top: 50%; transform: translateY(-50%)" src="${src}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n` +
      `${pad}</div>`
    );
  }

  // 영상 설정 입력 필드 HTML (베네피아/SKT 영역 목록, 투어비스 버튼 설정에서 공용)
  function renderVideoFields(video, dataIdAttr = "") {
    const o = videoDefaults(video);
    const idAttr = dataIdAttr ? ` data-id="${escAttr(dataIdAttr)}"` : "";
    const ck = (on) => (on ? "checked" : "");
    return `
      <div class="video-fields mt-2 space-y-2">
        <select class="w-full p-2 border rounded video-kind"${idAttr} data-field="videoKind">
          <option value="youtube" ${
            o.kind === "youtube" ? "selected" : ""
          }>유튜브</option>
          <option value="mp4" ${o.kind === "mp4" ? "selected" : ""}>MP4</option>
        </select>
        <input type="text" class="w-full p-2 border rounded video-src" placeholder="${
          o.kind === "mp4" ? "MP4 파일 URL" : "유튜브 URL 또는 영상 ID"
        }" value="${escAttr(o.src)}"${idAttr} data-field="videoSrc">
        ${
          o.kind === "mp4"
            ? `<label class="block text-sm text-gray-600">확대 비율 (%) — 100 초과 시 상하가 잘립니다
                 <input type="number" min="100" max="400" step="10" class="w-full p-2 border rounded mt-1 video-scale" value="${o.scale}"${idAttr} data-field="videoScale">
               </label>`
            : ""
        }
        <div class="flex flex-wrap gap-3 text-sm text-gray-700">
          <label class="flex items-center gap-1"><input type="checkbox" ${ck(
            o.autoplay,
          )}${idAttr} data-field="videoAutoplay"> 자동재생</label>
          <label class="flex items-center gap-1"><input type="checkbox" ${ck(
            o.muted,
          )}${idAttr} data-field="videoMuted"> 음소거</label>
          <label class="flex items-center gap-1"><input type="checkbox" ${ck(
            o.loop,
          )}${idAttr} data-field="videoLoop"> 반복</label>
          <label class="flex items-center gap-1"><input type="checkbox" ${ck(
            o.controls,
          )}${idAttr} data-field="videoControls"> 컨트롤 표시</label>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------- 탭 스크롤

  const SMOOTH_SCROLL_STYLE = `<style>\n  html { scroll-behavior: smooth; }\n</style>`;

  // 앵커 대상: 가로 전체 / 높이 1px — y(top%) 만 의미가 있다.
  function buildSectionMarker(id, topPct, indent = "      ") {
    const top = Number.isFinite(Number(topPct)) ? topPct : "0.00";
    return `${indent}<div class="section" id="${escAttr(
      normalizeAnchorId(id),
    )}" style="position:absolute; left:0; top:${top}%; width:100%; height:1px;"></div>`;
  }

  // 고정 헤더가 있는 페이지용 앵커 이동 보정 스크립트
  function buildAnchorOffsetScript(offsetPx = 0) {
    const offset = Number(offsetPx) || 0;
    return `<script>
(function () {
  var OFFSET = ${offset};
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href === '#') return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    var y = window.pageYOffset + target.getBoundingClientRect().top - OFFSET;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, false);
})();
<\/script>`;
  }

  // --------------------------------------------------------- 앱 알림 설정
  // 투어비스 하이브리드 앱 안에서 열렸을 때만 동작하는 알림 설정 딥링크.
  // 웹 브라우저에서는 스킴을 처리할 주체가 없으므로 아무 일도 일어나지 않는다.
  //
  // 규격 (사내 하이브리드 앱 웹 개발 가이드)
  //   UA 식별자   tourvis_
  //   회원번호    쿠키 custId (고정)
  //   안드로이드  window.location = 'tourvis://Preference?memberNo=' + 회원번호
  //   iOS         webkit.messageHandlers.observe.postMessage(같은 스킴)
  //
  // 프리비아(priviatravel://)는 규격이 다르지만 이 생성기의 대상이 아니라 넣지 않는다.

  /**
   * 앱 알림 설정 스크립트 (모바일 코드에만 한 번 출력).
   *
   * 버튼은 href 에 앱 설치 링크를 들고 있고, 이 함수는 앱 안일 때만 끼어들어
   * 딥링크를 쏘고 false 를 돌려 href 이동을 막는다. 앱이 아니면 true 를 돌려
   * 브라우저가 그대로 설치 링크로 가게 둔다.
   *
   * 앱은 모바일 전용이라 PC 페이지가 앱 안에서 열릴 일이 없다.
   * 그래서 PC 는 이 스크립트 없이 설치 링크로 가는 단순 링크만 출력한다.
   */
  function buildAppNotifyScript() {
    return `<script>
// 앱 알림 설정 — 앱 안이면 알림 설정 화면을 열고, 아니면 href(앱 설치 링크)로 갑니다.
function pubAppNotify() {
  // 페이지에 getCookie 가 있으면 그것을 쓰고, 없으면 직접 읽는다.
  function readCookie(name) {
    if (typeof getCookie === 'function') {
      var v = getCookie(name);
      return v == null ? '' : v;
    }
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  var agent = navigator.userAgent.toLowerCase();
  var isApp = agent.indexOf('tourvis_') > -1;
  var isIOS = agent.indexOf('iphone') > -1 || agent.indexOf('ipad') > -1 || agent.indexOf('ipod') > -1;
  var isAndroid = agent.indexOf('android') > -1;
  var scheme = 'tourvis://Preference?memberNo=';

  // 앱이 아니면 href 로 진행 — 앱 설치 링크로 이동한다.
  if (!isApp) return true;

  // 앱 안인데 미로그인이면 회원번호가 없다. 이미 앱이므로 설치 링크로 보내지 않는다.
  var memberNo = readCookie('custId');
  if (memberNo === '') return false;

  if (isIOS) {
    // 앱이 주입하는 핸들러. 없으면 조용히 넘어간다(스크립트 오류 방지).
    if (window.webkit && webkit.messageHandlers && webkit.messageHandlers.observe) {
      webkit.messageHandlers.observe.postMessage(scheme + memberNo);
    }
  } else if (isAndroid) {
    window.location = scheme + memberNo;
  }
  return false;
}
<\/script>`;
  }

  // 인라인 onclick 안에 들어갈 JS 문자열 리터럴 이스케이프
  function jsString(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/[\r\n]+/g, " ");
  }

  // ------------------------------------------------------------- 스티키 탭

  // 파일명 끝의 _on / _off 만 안전하게 치환 (경로 중간의 '_' 를 건드리지 않는다)
  function swapOnOff(url, state) {
    if (!url) return "";
    const next = url.replace(
      /_(on|off)(\.[A-Za-z0-9]+)(\?.*)?$/,
      `_${state}$2$3`,
    );
    if (next !== url) return next;
    // _on/_off 규칙이 없는 URL 은 그대로 둔다.
    return url;
  }

  function stickyDefaults(sticky) {
    return {
      enabled: !!(sticky && sticky.enabled),
      menuId: (sticky && sticky.menuId) || "menu",
      maxWidth: Number(sticky && sticky.maxWidth) || 800,
      // 0 이면 스크립트가 header 류 요소를 찾아 자동 측정한다.
      headerOffset: Math.max(0, Number(sticky && sticky.headerOffset) || 0),
      tabs: (sticky && sticky.tabs) || [],
    };
  }

  // 생성기마다 래퍼 클래스가 달라(.event-wrap / .content) .tab-box 기준으로 스코프한다.
  function buildStickyTabStyle() {
    return `<style>
  html { scroll-behavior: smooth; }
  /* fixed 는 뷰포트 기준이라 left/right:0 으로 두면 body·컨테이너의 padding/margin 을
     무시하고 화면 끝까지 퍼진다. 좌표는 스크립트가 고정 직전의 실제 위치를 재서 넣는다. */
  .tab-box.fix { position: fixed !important; top: 0; z-index: 10; box-sizing: border-box; }
  .tab-box ul.on-off { display: flex; justify-content: space-between; width: 100%; margin: 0; padding: 0; list-style: none; box-sizing: border-box; }
  .tab-box ul.on-off li a { display: block; }
  .tab-box img { display: block; width: 100%; border: 0; }
</style>`;
  }

  function buildStickyTabBar(sticky, indent = "  ") {
    const s = stickyDefaults(sticky);
    if (!s.tabs.length) return "";
    const width = (100 / s.tabs.length).toFixed(4);
    const items = s.tabs
      .map((tab, i) => {
        // 첫 탭만 활성(_on), 나머지는 _off. 이후 전환은 스크립트가 담당한다.
        const src = swapOnOff(tab.offUrl || "", i === 0 ? "on" : "off");
        const cls = i === 0 ? ' class="on"' : "";
        const alt = escAttr(tab.label || "");
        return `${indent}    <li${cls} style="width: ${width}%;"><a href="#${escAttr(
          normalizeAnchorId(tab.id, `tab${i + 1}`),
        )}" class="tab-btn"><img src="${escAttr(
          src,
        )}" style="max-width:100%;" alt="${alt}"></a></li>`;
      })
      .join("\n");

    return `${indent}<div id="${escAttr(
      s.menuId,
    )}" class="tab-box" style="position: relative; z-index: 5; max-width: ${
      s.maxWidth
    }px; margin: 0 auto; line-height: 0;">
${indent}  <ul class="on-off">
${items}
${indent}  </ul>
${indent}</div>`;
  }

  function buildStickyTabScript(sticky) {
    const s = stickyDefaults(sticky);
    return `<script>
(function () {
  var menu = document.getElementById('${s.menuId}');
  if (!menu) return;

  var tabAreas = [].slice.call(document.querySelectorAll('.tab-area'));
  var items = [].slice.call(menu.querySelectorAll('li'));
  // 탭바가 고정될 때 생기는 레이아웃 점프를 스페이서로 흡수한다.
  var spacer = document.createElement('div');
  spacer.style.display = 'none';
  menu.parentNode.insertBefore(spacer, menu);

  // 0 이면 아래에서 header 류 요소를 찾아 자동 측정한다.
  var HEADER_OFFSET = ${s.headerOffset};

  var baseTop = 0;
  // 고정되지 않은 상태에서 잰 탭바의 실제 가로 위치·폭.
  // body/컨테이너의 padding·margin 이 이미 반영된 값이라 그대로 쓰면 축이 맞는다.
  var baseLeft = 0;
  var baseWidth = 0;
  var fixed = false;
  var activeIndex = -1;

  function headerHeight() {
    if (HEADER_OFFSET > 0) return HEADER_OFFSET;
    var h = document.querySelector('header')
         || document.querySelector('.content-header')
         || document.querySelector('.sub-page-tit-area');
    return h ? h.clientHeight : 0;
  }

  function swapOnOff(src, state) {
    return String(src || '').replace(/_(on|off)(\\.[A-Za-z0-9]+)(\\?.*)?$/, '_' + state + '$2$3');
  }

  function setActive(idx) {
    if (idx === activeIndex) return;
    activeIndex = idx;
    for (var i = 0; i < items.length; i++) {
      var on = (i === idx);
      if (on) items[i].classList.add('on');
      else items[i].classList.remove('on');
      var img = items[i].querySelector('img');
      if (!img) continue;
      var src = img.getAttribute('src');
      var next = swapOnOff(src, on ? 'on' : 'off');
      if (next !== src) img.setAttribute('src', next);
    }
  }

  // 가로 스크롤이 있어도 어긋나지 않도록 문서 좌표 → 뷰포트 좌표로 바꿔 넣는다.
  function syncGeometry() {
    menu.style.left = (baseLeft - window.pageXOffset) + 'px';
    menu.style.width = baseWidth + 'px';
  }

  function hold() {
    if (fixed) return;
    spacer.style.height = menu.offsetHeight + 'px';
    spacer.style.display = 'block';
    menu.classList.add('fix');
    syncGeometry();
    fixed = true;
  }

  function release() {
    if (!fixed) return;
    menu.classList.remove('fix');
    menu.style.top = '';
    menu.style.left = '';
    menu.style.width = '';
    spacer.style.display = 'none';
    fixed = false;
  }

  function measure() {
    var wasFixed = fixed;
    if (wasFixed) release();
    var rect = menu.getBoundingClientRect();
    baseTop = window.pageYOffset + rect.top;
    baseLeft = window.pageXOffset + rect.left;
    baseWidth = rect.width;
    if (wasFixed) hold();
  }

  function onScroll() {
    var top = headerHeight();
    if (window.pageYOffset >= baseTop - top) {
      hold();
      menu.style.top = top + 'px';
      syncGeometry();
      var idx = 0;
      for (var i = 0; i < tabAreas.length; i++) {
        var y = window.pageYOffset + tabAreas[i].getBoundingClientRect().top - menu.offsetHeight - top - 10;
        if (window.pageYOffset >= y) idx = i;
      }
      setActive(idx);
    } else {
      release();
      setActive(0);
    }
  }

  menu.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    e.preventDefault();
    var target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    var y = window.pageYOffset + target.getBoundingClientRect().top - menu.offsetHeight - headerHeight();
    window.scrollTo(0, y);
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });
  window.addEventListener('load', function () { measure(); onScroll(); });

  measure();
  onScroll();
})();
<\/script>`;
  }

  /**
   * 스티키 탭 설정 패널 렌더러 — 3개 생성기 탭이 공유.
   * @param {HTMLElement} root      패널이 그려질 컨테이너
   * @param {object} state          { enabled, menuId, maxWidth, tabs:[{id,label,offUrl,startIndex}] }
   * @param {number} imageCount     현재 이미지 개수 (시작 이미지 select 구성용)
   * @param {function} onChange     상태 변경 콜백
   */
  function renderStickyTabPanel(root, state, imageCount, onChange) {
    if (!root) return;
    const s = stickyDefaults(state);
    state.enabled = s.enabled;
    state.menuId = s.menuId;
    state.maxWidth = s.maxWidth;
    state.headerOffset = s.headerOffset;
    state.tabs = s.tabs;

    const imageOptions = (selected) => {
      let out = "";
      for (let i = 0; i < Math.max(imageCount, 1); i++) {
        out += `<option value="${i}" ${
          Number(selected) === i ? "selected" : ""
        }>이미지 #${i + 1}</option>`;
      }
      return out;
    };

    root.innerHTML = `
      <label class="flex items-center gap-2 font-semibold text-gray-800">
        <input type="checkbox" class="sticky-enabled w-4 h-4" ${
          s.enabled ? "checked" : ""
        }>
        스티키 탭 사용
      </label>
      <div class="sticky-body mt-3 space-y-3 ${s.enabled ? "" : "hidden"}">
        <div class="grid grid-cols-3 gap-2">
          <label class="text-sm text-gray-600">탭바 ID
            <input type="text" class="sticky-menu-id w-full p-2 border rounded mt-1" value="${escAttr(
              s.menuId,
            )}">
          </label>
          <label class="text-sm text-gray-600">최대 폭 (px)
            <input type="number" class="sticky-max-width w-full p-2 border rounded mt-1" value="${
              s.maxWidth
            }">
          </label>
          <label class="text-sm text-gray-600">헤더 높이 보정 (px)
            <input type="number" min="0" class="sticky-header-offset w-full p-2 border rounded mt-1" value="${
              s.headerOffset
            }">
          </label>
        </div>
        <p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠️ <b>최대 폭은 페이지 최대 폭과 같은 값</b>으로 맞춰주세요.
          값이 다르면 탭바만 본문보다 넓거나 좁아 보입니다.
          (고정될 때의 좌우 위치는 스크립트가 실제 위치를 재서 맞추므로,
          바깥 컨테이너에 <span class="font-mono">padding</span>·<span class="font-mono">margin</span>이 있어도
          스크롤하는 순간 어긋나지는 않습니다.)
        </p>
        <p class="text-sm text-gray-500">
          <b>헤더 높이 보정</b>은 게시 페이지 상단에 <b>고정 헤더(GNB)가 있을 때</b> 그 높이(px)를 넣습니다.
          탭바가 헤더 아래에 붙고, 탭을 눌렀을 때도 그만큼 여유를 두고 멈춥니다.
          <b>0 이면 자동 측정</b>(<span class="font-mono">header</span> ·
          <span class="font-mono">.content-header</span> ·
          <span class="font-mono">.sub-page-tit-area</span> 순으로 탐색)하므로,
          자동으로 못 잡거나 헤더가 없으면 그때 값을 직접 넣으세요.
        </p>
        <div class="sticky-tabs space-y-3">
          ${s.tabs
            .map(
              (tab, i) => `
            <div class="p-3 border rounded bg-white sticky-tab-row" data-index="${i}">
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold text-sm text-gray-700">탭 #${
                  i + 1
                }</span>
                <button class="sticky-remove-tab text-red-500 hover:text-red-700 text-xs font-bold">삭제</button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="text-sm text-gray-600">섹션 ID
                  <input type="text" class="sticky-tab-id w-full p-2 border rounded mt-1" placeholder="a" value="${escAttr(
                    tab.id || "",
                  )}">
                </label>
                <label class="text-sm text-gray-600">시작 이미지
                  <select class="sticky-tab-start w-full p-2 border rounded mt-1">${imageOptions(
                    tab.startIndex,
                  )}</select>
                </label>
              </div>
              <p class="text-sm text-gray-500 mt-1"><b>시작 이미지</b> = 이 탭을 눌렀을 때 도착할 이미지입니다.
                여기부터 다음 탭의 시작 이미지 직전까지가 이 탭의 구간이 됩니다.</p>
              <label class="block text-sm text-gray-600 mt-2">탭 이미지 URL (비활성 _off)
                <input type="text" class="sticky-tab-off w-full p-2 border rounded mt-1" placeholder="https://.../tab01_off.jpg" value="${escAttr(
                  tab.offUrl || "",
                )}">
              </label>
              <label class="block text-sm text-gray-600 mt-2">대체 텍스트
                <input type="text" class="sticky-tab-label w-full p-2 border rounded mt-1" value="${escAttr(
                  tab.label || "",
                )}">
              </label>
              <p class="text-sm text-gray-500 mt-1">입력은 <b>비활성(<span class="font-mono">_off</span>) 하나만</b> 하면 됩니다.
                활성 이미지는 <span class="font-mono">${escAttr(
                  swapOnOff(tab.offUrl || "", "on") || "_on",
                )}</span> 으로 자동 유추되므로,
                <b class="text-amber-700">이 주소에 실제 <span class="font-mono">_on</span> 이미지가 함께 올라가 있어야</b> 합니다.</p>
            </div>`,
            )
            .join("")}
        </div>
        <button class="sticky-add-tab w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ 탭 추가</button>
        <p class="text-sm text-gray-500">탭바는 <b>코드 출력</b>에 반영됩니다. 각 탭의 "시작 이미지"부터 다음 탭 시작 직전까지가 하나의 <span class="font-mono">.tab-area</span> 로 묶입니다.</p>
      </div>`;

    const fire = (rerender) => {
      if (onChange) onChange(state, rerender);
    };

    root.querySelector(".sticky-enabled").addEventListener("change", (e) => {
      state.enabled = e.target.checked;
      root
        .querySelector(".sticky-body")
        .classList.toggle("hidden", !state.enabled);
      fire(false);
    });
    root.querySelector(".sticky-menu-id").addEventListener("input", (e) => {
      state.menuId = e.target.value.trim() || "menu";
      fire(false);
    });
    root.querySelector(".sticky-max-width").addEventListener("input", (e) => {
      state.maxWidth = Number(e.target.value) || 800;
      fire(false);
    });
    root
      .querySelector(".sticky-header-offset")
      .addEventListener("input", (e) => {
        state.headerOffset = Math.max(0, Number(e.target.value) || 0);
        fire(false);
      });
    root.querySelector(".sticky-add-tab").addEventListener("click", () => {
      const next = state.tabs.length;
      state.tabs.push({
        id: String.fromCharCode(97 + next), // a, b, c ...
        label: `탭 ${next + 1}`,
        offUrl: "",
        startIndex: Math.min(next, Math.max(imageCount - 1, 0)),
      });
      fire(true);
    });
    root.querySelectorAll(".sticky-tab-row").forEach((row) => {
      const idx = Number(row.dataset.index);
      row.querySelector(".sticky-remove-tab").addEventListener("click", () => {
        state.tabs.splice(idx, 1);
        fire(true);
      });
      row.querySelector(".sticky-tab-id").addEventListener("input", (e) => {
        state.tabs[idx].id = e.target.value;
        fire(false);
      });
      row.querySelector(".sticky-tab-start").addEventListener("change", (e) => {
        state.tabs[idx].startIndex = Number(e.target.value);
        fire(false);
      });
      row.querySelector(".sticky-tab-off").addEventListener("input", (e) => {
        state.tabs[idx].offUrl = e.target.value.trim();
        fire(false);
      });
      row.querySelector(".sticky-tab-label").addEventListener("input", (e) => {
        state.tabs[idx].label = e.target.value;
        fire(false);
      });
    });
  }

  /**
   * 이미지 블록 배열을 스티키 탭 구조로 재구성한다.
   * @param {string[]} blocks  이미지 하나당 HTML 문자열
   * @param {object} sticky    스티키 탭 상태
   * @returns {string} 상단 + 탭바 + .tab-area 묶음 + 하단
   */
  function wrapBlocksWithStickyTabs(blocks, sticky, indent = "  ") {
    const s = stickyDefaults(sticky);
    const valid = s.tabs
      .map((tab, i) => ({
        ...tab,
        id: normalizeAnchorId(tab.id, `tab${i + 1}`),
        startIndex: Math.max(
          0,
          Math.min(Number(tab.startIndex) || 0, blocks.length),
        ),
      }))
      .sort((a, b) => a.startIndex - b.startIndex);

    if (!s.enabled || !valid.length) return blocks.join("\n");

    const head = blocks.slice(0, valid[0].startIndex);
    const sections = valid.map((tab, i) => {
      const end =
        i + 1 < valid.length ? valid[i + 1].startIndex : blocks.length;
      const inner = blocks.slice(tab.startIndex, end).join("\n");
      return `${indent}  <div id="${escAttr(
        tab.id,
      )}" class="tab-area">\n${inner}\n${indent}  </div>`;
    });

    const out = [];
    if (head.length) out.push(head.join("\n"));
    out.push(buildStickyTabBar({ ...s, tabs: valid }, indent));
    out.push(`${indent}<div style="position: relative">`);
    out.push(sections.join("\n"));
    out.push(`${indent}</div>`);
    return out.join("\n");
  }

  // -------------------------------------------------- 탭 콘텐츠 전환
  // 탭 스크롤/스티키 탭과 달리 콘텐츠를 이동하지 않고 **제자리에서 교체**한다.
  // (레퍼런스: 투어비스_호텔 51714 — .tab-mn / .tabCont.on)

  function tabSwitchDefaults(state) {
    return { groups: (state && state.groups) || [] };
  }

  // 그룹/탭 값을 정규화하고 인덱스 순으로 정렬한다.
  function normalizeTabSwitchGroups(state, blockCount) {
    const s = tabSwitchDefaults(state);
    const last = Math.max(blockCount - 1, 0);
    const clamp = (n) => Math.max(0, Math.min(Number(n) || 0, last));

    return s.groups
      .filter((g) => (g.tabs || []).length > 0)
      .map((g) => {
        const tabs = (g.tabs || [])
          .map((t) => ({ ...t, startIndex: clamp(t.startIndex) }))
          .sort((a, b) => a.startIndex - b.startIndex);
        const firstStart = tabs[0].startIndex;
        const lastStart = tabs[tabs.length - 1].startIndex;
        // 그룹 끝은 마지막 탭 시작보다 앞설 수 없다.
        const endIndex = Math.max(clamp(g.endIndex), lastStart);
        return { ...g, tabs, firstStart, endIndex };
      })
      .sort((a, b) => a.firstStart - b.firstStart);
  }

  function buildTabSwitchStyle(state, blockCount) {
    const groups = normalizeTabSwitchGroups(state, blockCount);
    if (!groups.length) return "";

    // 그룹·탭마다 활성 색이 다르므로 nth-child 규칙을 개별 생성한다.
    const colorRules = groups
      .map((g, gi) =>
        g.tabs
          .map((t, ti) => {
            const decls = [];
            if (t.activeBg) decls.push(`background-color: ${t.activeBg};`);
            if (t.activeColor) decls.push(`color: ${t.activeColor};`);
            if (!decls.length) return "";
            return `  .tab-switch-${gi + 1} .tab-mn li:nth-child(${
              ti + 1
            }).on a { ${decls.join(" ")} }`;
          })
          .filter(Boolean)
          .join("\n"),
      )
      .filter(Boolean)
      .join("\n");

    return `<style>
  .tab-switch .tab-mn { height: 50px; }
  .tab-switch .tab-mn ul { display: flex; align-items: center; justify-content: space-around; height: 100%; margin: 0; padding: 0; list-style: none; overflow: hidden; }
  .tab-switch .tab-mn li { width: 100%; height: 100%; text-align: center; }
  .tab-switch .tab-mn li a { display: flex; width: 100%; height: 100%; justify-content: center; align-items: center; font-size: 18px; color: #000; font-weight: 400; letter-spacing: -0.02em; text-decoration: none; }
  .tab-switch .tab-mn li.on a { font-weight: 700; }
  .tab-switch .tabCont { display: none; }
  .tab-switch .tabCont.on { display: block; }
  .tab-switch.is-image .tab-mn { height: auto; }
  .tab-switch.is-image .tab-mn li a { display: block; }
  .tab-switch.is-image .tab-mn img { display: block; width: 100%; border: 0; }
${colorRules}
</style>`;
  }

  function buildTabSwitchBar(group, groupNo, indent = "  ") {
    const isImage = group.buttonType === "image";
    const items = group.tabs
      .map((tab, i) => {
        const label = escAttr(tab.label || `탭 ${i + 1}`);
        const inner = isImage
          ? `<img src="${escAttr(
              swapOnOff(tab.offUrl || "", i === 0 ? "on" : "off"),
            )}" alt="${label}">`
          : label;
        return `${indent}    <li${
          i === 0 ? ' class="on"' : ""
        } data-tabnum="${i}"><a href="#" class="tabBtn">${inner}</a></li>`;
      })
      .join("\n");

    return `${indent}<div class="tab-mn">
${indent}  <ul>
${items}
${indent}  </ul>
${indent}</div>`;
  }

  function buildTabSwitchScript() {
    return `<script>
(function () {
  var groups = document.querySelectorAll('.tab-switch');

  function swapOnOff(src, state) {
    return String(src || '').replace(/_(on|off)(\\.[A-Za-z0-9]+)(\\?.*)?$/, '_' + state + '$2$3');
  }

  Array.prototype.forEach.call(groups, function (group) {
    var items = group.querySelectorAll('.tab-mn li');
    var conts = group.querySelectorAll('.tabCont');
    if (!items.length || !conts.length) return;

    function activate(index) {
      Array.prototype.forEach.call(items, function (li, i) {
        var on = (i === index);
        if (on) li.classList.add('on'); else li.classList.remove('on');
        var img = li.querySelector('img');
        if (!img) return;
        var src = img.getAttribute('src');
        var next = swapOnOff(src, on ? 'on' : 'off');
        if (next !== src) img.setAttribute('src', next);
      });
      for (var i = 0; i < conts.length; i++) {
        if (i === index) conts[i].classList.add('on');
        else conts[i].classList.remove('on');
      }
    }

    Array.prototype.forEach.call(items, function (li, i) {
      var link = li.querySelector('a');
      if (!link) return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        activate(i);
      });
    });
  });
})();
<\/script>`;
  }

  /**
   * 이미지 블록 배열을 탭 콘텐츠 전환 구조로 재구성한다.
   * 그룹 밖의 블록은 그대로 남고, 그룹 범위만 .tab-switch 로 감싼다.
   */
  function wrapBlocksWithTabSwitch(blocks, state, indent = "  ") {
    const groups = normalizeTabSwitchGroups(state, blocks.length);
    if (!groups.length) return blocks.join("\n");

    const out = [];
    let cursor = 0;

    groups.forEach((group, gi) => {
      // 그룹이 겹치면 앞선 그룹을 우선하고 남은 범위만 사용한다.
      const start = Math.max(group.firstStart, cursor);
      const end = Math.min(group.endIndex, blocks.length - 1);
      if (start > end) return;

      if (start > cursor) out.push(blocks.slice(cursor, start).join("\n"));

      const conts = group.tabs
        .map((tab, ti) => {
          const contStart = Math.max(tab.startIndex, start);
          const contEnd =
            ti + 1 < group.tabs.length
              ? group.tabs[ti + 1].startIndex - 1
              : end;
          if (contStart > contEnd) return "";
          const inner = blocks.slice(contStart, contEnd + 1).join("\n");
          return `${indent}  <div class="tabCont${
            ti === 0 ? " on" : ""
          }">\n${inner}\n${indent}  </div>`;
        })
        .filter(Boolean)
        .join("\n");

      out.push(
        `${indent}<div class="tab-switch tab-switch-${gi + 1}${
          group.buttonType === "image" ? " is-image" : ""
        }">\n${buildTabSwitchBar(
          group,
          gi + 1,
          indent + "  ",
        )}\n${conts}\n${indent}</div>`,
      );
      cursor = end + 1;
    });

    if (cursor < blocks.length) out.push(blocks.slice(cursor).join("\n"));
    return out.join("\n");
  }

  /**
   * 탭 콘텐츠 전환 설정 패널 — 3개 생성기 탭이 공유.
   * @param {HTMLElement} root
   * @param {object} state       { groups: [{ buttonType, endIndex, tabs: [...] }] }
   * @param {number} imageCount  코드 블록이 되는 이미지 개수
   * @param {function} onChange  (state, needsRerender) => void
   */
  function renderTabSwitchPanel(root, state, imageCount, onChange) {
    if (!root) return;
    state.groups = tabSwitchDefaults(state).groups;

    const imageOptions = (selected) => {
      let out = "";
      for (let i = 0; i < Math.max(imageCount, 1); i++) {
        out += `<option value="${i}" ${
          Number(selected) === i ? "selected" : ""
        }>이미지 #${i + 1}</option>`;
      }
      return out;
    };

    root.innerHTML = `
      <div class="tab-switch-groups space-y-4">
        ${state.groups
          .map((group, gi) => {
            const isImage = group.buttonType === "image";
            return `
          <div class="p-3 border rounded-lg bg-white tab-switch-group" data-index="${gi}">
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold text-gray-800">탭 그룹 #${gi + 1}</span>
              <button class="ts-remove-group text-red-500 hover:text-red-700 text-xs font-bold">그룹 삭제</button>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-3">
              <label class="text-sm text-gray-600">탭 버튼
                <select class="ts-button-type w-full p-2 border rounded mt-1">
                  <option value="text" ${
                    !isImage ? "selected" : ""
                  }>텍스트</option>
                  <option value="image" ${
                    isImage ? "selected" : ""
                  }>이미지</option>
                </select>
              </label>
              <label class="text-sm text-gray-600">그룹 끝 이미지
                <select class="ts-end-index w-full p-2 border rounded mt-1">${imageOptions(
                  group.endIndex,
                )}</select>
              </label>
            </div>
            <div class="space-y-2">
              ${(group.tabs || [])
                .map(
                  (tab, ti) => `
                <div class="p-2 border rounded bg-gray-50 ts-tab-row" data-tab-index="${ti}">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold text-gray-700">탭 #${
                      ti + 1
                    }</span>
                    <button class="ts-remove-tab text-red-500 hover:text-red-700 text-xs">삭제</button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="text-sm text-gray-600">${
                      isImage ? "대체 텍스트" : "탭 이름"
                    }
                      <input type="text" class="ts-label w-full p-2 border rounded mt-1 text-sm" value="${escAttr(
                        tab.label || "",
                      )}">
                    </label>
                    <label class="text-sm text-gray-600">시작 이미지
                      <select class="ts-start-index w-full p-2 border rounded mt-1 text-sm">${imageOptions(
                        tab.startIndex,
                      )}</select>
                    </label>
                  </div>
                  ${
                    isImage
                      ? `<label class="block text-sm text-gray-600 mt-2">탭 이미지 URL (비활성 _off)
                           <input type="text" class="ts-off-url w-full p-2 border rounded mt-1 text-sm" placeholder="https://.../tab01_off.jpg" value="${escAttr(
                             tab.offUrl || "",
                           )}">
                         </label>
                         <p class="text-sm text-gray-500 mt-1">입력은 <b>비활성(<span class="font-mono">_off</span>) 하나만</b> 하면 됩니다.
                           선택된 탭은 <span class="font-mono">${escAttr(
                             swapOnOff(tab.offUrl || "", "on") || "_on",
                           )}</span> 으로 바뀌므로,
                           <b class="text-amber-700">이 주소에 실제 <span class="font-mono">_on</span> 이미지가 함께 올라가 있어야</b> 합니다.</p>`
                      : `<div class="grid grid-cols-2 gap-2 mt-2">
                           <label class="text-sm text-gray-600">활성 배경색
                             <input type="text" class="ts-active-bg w-full p-2 border rounded mt-1 text-sm" placeholder="#f3e8d1" value="${escAttr(
                               tab.activeBg || "",
                             )}">
                           </label>
                           <label class="text-sm text-gray-600">활성 글자색
                             <input type="text" class="ts-active-color w-full p-2 border rounded mt-1 text-sm" placeholder="#000000" value="${escAttr(
                               tab.activeColor || "",
                             )}">
                           </label>
                         </div>`
                  }
                </div>`,
                )
                .join("")}
            </div>
            <button class="ts-add-tab w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg text-sm">+ 탭 추가</button>
          </div>`;
          })
          .join("")}
      </div>
      <button class="ts-add-group w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ 탭 그룹 추가</button>
      <p class="text-sm text-gray-500 mt-2">탭을 누르면 <b>스크롤 없이 아래 이미지 콘텐츠만 교체</b>됩니다.
        각 탭의 "시작 이미지"부터 다음 탭 시작 직전까지가 한 탭의 콘텐츠이고, 마지막 탭은 "그룹 끝 이미지"까지입니다.
        그룹 밖 이미지는 그대로 남습니다.</p>`;

    const fire = (rerender) => {
      if (onChange) onChange(state, rerender);
    };

    root.querySelector(".ts-add-group").addEventListener("click", () => {
      state.groups.push({
        buttonType: "text",
        endIndex: Math.max(imageCount - 1, 0),
        tabs: [
          { label: "탭 1", startIndex: 0, activeBg: "", activeColor: "" },
          {
            label: "탭 2",
            startIndex: Math.min(1, imageCount - 1),
            activeBg: "",
            activeColor: "",
          },
        ],
      });
      fire(true);
    });

    root.querySelectorAll(".tab-switch-group").forEach((groupEl) => {
      const gi = Number(groupEl.dataset.index);
      const group = state.groups[gi];

      groupEl
        .querySelector(".ts-remove-group")
        .addEventListener("click", () => {
          state.groups.splice(gi, 1);
          fire(true);
        });
      groupEl
        .querySelector(".ts-button-type")
        .addEventListener("change", (e) => {
          group.buttonType = e.target.value;
          fire(true); // 입력 필드 구성이 달라진다
        });
      groupEl.querySelector(".ts-end-index").addEventListener("change", (e) => {
        group.endIndex = Number(e.target.value);
        fire(false);
      });
      groupEl.querySelector(".ts-add-tab").addEventListener("click", () => {
        group.tabs.push({
          label: `탭 ${group.tabs.length + 1}`,
          startIndex: Math.min(group.tabs.length, Math.max(imageCount - 1, 0)),
          activeBg: "",
          activeColor: "",
          offUrl: "",
        });
        fire(true);
      });

      groupEl.querySelectorAll(".ts-tab-row").forEach((tabEl) => {
        const ti = Number(tabEl.dataset.tabIndex);
        const tab = group.tabs[ti];
        const bind = (selector, field, isSelect) => {
          const el = tabEl.querySelector(selector);
          if (!el) return;
          el.addEventListener(isSelect ? "change" : "input", (e) => {
            tab[field] = isSelect ? Number(e.target.value) : e.target.value;
            fire(false);
          });
        };
        tabEl.querySelector(".ts-remove-tab").addEventListener("click", () => {
          group.tabs.splice(ti, 1);
          fire(true);
        });
        bind(".ts-label", "label");
        bind(".ts-start-index", "startIndex", true);
        bind(".ts-off-url", "offUrl");
        bind(".ts-active-bg", "activeBg");
        bind(".ts-active-color", "activeColor");
      });
    });
  }

  // 탭 콘텐츠 전환이 실제로 출력될 상태인지
  function hasTabSwitch(state, blockCount) {
    return normalizeTabSwitchGroups(state, blockCount).length > 0;
  }

  return {
    toPctRect,
    escAttr,
    normalizeAnchorId,
    parseYoutubeId,
    buildVideoOverlay,
    renderVideoFields,
    SMOOTH_SCROLL_STYLE,
    buildSectionMarker,
    buildAnchorOffsetScript,
    buildAppNotifyScript,
    jsString,
    swapOnOff,
    buildStickyTabStyle,
    buildStickyTabBar,
    buildStickyTabScript,
    renderStickyTabPanel,
    wrapBlocksWithStickyTabs,
    buildTabSwitchStyle,
    buildTabSwitchBar,
    buildTabSwitchScript,
    wrapBlocksWithTabSwitch,
    renderTabSwitchPanel,
    hasTabSwitch,
  };
})();

// 다른 스크립트가 전역으로 참조하므로 window 에 명시적으로 노출한다.
// (const 는 전역 객체의 속성이 되지 않아 환경에 따라 참조가 끊길 수 있다.)
if (typeof window !== "undefined") window.PubFeatures = PubFeatures;
