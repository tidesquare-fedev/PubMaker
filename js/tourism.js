// Tourism Tab Functionality

// DOM 요소들을 tourism.js 파일 상단에서 한 번만 찾도록 정의합니다.
const imageList = document.getElementById("image-list");
const addImageBtn = document.getElementById("add-image-btn");
const resetBtn = document.getElementById("reset-btn");
const generateBtn = document.getElementById("generate-btn");
const copyBtn = document.getElementById("copy-btn");
const previewIframe = document.getElementById("preview-iframe");
const toggleDebugAreas = document.getElementById("toggle-debug-areas");
const codeOutput = document.getElementById("code-output");
const imageMapSection = document.getElementById("image-map-section");
const mapperImage = document.getElementById("mapper-image");
const canvasContainer = document.getElementById("canvas-container");
const selectionBox = document.getElementById("selection-box");
const coordsInfo = document.getElementById("coords-info");
const mapperTitle = document.getElementById("mapper-title");
const applyAreaBtn = document.getElementById("apply-area-btn");
const cancelAreaBtn = document.getElementById("cancel-area-btn");
const anchorOffsetEnabled = document.getElementById(
  "tourism-anchor-offset-enabled",
);
const anchorOffsetInput = document.getElementById("tourism-anchor-offset");
const stickyPanel = document.getElementById("tourism-sticky-panel");
const tabSwitchPanel = document.getElementById("tourism-tabswitch-panel");
const tabScrollCountInput = document.getElementById("tourism-tabscroll-count");
const tabScrollTargetSelect = document.getElementById(
  "tourism-tabscroll-target",
);
const addTabScrollBtn = document.getElementById("add-tourism-tabscroll");
const platformMaxWidthInput = document.getElementById("platform-max-width");
const platformMaxWidthTarget = document.getElementById(
  "platform-max-width-target",
);
const platformMaxWidthHint = document.getElementById("platform-max-width-hint");

// 래퍼 최대 폭 — 플랫폼별로 따로 기억한다 (레퍼런스 기본값: PC 1200 / 모바일 900)
const DEFAULT_MAX_WIDTH = { pc: 1200, mo: 900 };
let platformMaxWidth = { ...DEFAULT_MAX_WIDTH };

function currentPlatform() {
  return document.querySelector('input[name="platform"]:checked').value;
}

// 선택된 플랫폼의 값을 입력칸에 반영
function syncMaxWidthInput() {
  if (!platformMaxWidthInput) return;
  const platform = currentPlatform();
  platformMaxWidthInput.value = platformMaxWidth[platform];
  if (platformMaxWidthTarget)
    platformMaxWidthTarget.textContent = platform === "pc" ? "PC" : "모바일";
  if (platformMaxWidthHint) {
    // 좌우 여백은 비율(16.66667%)이라 최대 폭을 바꾸면 함께 줄고 늘어난다.
    platformMaxWidthHint.textContent =
      platform === "pc"
        ? `좌우 여백 사용 시 이미지 실폭 ${Math.round(
            platformMaxWidth.pc * (2 / 3),
          )}px`
        : "";
  }
}

// 스티키 탭 설정 (이미지 목록 전체에 걸치는 값)
let tourismSticky = {
  enabled: false,
  menuId: "menu",
  maxWidth: 900,
  headerOffset: 0,
  tabs: [],
};
// 탭 콘텐츠 전환 설정
let tourismTabSwitch = { groups: [] };

let imageCounter = 0;
let isFirstClick = true;
let activeMappingInfo = null;
let firstClickCoords = null;
let dragState = null; // {mode: 'move'|'resize', startX, startY, startRect, dir}

// 스티키 탭 설정 패널 — 코드 블록은 URL 이 입력된 이미지만으로 만들어진다.
function renderStickyPanel() {
  const withUrl = Array.from(imageList.querySelectorAll(".image-url")).filter(
    (input) => input.value.trim(),
  ).length;
  PubFeatures.renderStickyTabPanel(
    stickyPanel,
    tourismSticky,
    withUrl,
    (_state, needsRerender) => {
      if (needsRerender) renderStickyPanel();
      renderPreview();
    },
  );
}

// 탭 스크롤 세트를 넣을 대상 이미지 선택지 갱신
function renderTabScrollTargets() {
  if (!tabScrollTargetSelect) return;
  const prev = tabScrollTargetSelect.value;
  const rows = Array.from(imageList.querySelectorAll(".image-row"));
  tabScrollTargetSelect.innerHTML = rows
    .map((row, i) => {
      const url = row.querySelector(".image-url").value.trim();
      const label = url
        ? `이미지 #${i + 1} 부터`
        : `이미지 #${i + 1} 부터 (URL 없음)`;
      return `<option value="${i}">${label}</option>`;
    })
    .join("");
  if (prev && Number(prev) < rows.length) tabScrollTargetSelect.value = prev;
}

// 탭 콘텐츠 전환 설정 패널
function renderTabSwitchPanel() {
  const withUrl = Array.from(imageList.querySelectorAll(".image-url")).filter(
    (input) => input.value.trim(),
  ).length;
  PubFeatures.renderTabSwitchPanel(
    tabSwitchPanel,
    tourismTabSwitch,
    withUrl,
    (_state, needsRerender) => {
      if (needsRerender) renderTabSwitchPanel();
      renderPreview();
    },
  );
}

// 이미지 목록이 바뀌면 이에 의존하는 UI 를 함께 갱신한다.
function refreshImageDependentUI() {
  renderStickyPanel();
  renderTabScrollTargets();
  renderTabSwitchPanel();
}

// 영역 설정 버튼의 3가지 상태
//   none    : 아직 좌표 없음
//   pending : 좌표가 기본값으로 채워졌을 뿐 사용자가 잡은 적 없음 (세트 자동 생성)
//   done    : 매퍼에서 직접 지정하고 '적용'까지 누름
const AREA_BUTTON_STYLE = {
  none: ["bg-indigo-500", "hover:bg-indigo-600"],
  pending: ["bg-amber-500", "hover:bg-amber-600"],
  done: ["bg-green-500", "hover:bg-green-600"],
};

function setAreaState(buttonRow, state) {
  const btn = buttonRow?.querySelector(".set-area-btn");
  if (!btn) return;
  btn.dataset.areaState = state;
  refreshAreaButton(buttonRow);
}

// 상태 + 요소 타입에 맞춰 문구와 색을 다시 칠한다.
function refreshAreaButton(buttonRow) {
  const btn = buttonRow.querySelector(".set-area-btn");
  if (!btn) return;
  const state = btn.dataset.areaState || "none";
  const isSection = buttonRow.querySelector(".button-type").value === "section";
  const what = isSection ? "세로 위치" : "영역";

  btn.textContent =
    state === "done"
      ? `✅ ${what} 설정 완료`
      : state === "pending"
        ? `📍 기본 ${what} — 조정 필요`
        : `${what} 설정하기`;

  Object.values(AREA_BUTTON_STYLE)
    .flat()
    .forEach((cls) => btn.classList.remove(cls));
  AREA_BUTTON_STYLE[state].forEach((cls) => btn.classList.add(cls));
}

/**
 * 탭 스크롤 세트.
 * 투어비스는 섹션마다 이미지를 나눠 등록하므로, 시작 이미지부터 N장에
 * 각각 "섹션 마커 1개 + 탭 메뉴 한 벌(N개 링크)" 을 넣는다.
 * (스티키 탭은 탭 메뉴가 하나뿐이라는 점이 다르다.)
 */
function addTourismTabScrollSet(count, startIndex) {
  const rows = Array.from(imageList.querySelectorAll(".image-row"));
  const n = Math.max(2, Math.min(Number(count) || 2, 6));
  const start = Math.max(0, Number(startIndex) || 0);

  if (rows.length - start < n) {
    alert(
      `탭 ${n}개는 이미지 ${n}장이 필요합니다.\n` +
        `시작 이미지(#${start + 1})는 탭 1이 되고 다음 이미지가 탭 2… 로 이어지는데, ` +
        `#${start + 1} 부터 ${rows.length - start}장뿐입니다.\n\n` +
        `이미지를 더 추가하거나 탭 개수를 줄여주세요.`,
    );
    return;
  }

  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
  const width = (100 / n).toFixed(2);

  const push = (imageRow, coords, type, id, field) => {
    const buttons = JSON.parse(imageRow.dataset.buttons);
    buttons.push({ coords });
    imageRow.dataset.buttons = JSON.stringify(buttons);
    const row = addButtonConfigRow(imageRow, buttons.length - 1, type);
    row.querySelector(field).value = id;
    updateConfigRowTitle(row);
    // 좌표는 기본값일 뿐 사용자가 잡은 것이 아니므로 '완료'로 표시하지 않는다.
    setAreaState(row, "pending");
  };

  ids.forEach((sectionId, s) => {
    const imageRow = rows[start + s];

    // 섹션 마커: 이미지 최상단 (가로 전체 폭 / 높이 1px)
    push(
      imageRow,
      {
        left: "0.00",
        top: "0.00",
        bottom: "99.00",
        width: "100.00",
        height: "1.00",
      },
      "section",
      sectionId,
      ".section-id",
    );

    // 이 이미지(=섹션) 상단의 탭 메뉴 한 벌
    const top = 1;
    const height = 6;
    ids.forEach((targetId, t) => {
      push(
        imageRow,
        {
          left: (t * Number(width)).toFixed(2),
          top: top.toFixed(2),
          bottom: (100 - top - height).toFixed(2),
          width,
          height: height.toFixed(2),
        },
        "anchor",
        targetId,
        ".anchor-id",
      );
    });
  });

  renderPreview();
}

// 앱 초기화 함수
function initializeApp() {
  imageList.innerHTML = "";
  imageCounter = 0;
  addImageRow();
  imageMapSection.classList.add("hidden");
  codeOutput.value = "";
  previewIframe.srcdoc = "about:blank";
  mapperImage.src = "";
  document.getElementById("platform-pc").checked = true;
  platformMaxWidth = { ...DEFAULT_MAX_WIDTH };
  syncMaxWidthInput();
  activeMappingInfo = null;
  tourismSticky = {
    enabled: false,
    menuId: "menu",
    maxWidth: 900,
    headerOffset: 0,
    tabs: [],
  };
  tourismTabSwitch = { groups: [] };
  if (anchorOffsetEnabled) anchorOffsetEnabled.checked = false;
  if (anchorOffsetInput) anchorOffsetInput.value = "0";
  refreshImageDependentUI();
}

// 이미지 입력 행 추가 함수
function addImageRow() {
  imageCounter++;
  const div = document.createElement("div");
  div.className = "p-4 border rounded-lg bg-gray-50 image-row";
  div.dataset.buttons = JSON.stringify([]);
  div.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <label class="font-semibold text-gray-700">이미지 #${imageCounter}</label>
            <button class="remove-btn text-red-500 hover:text-red-700 text-sm font-bold">삭제</button>
        </div>
        <div class="space-y-3">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                <input type="text" placeholder="https://example.com/image.jpg" class="image-url w-full p-2 border border-gray-300 rounded-md">
            </div>
            <div class="flex items-start space-x-4">
                <img src="" class="thumbnail-preview mt-1 hidden">
                <div class="flex-grow">
                    <div class="flex items-center space-x-2">
                        <label class="text-sm">배경색:</label>
                        <input type="color" value="#FFFFFF" class="bg-color w-10 h-8 border-0 cursor-pointer rounded">
                        <input type="text" placeholder="#FFFFFF" class="bg-color-text w-full p-2 border border-gray-300 rounded-md text-sm">
                        <button class="eyedropper-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-2 rounded text-xs" title="화면에서 색상 선택">스포이드</button>
                        <button class="extract-from-image-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-2 rounded text-xs" title="이미지에서 대표색 추출">이미지 색 추출</button>
                    </div>
                </div>
            </div>
            <div class="buttons-container border-t border-gray-200 mt-3 pt-3 space-y-3"></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button class="add-new-button-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-lg transition-colors duration-300 text-sm">
                    + 버튼
                </button>
                <button class="add-video-btn bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-3 rounded-lg transition-colors duration-300 text-sm">
                    + 영상
                </button>
                <button class="add-anchor-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-3 rounded-lg transition-colors duration-300 text-sm">
                    + 앵커 이동
                </button>
                <button class="add-section-btn bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded-lg transition-colors duration-300 text-sm">
                    + 섹션 시작점
                </button>
            </div>
            <p class="text-sm text-gray-500 mt-2">
                <b>앵커 이동</b>·<b>섹션 시작점</b>은 <b>탭 스크롤을 이루는 부품</b>입니다.
                탭 메뉴를 만들 때는 아래 <b>탭 스크롤</b>의 <b>세트 추가</b>가 이 둘을 한 번에 만들어 주니
                그쪽을 쓰고, 여기서는 <b>탭과 무관한 낱개 앵커</b>(예: "혜택 보러가기 ↓", TOP 버튼)를 만들 때 쓰세요.
                <b>스티키 탭</b>은 링크와 도착 지점을 스스로 만들므로 따로 추가할 필요가 없습니다.
            </p>
        </div>
    `;
  imageList.appendChild(div);

  div.querySelector(".remove-btn").addEventListener("click", () => {
    div.remove();
    renderPreview();
    refreshImageDependentUI();
  });
  div.querySelector(".image-url").addEventListener("input", handleUrlInput);

  // 타입별 추가 버튼 — 모두 같은 "요소" 행을 만들되 타입만 미리 지정한다.
  const addElement = (presetType) => (e) => {
    const imageRow = e.target.closest(".image-row");
    const buttons = JSON.parse(imageRow.dataset.buttons);
    buttons.push({});
    imageRow.dataset.buttons = JSON.stringify(buttons);
    addButtonConfigRow(imageRow, buttons.length - 1, presetType);
  };
  div
    .querySelector(".add-new-button-btn")
    .addEventListener("click", addElement("booking"));
  div
    .querySelector(".add-video-btn")
    .addEventListener("click", addElement("video"));
  div
    .querySelector(".add-anchor-btn")
    .addEventListener("click", addElement("anchor"));
  div
    .querySelector(".add-section-btn")
    .addEventListener("click", addElement("section"));

  // 배경색 입력 동기화/스포이드/이미지 추출 이벤트
  const bgColorInput = div.querySelector(".bg-color");
  const bgColorText = div.querySelector(".bg-color-text");
  const eyedropperBtn = div.querySelector(".eyedropper-btn");
  const extractBtn = div.querySelector(".extract-from-image-btn");

  bgColorInput.addEventListener("input", () => {
    setRowBgColor(div, bgColorInput.value);
  });
  bgColorText.addEventListener("change", () => {
    const hex = normalizeHex(bgColorText.value);
    if (hex) setRowBgColor(div, hex);
  });
  bgColorText.addEventListener("input", () => {
    const hex = normalizeHex(bgColorText.value, true);
    if (hex) bgColorInput.value = hex;
    renderPreview();
  });

  eyedropperBtn.addEventListener("click", async () => {
    if (!("EyeDropper" in window)) {
      alert("이 브라우저는 스포이드를 지원하지 않습니다. Chrome 95+ 권장");
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      setRowBgColor(div, result.sRGBHex);
    } catch (_) {
      /* 사용자가 취소 */
    }
  });

  extractBtn.addEventListener("click", () => {
    const url = div.querySelector(".image-url").value.trim();
    if (!url) {
      alert("먼저 이미지 URL을 입력하세요.");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = 50,
        h = 50; // 저해상도 축소로 평균 속도 개선
      canvas.width = w;
      canvas.height = h;
      // cover 방식으로 중앙 채우기 후 평균
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      const data = ctx.getImageData(0, 0, w, h).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      const hex = rgbToHex(r, g, b);
      setRowBgColor(div, hex);
    };
    img.onerror = () => {
      alert(
        "이미지에서 색을 추출할 수 없습니다. CORS 허용이 필요할 수 있습니다.",
      );
    };
  });
}

// 요소(버튼/영상/앵커/섹션) 설정 UI 추가 함수
function addButtonConfigRow(imageRow, buttonIndex, presetType = "booking") {
  const buttonsContainer = imageRow.querySelector(".buttons-container");
  const buttonDiv = document.createElement("div");
  buttonDiv.className = "p-3 border rounded-md bg-white button-config-row";
  buttonDiv.dataset.buttonIndex = buttonIndex;
  buttonDiv.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <p class="config-row-title font-semibold text-gray-700">요소 #${buttonIndex + 1}</p>
            <button class="remove-button-btn text-red-500 hover:text-red-700 text-xs font-bold">삭제</button>
        </div>
        <div class="space-y-2">
            <button class="set-area-btn w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">영역 설정하기</button>
            <label class="block text-sm font-medium text-gray-700">요소 타입</label>
            <select class="button-type w-full p-2 border border-gray-300 rounded-md">
                <option value="booking">항공권 예약하기</option>
                <option value="appNotification">앱 알림 설정</option>
                <option value="link">단순 링크</option>
                <option value="anchor">앵커 이동 (탭)</option>
                <option value="section">섹션 시작점 (앵커 대상)</option>
                <option value="video">영상</option>
            </select>
            <div class="booking-fields">
                <label class="block text-sm font-medium text-gray-700">항공사 코드</label>
                <input type="text" placeholder="예: 7C" class="airline-code w-full p-2 border border-gray-300 rounded-md">
            </div>
            <div class="link-fields hidden">
                <label class="block text-sm font-medium text-gray-700">연결 URL</label>
                <input type="text" placeholder="https://..." class="link-url w-full p-2 border border-gray-300 rounded-md">
                <div class="mt-2">
                    <label class="block text-sm font-medium text-gray-700">열기 방식</label>
                    <select class="link-target w-full p-2 border border-gray-300 rounded-md">
                        <option value="_blank" selected>새 창(탭)</option>
                        <option value="_self">현재 페이지 이동</option>
                    </select>
                </div>
            </div>
            <div class="anchor-fields hidden">
                <label class="block text-sm font-medium text-gray-700">이동할 섹션 ID</label>
                <input type="text" placeholder="예: a" class="anchor-id w-full p-2 border border-gray-300 rounded-md font-mono">
            </div>
            <div class="section-fields hidden">
                <label class="block text-sm font-medium text-gray-700">섹션 ID</label>
                <input type="text" placeholder="예: a" class="section-id w-full p-2 border border-gray-300 rounded-md font-mono">
                <p class="text-sm text-gray-500 mt-1"><b>시작점(세로 위치)만</b> 사용됩니다. 영역의 크기는 무시되고 박스의 <b>윗변</b>만 좌표로 쓰이며, <span class="font-mono">width:100%; height:1px</span> 로 출력됩니다.<br>탭을 눌렀을 때 화면 맨 위에 걸릴 지점 — 보통 <b>탭메뉴 윗변</b>에 맞춥니다.</p>
            </div>
            <div class="video-fields hidden">
                <label class="block text-sm font-medium text-gray-700">영상 종류</label>
                <select class="video-kind w-full p-2 border border-gray-300 rounded-md">
                    <option value="youtube">유튜브</option>
                    <option value="mp4">MP4</option>
                </select>
                <div class="mt-2">
                    <label class="block text-sm font-medium text-gray-700">영상 URL</label>
                    <input type="text" placeholder="유튜브 URL 또는 MP4 파일 URL" class="video-src w-full p-2 border border-gray-300 rounded-md font-mono text-sm">
                </div>
                <div class="video-scale-wrap mt-2 hidden">
                    <label class="block text-sm font-medium text-gray-700">확대 비율 (%)</label>
                    <input type="number" min="100" max="400" step="10" value="100" class="video-scale w-full p-2 border border-gray-300 rounded-md">
                    <p class="text-sm text-gray-500 mt-1">100 초과 시 영상 상하가 잘립니다.</p>
                </div>
                <div class="flex flex-wrap gap-3 text-sm text-gray-700 mt-2">
                    <label class="flex items-center gap-1"><input type="checkbox" class="video-autoplay" checked> 자동재생</label>
                    <label class="flex items-center gap-1"><input type="checkbox" class="video-muted" checked> 음소거</label>
                    <label class="flex items-center gap-1"><input type="checkbox" class="video-loop" checked> 반복</label>
                    <label class="flex items-center gap-1"><input type="checkbox" class="video-controls"> 컨트롤 표시</label>
                </div>
            </div>
        </div>
    `;
  buttonsContainer.appendChild(buttonDiv);

  buttonDiv
    .querySelector(".set-area-btn")
    .addEventListener("click", handleSetAreaClick);
  buttonDiv
    .querySelector(".button-type")
    .addEventListener("change", handleButtonTypeChange);
  buttonDiv.querySelector(".video-kind").addEventListener("change", (e) => {
    // 확대 비율은 mp4 에서만 의미가 있다.
    e.target
      .closest(".video-fields")
      .querySelector(".video-scale-wrap")
      .classList.toggle("hidden", e.target.value !== "mp4");
    updateConfigRowTitle(e.target.closest(".button-config-row"));
    renderPreview();
  });
  buttonDiv
    .querySelectorAll(
      ".video-fields input, .anchor-fields input, .section-fields input",
    )
    .forEach((input) => {
      input.addEventListener(
        input.type === "checkbox" ? "change" : "input",
        (e) => {
          // 앵커/섹션 ID 는 요소 제목에도 드러난다.
          updateConfigRowTitle(e.target.closest(".button-config-row"));
          renderPreview();
        },
      );
    });
  buttonDiv
    .querySelector(".remove-button-btn")
    .addEventListener("click", (e) => {
      const btnRow = e.target.closest(".button-config-row");
      const imgRow = e.target.closest(".image-row");
      const idx = parseInt(btnRow.dataset.buttonIndex, 10);

      const buttons = JSON.parse(imgRow.dataset.buttons);
      buttons.splice(idx, 1);
      imgRow.dataset.buttons = JSON.stringify(buttons);

      // 전체를 다시 그리면 나머지 행의 타입/URL 설정이 날아간다.
      // 해당 행만 제거하고 남은 행의 번호만 다시 매긴다.
      btnRow.remove();
      imgRow.querySelectorAll(".button-config-row").forEach((row, i) => {
        row.dataset.buttonIndex = i;
        updateConfigRowTitle(row);
      });
      renderPreview();
    });

  // 추가 버튼에서 지정한 타입을 반영
  const typeSelect = buttonDiv.querySelector(".button-type");
  typeSelect.value = presetType;
  buttonDiv.querySelector(".set-area-btn").dataset.areaState = "none";
  applyButtonTypeVisibility(buttonDiv, presetType);

  return buttonDiv;
}

const ELEMENT_TYPE_LABEL = {
  booking: "항공권 예약",
  appNotification: "앱 알림 설정",
  link: "링크",
  anchor: "앵커 이동",
  section: "섹션 시작점",
  video: "영상",
};

// 요소 제목에 종류와 대상 ID 를 드러낸다.
// (탭 스크롤 세트는 한 이미지에 섹션 1 + 탭 링크 N 개를 만들기 때문에
//  번호만으로는 무엇이 무엇인지 알 수 없다.)
function updateConfigRowTitle(buttonRow) {
  const title = buttonRow.querySelector(".config-row-title");
  if (!title) return;
  const index = Number(buttonRow.dataset.buttonIndex) + 1;
  const type = buttonRow.querySelector(".button-type").value;
  let detail = ELEMENT_TYPE_LABEL[type] || "";

  if (type === "anchor") {
    const id = buttonRow.querySelector(".anchor-id").value.trim();
    if (id) detail += ` → #${id.replace(/^#/, "")}`;
  } else if (type === "section") {
    const id = buttonRow.querySelector(".section-id").value.trim();
    if (id) detail += ` #${id.replace(/^#/, "")}`;
  } else if (type === "video") {
    detail +=
      buttonRow.querySelector(".video-kind").value === "mp4"
        ? " (MP4)"
        : " (유튜브)";
  }

  title.textContent = `요소 #${index} · ${detail}`;
}

// 요소 타입에 따라 입력 필드 묶음 표시/숨김
function applyButtonTypeVisibility(buttonRow, type) {
  const groups = {
    booking: ".booking-fields",
    link: ".link-fields",
    anchor: ".anchor-fields",
    section: ".section-fields",
    video: ".video-fields",
  };
  Object.entries(groups).forEach(([key, selector]) => {
    buttonRow.querySelector(selector).classList.toggle("hidden", key !== type);
  });
  // 섹션은 세로 위치만 쓰므로 문구가 달라진다. 상태(none/pending/done)는 유지.
  refreshAreaButton(buttonRow);
  updateConfigRowTitle(buttonRow);
}

// 버튼 타입 변경 핸들러
function handleButtonTypeChange(e) {
  applyButtonTypeVisibility(
    e.target.closest(".button-config-row"),
    e.target.value,
  );
  renderPreview();
}

// '영역 설정' 버튼 클릭 핸들러
function handleSetAreaClick(e) {
  const buttonRow = e.target.closest(".button-config-row");
  const imageRow = e.target.closest(".image-row");
  const buttonIndex = parseInt(buttonRow.dataset.buttonIndex, 10);
  const imageUrl = imageRow.querySelector(".image-url").value.trim();

  if (imageUrl) {
    // http/https만 허용
    if (!/^https?:\/\//i.test(imageUrl)) {
      alert(
        "유효한 이미지 URL이 아닙니다. https:// 로 시작하는 경로를 입력해주세요.",
      );
      return;
    }
    activeMappingInfo = { row: imageRow, buttonIndex: buttonIndex };
    try {
      mapperImage.removeAttribute("crossorigin");
    } catch (_) {}
    // 어느 요소를 편집 중인지 제목에 드러낸다 (요소가 많으면 헷갈린다).
    if (mapperTitle) {
      const title = buttonRow.querySelector(".config-row-title")?.textContent;
      mapperTitle.textContent = title
        ? `2. 영역 설정 — ${title.trim()}`
        : "2. 버튼 영역 설정";
    }
    imageMapSection.classList.remove("hidden");
    coordsInfo.textContent = "이미지 로딩 중...";
    // 캐시 버스트로 강제 로드
    const bust = (imageUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    mapperImage.src = imageUrl + bust;
  } else {
    alert("버튼 영역을 설정하려면 먼저 이미지 URL을 입력해주세요.");
  }
}

// URL 입력 핸들러
function handleUrlInput(e) {
  const url = e.target.value.trim();
  const row = e.target.closest(".image-row");
  const thumbnail = row.querySelector(".thumbnail-preview");

  if (url) {
    thumbnail.src = url;
    thumbnail.classList.remove("hidden");
  } else {
    thumbnail.classList.add("hidden");
  }
  // 이미지 입력 시 즉시 미리보기 업데이트
  renderPreview();
  // 스티키 탭의 "시작 이미지" 선택지는 URL 이 입력된 이미지 수에 따라 달라진다.
  refreshImageDependentUI();
}

// 영역 설정 이미지 로드 완료 핸들러
mapperImage.onload = () => {
  if (!activeMappingInfo) return;
  coordsInfo.textContent =
    "박스를 드래그해 위치를 잡고, 모서리로 크기를 조절하세요. 적용을 눌러 저장합니다.";
  isFirstClick = true; // deprecated but kept for minimal changes
  firstClickCoords = null;
  // 초기 박스를 이미지의 중앙 40% 크기로 표시
  const rect = mapperImage.getBoundingClientRect();
  const initWidth = rect.width * 0.4;
  const initHeight = rect.height * 0.2;
  const initLeft = (rect.width - initWidth) / 2;
  const initTop = (rect.height - initHeight) / 2;
  Object.assign(selectionBox.style, {
    display: "block",
    left: `${initLeft}px`,
    top: `${initTop}px`,
    width: `${initWidth}px`,
    height: `${initHeight}px`,
  });
  window.scrollTo({ top: imageMapSection.offsetTop, behavior: "smooth" });
};

// 영역 설정 이미지 로드 에러 핸들러 (중복 알림 방지 및 비차단 방식)
let lastImageErrorUrl = null;
mapperImage.onerror = () => {
  const failedUrl = mapperImage.src;
  if (lastImageErrorUrl !== failedUrl) {
    coordsInfo.textContent =
      "이미지를 불러올 수 없습니다. CORS/URL 문제일 수 있습니다. 이미지 직접 링크(JPG/PNG 등)인지 확인하거나, 다른 호스팅(예: postimages.org)으로 업로드 후 다시 시도해 주세요.";
    lastImageErrorUrl = failedUrl;
  }
  selectionBox.style.display = "none";
  activeMappingInfo = null;
};

// 영역 지정(클릭) 이벤트 핸들러
// 드래그로 박스 이동/리사이즈
function getBoxRect() {
  return {
    left: parseFloat(selectionBox.style.left || "0"),
    top: parseFloat(selectionBox.style.top || "0"),
    width: parseFloat(selectionBox.style.width || "0"),
    height: parseFloat(selectionBox.style.height || "0"),
  };
}

function clampBox(rectPx) {
  const imgRect = mapperImage.getBoundingClientRect();
  const maxLeft = imgRect.width - rectPx.width;
  const maxTop = imgRect.height - rectPx.height;
  rectPx.left = Math.max(0, Math.min(rectPx.left, Math.max(0, maxLeft)));
  rectPx.top = Math.max(0, Math.min(rectPx.top, Math.max(0, maxTop)));
  rectPx.width = Math.max(
    1,
    Math.min(rectPx.width, imgRect.width - rectPx.left),
  );
  rectPx.height = Math.max(
    1,
    Math.min(rectPx.height, imgRect.height - rectPx.top),
  );
  return rectPx;
}

canvasContainer.addEventListener("mousedown", (e) => {
  if (!activeMappingInfo) return;
  const target = e.target;
  const imgRect = mapperImage.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const startRect = getBoxRect();
  if (target.classList.contains("handle")) {
    dragState = {
      mode: "resize",
      dir: target.dataset.dir,
      startX,
      startY,
      startRect,
    };
  } else {
    // 이동 모드 (selectionBox 또는 이미지 영역 클릭)
    dragState = { mode: "move", startX, startY, startRect };
  }
  canvasContainer.classList.add("dragging");
  e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
  if (!dragState || !activeMappingInfo) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  let r = { ...dragState.startRect };
  if (dragState.mode === "move") {
    r.left += dx;
    r.top += dy;
  } else if (dragState.mode === "resize") {
    const dir = dragState.dir;
    if (dir.includes("e")) r.width += dx;
    if (dir.includes("s")) r.height += dy;
    if (dir.includes("w")) {
      r.left += dx;
      r.width -= dx;
    }
    if (dir.includes("n")) {
      r.top += dy;
      r.height -= dy;
    }
  }
  r = clampBox(r);
  Object.assign(selectionBox.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
});

window.addEventListener("mouseup", () => {
  if (!dragState) return;
  dragState = null;
  canvasContainer.classList.remove("dragging");
});

// 저장에 성공하면 true. 이미지를 못 재면 좌표가 NaN 이 되므로 저장하지 않는다.
function saveSelectionToRow() {
  const rect = mapperImage.getBoundingClientRect();
  const imgW = mapperImage.naturalWidth;
  const imgH = mapperImage.naturalHeight;
  if (!rect.width || !rect.height || !imgW || !imgH) {
    alert(
      "이미지 크기를 읽지 못해 영역을 저장할 수 없습니다.\n" +
        "이미지가 완전히 보인 뒤 다시 시도해주세요.",
    );
    return false;
  }
  const scaleX = imgW / rect.width;
  const scaleY = imgH / rect.height;
  const px = getBoxRect();
  const x1 = px.left * scaleX;
  const y1 = px.top * scaleY;
  const x2 = (px.left + px.width) * scaleX;
  const y2 = (px.top + px.height) * scaleY;

  const coords = {
    left: ((x1 / imgW) * 100).toFixed(2),
    bottom: (((imgH - y2) / imgH) * 100).toFixed(2),
    // 영상/섹션은 top 기준 좌표가 필요하다.
    top: ((y1 / imgH) * 100).toFixed(2),
    width: (((x2 - x1) / imgW) * 100).toFixed(2),
    height: (((y2 - y1) / imgH) * 100).toFixed(2),
    // mp4 aspect-ratio 산출용 원본 픽셀 크기
    nW: imgW,
    nH: imgH,
  };
  const { row, buttonIndex } = activeMappingInfo;
  const buttons = JSON.parse(row.dataset.buttons);
  buttons[buttonIndex].coords = coords;
  row.dataset.buttons = JSON.stringify(buttons);
  setAreaState(row.querySelectorAll(".button-config-row")[buttonIndex], "done");
  return true;
}

applyAreaBtn.addEventListener("click", () => {
  // 이미지 로드에 실패하면 onerror 가 대상 정보를 지운다.
  // 그대로 두면 '적용'이 아무 반응 없이 삼켜져 버튼이 계속 미설정으로 남는다.
  if (!activeMappingInfo) {
    alert(
      "영역을 저장할 대상이 없습니다.\n" +
        "이미지를 불러오지 못했을 수 있습니다. 이미지 URL을 확인한 뒤 " +
        "'영역 설정하기'를 다시 눌러주세요.",
    );
    imageMapSection.classList.add("hidden");
    return;
  }
  if (!saveSelectionToRow()) return;
  imageMapSection.classList.add("hidden");
  activeMappingInfo = null;
  renderPreview();
});

cancelAreaBtn.addEventListener("click", () => {
  imageMapSection.classList.add("hidden");
  activeMappingInfo = null;
});

// PC 좌우 여백 — 레퍼런스의 "1200px 래퍼에 200px" 을 비율로 환산한 값(200/1200).
// px 대신 % 로 두면 래퍼 폭이 달라져도 이미지 실폭이 항상 2/3 로 유지된다.
const PC_SIDE_PADDING_PCT = 16.66667;

/**
 * PC 좌우 여백이 붙은 블록의 오버레이 가로 좌표 환산.
 *
 * absolute 오버레이의 % 는 컨테이닝 블록의 **padding box**(=래퍼 전체 폭) 기준인데,
 * 영역 설정 매퍼는 **이미지** 기준으로 좌표를 잰다. 여백이 있으면 둘이 어긋나므로
 * 이미지 기준 % 를 래퍼 기준 % 로 바꿔준다.
 *
 * 여백이 좌우 16.66667% 씩이므로 이미지는 래퍼의 2/3,
 * 이미지 시작점은 래퍼의 16.66667% 지점이다.
 *   left 5% / width 90%  →  left 20% / width 60%   (레퍼런스와 동일)
 *
 * 세로(top·bottom·height)는 상하 여백이 없으므로 그대로 둔다.
 */
function toWrapperX(coords, hasSidePadding) {
  if (!hasSidePadding) return { left: coords.left, width: coords.width };
  const scale = (100 - PC_SIDE_PADDING_PCT * 2) / 100;
  return {
    left: (PC_SIDE_PADDING_PCT + parseFloat(coords.left) * scale).toFixed(2),
    width: (parseFloat(coords.width) * scale).toFixed(2),
    scale,
  };
}

// 오버레이 태그 1개 생성 — 코드 생성과 미리보기가 공유한다.
function buildOverlayTag(configRow, btn, platform, hasSidePadding) {
  const type = configRow.querySelector(".button-type").value;
  const c = btn.coords;
  // 예전에 저장된 좌표에는 top 이 없으므로 bottom/height 로 환산한다.
  const top =
    c.top != null
      ? c.top
      : (100 - parseFloat(c.bottom || 0) - parseFloat(c.height || 0)).toFixed(
          2,
        );
  const x = toWrapperX(c, hasSidePadding);
  const style = `position: absolute; bottom: ${c.bottom}%; left: ${x.left}%; width: ${x.width}%; height: ${c.height}%; text-indent: -9999px; font-size: 0`;

  if (type === "booking") {
    const airlineCode = configRow.querySelector(".airline-code").value;
    const jsFunc = platform === "pc" ? "promoFixPop" : "compactPopOpen";
    return `<a data-map-anchor="true" style="${style}" href="javascript:${jsFunc}('${airlineCode}');">항공권 예약하기</a>`;
  }

  if (type === "appNotification") {
    const onclick =
      "try { " +
      "var agent = navigator.userAgent.toLowerCase(); " +
      "var isApp = agent.indexOf('tourvis_') > -1; " +
      "var isIOS = agent.indexOf('iphone') > -1 || agent.indexOf('ipad') > -1 || agent.indexOf('ipod') > -1; " +
      "var isAndroid = agent.match('android') != null; " +
      "var memberNo = typeof getCookie === 'function' && getCookie('custId') != null ? getCookie('custId') : ''; " +
      "if (isApp && memberNo != '') { " +
      "if (isIOS && typeof webkit !== 'undefined' && webkit.messageHandlers && webkit.messageHandlers.observe) { webkit.messageHandlers.observe.postMessage('tourvis://Preference?memberNo=' + memberNo); } " +
      "else if (isAndroid) { window.location = 'tourvis://Preference?memberNo=' + memberNo; } " +
      "} } catch (e) {} return false;";
    return `<a data-map-anchor="true" style="${style}" href="javascript:void(0)" onclick="${onclick}">앱 알림 설정</a>`;
  }

  if (type === "anchor") {
    const id = PubFeatures.normalizeAnchorId(
      configRow.querySelector(".anchor-id").value,
      "a",
    );
    return `<a data-map-anchor="true" style="${style}" href="#${id}">탭 이동</a>`;
  }

  if (type === "section") {
    const id = PubFeatures.normalizeAnchorId(
      configRow.querySelector(".section-id").value,
      "a",
    );
    return PubFeatures.buildSectionMarker(id, top, "");
  }

  if (type === "video") {
    const src = configRow.querySelector(".video-src").value.trim();
    if (!src) return "";
    const video = {
      videoKind: configRow.querySelector(".video-kind").value,
      videoSrc: src,
      videoScale: Number(configRow.querySelector(".video-scale").value) || 100,
      videoAutoplay: configRow.querySelector(".video-autoplay").checked,
      videoMuted: configRow.querySelector(".video-muted").checked,
      videoLoop: configRow.querySelector(".video-loop").checked,
      videoControls: configRow.querySelector(".video-controls").checked,
    };
    // mp4 의 aspect-ratio 는 "가로% × 원본폭" 으로 계산된다.
    // 가로% 를 래퍼 기준으로 환산했다면 원본폭도 같은 비율로 되돌려야 실제 픽셀 폭이 유지된다.
    const naturalW = c.nW ? c.nW / (x.scale || 1) : c.nW;
    return PubFeatures.buildVideoOverlay(
      video,
      { left: x.left, top, width: x.width, height: c.height },
      { w: naturalW, h: c.nH },
      "",
    );
  }

  const linkUrl = configRow.querySelector(".link-url").value;
  const linkTarget = configRow.querySelector(".link-target")?.value || "_blank";
  return `<a data-map-anchor="true" style="${style}" href="${linkUrl}" target="${linkTarget}">단순 링크</a>`;
}

// 이미지 행 → HTML 블록 배열. requireCoords=true 면 좌표 미설정 버튼도 포함(검증은 별도).
function buildImageBlocks(platform, skipMissingCoords) {
  const blocks = [];
  let hasAnchor = false;

  imageList.querySelectorAll(".image-row").forEach((row) => {
    const imageUrl = row.querySelector(".image-url").value.trim();
    if (!imageUrl) return;
    const bgColor = row.querySelector(".bg-color-text").value;
    const buttons = JSON.parse(row.dataset.buttons || "[]");
    const buttonConfigRows = row.querySelectorAll(".button-config-row");
    // PC + 배경색일 때만 좌우 여백이 붙고, 그때 오버레이 가로 좌표를 환산해야 한다.
    const hasSidePadding =
      platform === "pc" && bgColor && bgColor.toUpperCase() !== "#FFFFFF";

    let contentInsideDiv = `<img src="${imageUrl}" alt="" border="0" style="display: block; width: 100%" />`;

    buttons.forEach((btn, index) => {
      if (skipMissingCoords && !btn.coords) return;
      const configRow = buttonConfigRows[index];
      if (!configRow) return;
      if (configRow.querySelector(".button-type").value === "anchor") {
        hasAnchor = true;
      }
      const tag = buildOverlayTag(configRow, btn, platform, hasSidePadding);
      if (tag) contentInsideDiv += `\n        ${tag}`;
    });

    const paddingStyle =
      platform === "pc" ? `padding: 0 ${PC_SIDE_PADDING_PCT}%;` : "";
    const wrapperStyle = hasSidePadding
      ? `position: relative; ${paddingStyle} background: ${bgColor};`
      : bgColor && bgColor.toUpperCase() !== "#FFFFFF"
        ? `position: relative; background: ${bgColor};`
        : "position: relative;";

    blocks.push(
      `      <div style="${wrapperStyle}">\n        ${contentInsideDiv}\n      </div>`,
    );
  });

  return { blocks, hasAnchor };
}

// 전체 문서 조립 (스티키 탭 / 앵커 보정 스크립트 포함)
function buildFullHtml(platform, skipMissingCoords) {
  const { blocks, hasAnchor } = buildImageBlocks(platform, skipMissingCoords);

  // 두 기능은 같은 블록 범위를 감싸므로 동시에 적용할 수 없다. 콘텐츠 전환이 우선.
  const switchOn = PubFeatures.hasTabSwitch(tourismTabSwitch, blocks.length);
  const stickyOn =
    !switchOn && tourismSticky.enabled && tourismSticky.tabs.length > 0;

  const bodyContent = switchOn
    ? PubFeatures.wrapBlocksWithTabSwitch(blocks, tourismTabSwitch, "      ")
    : stickyOn
      ? PubFeatures.wrapBlocksWithStickyTabs(blocks, tourismSticky, "      ")
      : blocks.join("\n");

  const headExtras = [];
  const tailExtras = [];
  if (switchOn) {
    headExtras.push(
      PubFeatures.buildTabSwitchStyle(tourismTabSwitch, blocks.length),
    );
    tailExtras.push(PubFeatures.buildTabSwitchScript());
    if (hasAnchor) headExtras.push(PubFeatures.SMOOTH_SCROLL_STYLE);
  } else if (stickyOn) {
    headExtras.push(PubFeatures.buildStickyTabStyle());
    tailExtras.push(PubFeatures.buildStickyTabScript(tourismSticky));
  } else if (hasAnchor) {
    headExtras.push(PubFeatures.SMOOTH_SCROLL_STYLE);
  }
  if (!stickyOn && anchorOffsetEnabled?.checked) {
    tailExtras.push(
      PubFeatures.buildAnchorOffsetScript(Number(anchorOffsetInput.value) || 0),
    );
  }

  // 래퍼 규격은 레퍼런스(투어비스 항공 event_pc.html / event_mobile.html)를 따르되,
  // 최대 폭은 플랫폼 선택 옆 입력칸에서 받는다 (기본 PC 1200 / 모바일 900).
  //  - PC   : 좌우 여백 16.66667% 는 비율이라 최대 폭을 바꿔도 이미지 실폭이 2/3 로 유지된다.
  //           margin:0 auto 로 가운데 정렬 — 넓은 화면에서 본문이 왼쪽으로 쏠리지 않게 한다.
  //  - 모바일: 가운데 정렬 + 이미지 사이 여백 제거(line-height:0)
  const isPc = platform === "pc";
  const maxWidth = platformMaxWidth[platform] || DEFAULT_MAX_WIDTH[platform];
  const wrapStyle = isPc
    ? `position: relative; width: 100%; max-width: ${maxWidth}px; margin: 0 auto;`
    : `position: relative; max-width: ${maxWidth}px; margin: auto; line-height: 0; overflow: hidden;`;
  const bodyTag = isPc ? "<body>" : '<body style="margin: 0">';

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>프로모션 ${platform}</title>
${headExtras.length ? headExtras.join("\n") + "\n" : ""}  </head>
  ${bodyTag}
    <!-- 시작 -->
    <div class="new-pb-container event-wrap" style="${wrapStyle}">
${bodyContent}
    </div>
    <!-- 끝 -->
${tailExtras.length ? tailExtras.join("\n") + "\n" : ""}  </body>
</html>`;
}

// 미리보기용 스타일 주입 후 iframe 반영
function paintPreview(fullHtml) {
  const base = `html,body{margin:0;padding:0;} .new-pb-container,.event-wrap{line-height:0;font-size:0} .new-pb-container img{display:block;width:100%;height:auto;border:0}`;
  const debug = toggleDebugAreas?.checked
    ? ` [data-map-anchor]{outline:2px dashed rgba(220,38,38,.9); background: rgba(220,38,38,.2);} .section{outline:1px dashed rgba(124,58,237,.9);}`
    : "";
  const previewHtml = fullHtml.replace(
    "</head>",
    `\n<style> ${base}${debug} </style>\n</head>`,
  );
  previewIframe.srcdoc = previewHtml;
  bindIframeAutoHeight();
}

// 코드 생성 함수
function generateCode() {
  const platform = document.querySelector(
    'input[name="platform"]:checked',
  ).value;
  const imageRows = imageList.querySelectorAll(".image-row");

  let allChecksPassed = true;
  imageRows.forEach((row, index) => {
    if (!allChecksPassed) return;
    const imageUrl = row.querySelector(".image-url").value.trim();
    if (!imageUrl) {
      allChecksPassed = false;
      alert(`이미지 #${index + 1}의 URL을 입력해주세요.`);
      return;
    }
    const buttons = JSON.parse(row.dataset.buttons);
    buttons.forEach((btn, btnIndex) => {
      if (!btn.coords || !btn.coords.width) {
        allChecksPassed = false;
        alert(
          `이미지 #${index + 1}의 버튼 #${btnIndex + 1} 영역을 설정해주세요.`,
        );
      }
    });
  });
  if (!allChecksPassed) return;

  const fullHtml = buildFullHtml(platform, false);
  // 내보낼 코드는 항상 디버그 표시 없이 유지
  codeOutput.value = fullHtml;
  paintPreview(fullHtml);
}

// 즉시 미리보기 렌더링 (생성 버튼 없이)
function renderPreview() {
  const platform = document.querySelector(
    'input[name="platform"]:checked',
  ).value;
  // 좌표가 없는 버튼은 미리보기에서 건너뛴다.
  paintPreview(buildFullHtml(platform, true));
}

function bindIframeAutoHeight() {
  const recalc = () => {
    try {
      const doc = previewIframe.contentDocument;
      if (!doc) return;
      const height = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
      );
      previewIframe.style.height = `${height}px`;
      previewIframe.style.transform = "none";
    } catch (_) {}
  };
  // 초기 여러 회 재계산 (이미지 로딩 시점 보정)
  setTimeout(recalc, 30);
  setTimeout(recalc, 120);
  setTimeout(recalc, 300);
  const tick = setInterval(recalc, 400);
  setTimeout(() => clearInterval(tick), 2500);
  const doc = previewIframe.contentDocument;
  if (!doc) return;
  // 이미지 로드/에러 시 재계산
  Array.from(doc.images).forEach((img) => {
    if (!img.complete) {
      img.addEventListener("load", recalc, { once: true });
      img.addEventListener("error", recalc, { once: true });
    }
  });
  // DOM 변경 감지
  try {
    const mo = new MutationObserver(recalc);
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
  } catch (_) {}
  // 리사이즈 관찰
  if (window.ResizeObserver) {
    try {
      new ResizeObserver(recalc).observe(doc.documentElement);
    } catch (_) {}
  }
}

// 전역 이벤트 리스너
addImageBtn.addEventListener("click", () => {
  addImageRow();
  refreshImageDependentUI();
});
resetBtn.addEventListener("click", initializeApp);
generateBtn.addEventListener("click", generateCode);
anchorOffsetEnabled?.addEventListener("change", renderPreview);
anchorOffsetInput?.addEventListener("input", renderPreview);
toggleDebugAreas?.addEventListener("change", renderPreview);
// 플랫폼을 바꾸면 최대 폭 입력칸과 미리보기를 함께 갱신한다.
document.querySelectorAll('input[name="platform"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    syncMaxWidthInput();
    renderPreview();
  });
});
platformMaxWidthInput?.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  if (!value || value < 1) return;
  platformMaxWidth[currentPlatform()] = value;
  syncMaxWidthInput();
  renderPreview();
});
addTabScrollBtn?.addEventListener("click", () => {
  addTourismTabScrollSet(
    tabScrollCountInput?.value,
    tabScrollTargetSelect?.value,
  );
});
copyBtn.addEventListener("click", () => {
  const originalText = copyBtn.textContent;
  copyWithCRLF(
    codeOutput.value,
    () => {
      copyBtn.textContent = "복사 완료!";
      setTimeout(() => {
        copyBtn.textContent = "복사";
      }, 2000);
    },
    () => {
      alert("복사에 실패했습니다. 수동으로 Ctrl+C를 사용해 주세요.");
    },
  );
});

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});
