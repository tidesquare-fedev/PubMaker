// SKT Tab Functionality

function initializeSktTab() {
  const sktAreas = document.getElementById("skt-areas");
  const sktPreview = document.getElementById("skt-preview");
  const sktCodeOutput = document.getElementById("skt-code-output");
  const copySktCodeBtn = document.getElementById("copy-skt-code");
  const generateSktCodeBtn = document.getElementById("generate-skt-code");
  const resetSktBtn = document.getElementById("reset-skt-btn");
  const sktAnchors = document.getElementById("skt-anchors");
  const addAnchorBtn = document.getElementById("add-skt-anchor-secondary");
  const addAreaAnchorBtn = document.getElementById("add-skt-area-anchor");
  const addAreaLinkBtn = document.getElementById("add-skt-area-link");
  const addAreaVideoBtn = document.getElementById("add-skt-area-video");
  const addTabScrollBtn = document.getElementById("add-skt-tabscroll");
  const tabScrollCountInput = document.getElementById("skt-tabscroll-count");
  const anchorOffsetEnabled = document.getElementById(
    "skt-anchor-offset-enabled",
  );
  const anchorOffsetInput = document.getElementById("skt-anchor-offset");
  const stickyPanel = document.getElementById("skt-sticky-panel");
  const tabSwitchPanel = document.getElementById("skt-tabswitch-panel");
  const sktImageRowsContainer = document.getElementById("skt-image-rows");
  const addSktRowBtn = document.getElementById("skt-add-image-row");

  // 스티키 탭 설정 (이미지 목록 전체에 걸치는 값)
  let stickyTab = {
    enabled: false,
    menuId: "menu",
    maxWidth: 800,
    headerOffset: 0,
    tabs: [],
  };
  // 탭 콘텐츠 전환 설정
  let tabSwitch = { groups: [] };

  let imageListState = []; // [{id, url, areas:[], anchors:[], tabs:[]}]
  let activeImageId = null; // 현재 편집 중인 이미지 ID
  let areas = [];
  let anchors = [];
  let tabs = []; // 탭 정보
  let imageUrl = "";
  let areaCounter = 0;
  let isDrawing = false;
  let startX,
    startY,
    currentArea = null;
  let isDraggingArea = false;
  let draggingAreaId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragOrigW = 0;
  let dragOrigH = 0;
  let imageElement = null;
  let imageRect = null;

  // helper: load natural size for an image url
  function loadImageMeta(item) {
    if (!item || !item.url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      item.naturalW = img.naturalWidth || img.width;
      item.naturalH = img.naturalHeight || img.height;
    };
    img.src = item.url;
  }

  // 활성 이미지 레코드 동기화
  function syncActiveRecord() {
    const idx = imageListState.findIndex((x) => x.id === activeImageId);
    if (idx >= 0) {
      imageListState[idx].url = imageUrl;
      imageListState[idx].areas = areas;
      imageListState[idx].anchors = anchors;
      imageListState[idx].tabs = tabs;
    }
  }

  // Create image preview container with selection functionality
  function createImagePreview() {
    if (!imageListState.length) {
      sktPreview.innerHTML =
        '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
      return;
    }

    // 활성 이미지가 없으면 첫 번째로 지정
    if (!activeImageId) {
      activeImageId = imageListState[0].id;
      imageUrl = imageListState[0].url || "";
      areas = imageListState[0].areas || [];
      anchors = imageListState[0].anchors || [];
      tabs = imageListState[0].tabs || [];
    }

    const blocksHtml = imageListState
      .map((item) => {
        const isActive = item.id === activeImageId;
        if (!isActive) {
          return `
                <div class="relative w-full overflow-hidden" style="background:#fff; text-align:left; line-height:0;">
                    <div class="relative" style="margin:0;">
                        ${
                          item.url
                            ? `<img src="${item.url}" alt="미리보기 이미지" style="display:block; width:100%; height:auto; border:0;">`
                            : '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>'
                        }
                    </div>
                </div>`;
        }

        return `
            <div class="relative w-full overflow-hidden" style="background:#fff; text-align:left; line-height:0;">
                <div id="skt-image-container" class="relative" style="margin:0;">
                    ${
                      imageUrl
                        ? `<img id="skt-image" src="${imageUrl}" alt="미리보기 이미지" style="display:block; width:100%; height:auto; border:0;">`
                        : '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>'
                    }
                    <div id="skt-selection" class="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none" style="display: none;"></div>
                    ${areas
                      .map((area, index) => {
                        const { x1, y1, x2, y2 } = area.coords;
                        const width = Math.abs(x2 - x1);
                        const height = Math.abs(y2 - y1);
                        const left = Math.min(x1, x2);
                        const top = Math.min(y1, y2);
                        const isAnchorArea =
                          area.type === "anchor" &&
                          area.href &&
                          area.href.startsWith("#");
                        const isTabArea = area.type === "tab";
                        const isVideoArea = area.type === "video";
                        const cls = isAnchorArea
                          ? "skt-anchor-box"
                          : isTabArea
                            ? "skt-tab-box"
                            : isVideoArea
                              ? "skt-video-box"
                              : "absolute border-2 border-red-500 bg-red-100 bg-opacity-30 flex items-center justify-center";
                        const labelHtml = isAnchorArea
                          ? `<span class=\"skt-anchor-label\">ANCHOR ${
                              area.href || ""
                            }</span>`
                          : isTabArea
                            ? `<span class=\"skt-tab-label\">TAB</span>`
                            : isVideoArea
                              ? `<span class=\"skt-video-label\">VIDEO ${
                                  area.videoKind === "mp4" ? "MP4" : "YOUTUBE"
                                }</span>`
                              : `<span class=\"bg-red-500 text-white text-xs px-1 rounded absolute -top-3 -left-px\">${
                                  index + 1
                                }</span>`;
                        return `<div class="${cls}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;" data-area-id="${area.id}">${labelHtml}
                            <div class=\"skt-handle nw\" data-dir=\"nw\"></div>
                            <div class=\"skt-handle n\" data-dir=\"n\"></div>
                            <div class=\"skt-handle ne\" data-dir=\"ne\"></div>
                            <div class=\"skt-handle e\" data-dir=\"e\"></div>
                            <div class=\"skt-handle se\" data-dir=\"se\"></div>
                            <div class=\"skt-handle s\" data-dir=\"s\"></div>
                            <div class=\"skt-handle sw\" data-dir=\"sw\"></div>
                            <div class=\"skt-handle w\" data-dir=\"w\"></div>
                            <button class="remove-area-btn absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" data-id="${area.id}">×</button>
                        </div>`;
                      })
                      .join("")}
                    ${anchors
                      .map((a) => {
                        const left = Math.round(a.x);
                        const top = Math.round(a.y);
                        // 코드에는 가로 전체 폭 섹션으로 나가므로 가이드 라인도 함께 표시
                        return `<div class="skt-section-line" style="top:${top}px"></div><div class="skt-anchor-pin" data-anchor-id="${a.id}" style="left:${left}px; top:${top}px" title="${a.id}"></div>`;
                      })
                      .join("")}
                </div>
                <div class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-sm p-1 rounded">영역을 선택하려면 이미지 위에서 드래그하세요</div>
            </div>`;
      })
      .join("");

    sktPreview.innerHTML = blocksHtml;

    // Get the image element and container
    imageElement = document.getElementById("skt-image");
    const container = document.getElementById("skt-image-container");
    const selection = document.getElementById("skt-selection");

    if (!imageElement) return;

    // Update image rectangle on load and resize
    const updateImageRect = () => {
      if (imageElement) {
        imageRect = imageElement.getBoundingClientRect();
        // Adjust for container offset
        const containerRect = container.getBoundingClientRect();
        imageRect = {
          left: imageRect.left - containerRect.left,
          top: imageRect.top - containerRect.top,
          width: imageRect.width,
          height: imageRect.height,
        };
      }
    };

    // Initial update (only when active image exists in DOM)
    if (imageElement) updateImageRect();

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateImageRect);
    resizeObserver.observe(container);

    // Update on image load
    imageElement.addEventListener("load", updateImageRect);

    // Mouse down handler (draw new, drag existing area, drag anchor)
    container.addEventListener("mousedown", (e) => {
      if (!imageElement) return;

      const containerRect = container.getBoundingClientRect();
      const anchorPin = e.target.closest("[data-anchor-id]");
      const overlay = e.target.closest("[data-area-id]");

      // Drag anchor pin
      if (anchorPin) {
        const id = anchorPin.getAttribute("data-anchor-id");
        const anc = anchors.find((x) => x.id === id);
        if (!anc) return;
        isDraggingArea = true;
        draggingAreaId = id;
        dragOrigW = 0;
        dragOrigH = 0;
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        dragOffsetX = mouseX - anc.x;
        dragOffsetY = mouseY - anc.y;
        e.preventDefault();
        return;
      }

      // Drag existing area
      if (overlay) {
        const areaId = overlay.getAttribute("data-area-id");
        const area = areas.find((a) => a.id === areaId);
        if (!area) return;

        // Determine if user grabbed a resize handle
        const handle = e.target.closest(".skt-handle");
        const { x1, y1, x2, y2 } = area.coords;
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        dragOrigW = Math.abs(x2 - x1);
        dragOrigH = Math.abs(y2 - y1);
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        if (handle) {
          // Resize mode
          const dir = handle.dataset.dir;
          isDraggingArea = true;
          draggingAreaId = areaId + "::resize::" + dir;
          dragOffsetX = mouseX;
          dragOffsetY = mouseY;
        } else {
          // Move mode
          isDraggingArea = true;
          draggingAreaId = areaId;
          dragOffsetX = mouseX - left;
          dragOffsetY = mouseY - top;
        }
        e.preventDefault();
        return;
      }

      // Draw new area (start on image)
      if (e.target !== imageElement) return;

      isDrawing = true;
      startX = e.clientX - containerRect.left;
      startY = e.clientY - containerRect.top;

      currentArea = {
        id: `area-${Date.now()}-${areaCounter++}`,
        type: "anchor",
        coords: { x1: startX, y1: startY, x2: startX, y2: startY },
        href: "#anchor",
        alt: "",
        target: "",
      };

      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = "0px";
      selection.style.height = "0px";
      selection.style.display = "block";

      e.preventDefault();
    });

    // Mouse move handler (draw or drag area/anchor)
    container.addEventListener("mousemove", (e) => {
      const containerRect = container.getBoundingClientRect();

      // Dragging existing area
      if (isDraggingArea && draggingAreaId) {
        // Try area first
        const areaIdOnly = draggingAreaId.split("::")[0];
        const area = areas.find((a) => a.id === areaIdOnly);
        const anchorHit = anchors.find((x) => x.id === draggingAreaId);

        let mouseX = e.clientX - containerRect.left;
        let mouseY = e.clientY - containerRect.top;
        if (area) {
          const parts = draggingAreaId.split("::");
          if (parts[1] === "resize") {
            // Resize logic based on direction
            const dir = parts[2];
            let { x1, y1, x2, y2 } = area.coords;
            let left = Math.min(x1, x2);
            let top = Math.min(y1, y2);
            let right = Math.max(x1, x2);
            let bottom = Math.max(y1, y2);

            if (dir.includes("e")) right = mouseX;
            if (dir.includes("s")) bottom = mouseY;
            if (dir.includes("w")) left = mouseX;
            if (dir.includes("n")) top = mouseY;

            // Clamp
            left = Math.max(
              imageRect.left,
              Math.min(left, imageRect.left + imageRect.width - 1),
            );
            top = Math.max(
              imageRect.top,
              Math.min(top, imageRect.top + imageRect.height - 1),
            );
            right = Math.max(
              left + 1,
              Math.min(right, imageRect.left + imageRect.width),
            );
            bottom = Math.max(
              top + 1,
              Math.min(bottom, imageRect.top + imageRect.height),
            );

            area.coords = { x1: left, y1: top, x2: right, y2: bottom };
            if (imageRect && imageRect.width && imageRect.height) {
              area.coordsPct = {
                x1: (left - imageRect.left) / imageRect.width,
                y1: (top - imageRect.top) / imageRect.height,
                x2: (right - imageRect.left) / imageRect.width,
                y2: (bottom - imageRect.top) / imageRect.height,
              };
            }
            const overlay = container.querySelector(
              `[data-area-id="${area.id}"]`,
            );
            if (overlay) {
              overlay.style.left = `${left}px`;
              overlay.style.top = `${top}px`;
              overlay.style.width = `${right - left}px`;
              overlay.style.height = `${bottom - top}px`;
            }
            e.preventDefault();
            return;
          } else {
            // Move logic
            let newLeft = mouseX - dragOffsetX;
            let newTop = mouseY - dragOffsetY;
            // Clamp within image box
            newLeft = Math.max(
              imageRect.left,
              Math.min(newLeft, imageRect.left + imageRect.width - dragOrigW),
            );
            newTop = Math.max(
              imageRect.top,
              Math.min(newTop, imageRect.top + imageRect.height - dragOrigH),
            );
            // Update model coords
            area.coords = {
              x1: newLeft,
              y1: newTop,
              x2: newLeft + dragOrigW,
              y2: newTop + dragOrigH,
            };
            if (imageRect && imageRect.width && imageRect.height) {
              area.coordsPct = {
                x1: (newLeft - imageRect.left) / imageRect.width,
                y1: (newTop - imageRect.top) / imageRect.height,
                x2: (newLeft - imageRect.left + dragOrigW) / imageRect.width,
                y2: (newTop - imageRect.top + dragOrigH) / imageRect.height,
              };
            }
            // Update overlay style live
            const overlay = container.querySelector(
              `[data-area-id="${area.id}"]`,
            );
            if (overlay) {
              overlay.style.left = `${newLeft}px`;
              overlay.style.top = `${newTop}px`;
              overlay.style.width = `${dragOrigW}px`;
              overlay.style.height = `${dragOrigH}px`;
            }
            e.preventDefault();
            return;
          }
        } else if (anchorHit) {
          let newLeft = mouseX - dragOffsetX;
          let newTop = mouseY - dragOffsetY;
          // Clamp within image box
          newLeft = Math.max(
            imageRect.left,
            Math.min(newLeft, imageRect.left + imageRect.width),
          );
          newTop = Math.max(
            imageRect.top,
            Math.min(newTop, imageRect.top + imageRect.height),
          );
          anchorHit.x = newLeft;
          anchorHit.y = newTop;
          if (imageRect && imageRect.width && imageRect.height) {
            anchorHit.xp = (newLeft - imageRect.left) / imageRect.width;
            anchorHit.yp = (newTop - imageRect.top) / imageRect.height;
          }
          const pin = container.querySelector(
            `[data-anchor-id="${draggingAreaId}"]`,
          );
          if (pin) {
            pin.style.left = `${newLeft}px`;
            pin.style.top = `${newTop}px`;
          }
          e.preventDefault();
          return;
        }
      }

      // Drawing new area
      if (!isDrawing || !currentArea) return;

      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      selection.style.left = `${Math.min(startX, x)}px`;
      selection.style.top = `${Math.min(startY, y)}px`;
      selection.style.width = `${Math.abs(x - startX)}px`;
      selection.style.height = `${Math.abs(y - startY)}px`;

      currentArea.coords = {
        x1: Math.min(startX, x),
        y1: Math.min(startY, y),
        x2: Math.max(startX, x),
        y2: Math.max(startY, y),
      };
      if (imageRect && imageRect.width && imageRect.height) {
        const left = Math.min(startX, x);
        const top = Math.min(startY, y);
        const right = Math.max(startX, x);
        const bottom = Math.max(startY, y);
        currentArea.coordsPct = {
          x1: left / imageRect.width,
          y1: top / imageRect.height,
          x2: right / imageRect.width,
          y2: bottom / imageRect.height,
        };
      }

      e.preventDefault();
    });

    // Mouse up handler (finish draw or drag)
    if (container)
      container.addEventListener("mouseup", () => {
        if (isDraggingArea) {
          isDraggingArea = false;
          draggingAreaId = null;
          renderAreas();
          renderAnchors();
          generateSktCode();
          return;
        }

        if (!isDrawing || !currentArea) return;

        isDrawing = false;
        selection.style.display = "none";

        const { x1, y1, x2, y2 } = currentArea.coords;
        if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
          areas.push(currentArea);
          renderAreas();
          renderPreview();
        }

        currentArea = null;
      });

    // Remove area when clicking on remove button
    if (container)
      container.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".remove-area-btn");
        if (removeBtn) {
          const areaId = removeBtn.getAttribute("data-id");
          removeArea(areaId);
          e.stopPropagation();
        }
      });
  }

  // Render preview
  function renderPreview() {
    createImagePreview();
  }

  // Add new area
  function addArea(type = "anchor", overrides = {}) {
    const areaId = `area-${Date.now()}-${areaCounter++}`;
    const area = {
      id: areaId,
      type,
      coords: { x1: 0, y1: 0, x2: 100, y2: 50 },
      href: type === "anchor" ? "#anchor" : "",
      alt: "",
      target: "",
      tabId: type === "tab" ? "tab1" : "",
      videoKind: "youtube",
      videoSrc: "",
      videoScale: 100,
      videoAutoplay: true,
      videoMuted: true,
      videoLoop: true,
      videoControls: false,
      ...overrides,
    };
    // 드래그 전에도 비율 좌표를 갖도록 초기화 (코드 생성 좌표계 일치)
    if (imageRect && imageRect.width && imageRect.height) {
      area.coordsPct = {
        x1: (area.coords.x1 - imageRect.left) / imageRect.width,
        y1: (area.coords.y1 - imageRect.top) / imageRect.height,
        x2: (area.coords.x2 - imageRect.left) / imageRect.width,
        y2: (area.coords.y2 - imageRect.top) / imageRect.height,
      };
    }
    areas.push(area);
    // 이미지별 상태에 동기화
    const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
    if (itIdx >= 0) {
      imageListState[itIdx].areas = areas;
    }
    renderAreas();
    renderPreview();
    return area;
  }

  // Remove area
  function removeArea(id) {
    areas = areas.filter((area) => area.id !== id);
    const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
    if (itIdx >= 0) {
      imageListState[itIdx].areas = areas;
    }
    renderAreas();
    renderPreview();
  }

  // Update area
  function updateArea(id, updates) {
    const area = areas.find((a) => a.id === id);
    if (area) {
      Object.assign(area, updates);
      renderPreview();
      // persist to active record
      const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
      if (itIdx >= 0) imageListState[itIdx].areas = areas;
    }
  }

  // Render areas list
  function renderAreas() {
    sktAreas.innerHTML = "";
    areas.forEach((area, index) => {
      const areaEl = document.createElement("div");
      areaEl.className = "skt-area-item";
      areaEl.innerHTML = `
                <div class="skt-area-header">
                    <h4>영역 #${index + 1}</h4>
                    <button class="remove-area-btn text-red-500 hover:text-red-700" data-id="${
                      area.id
                    }">삭제</button>
                </div>
                <div class="skt-area-fields">
                    <div class="p-2 bg-gray-50 rounded">
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div>X1: ${Math.round(area.coords.x1)}</div>
                            <div>Y1: ${Math.round(area.coords.y1)}</div>
                            <div>X2: ${Math.round(area.coords.x2)}</div>
                            <div>Y2: ${Math.round(area.coords.y2)}</div>
                        </div>
                    </div>
                    <div>
                        <div class="area-type-selector">
                            <select class="w-full p-2 border rounded" data-id="${
                              area.id
                            }" data-field="type">
                                <option value="link" ${
                                  area.type === "link" ? "selected" : ""
                                }>링크</option>
                                <option value="anchor" ${
                                  area.type === "anchor" ? "selected" : ""
                                }>앵커 이동</option>
                                <option value="tab" ${
                                  area.type === "tab" ? "selected" : ""
                                }>탭</option>
                                <option value="video" ${
                                  area.type === "video" ? "selected" : ""
                                }>영상</option>
                            </select>
                        </div>
                        ${
                          area.type === "video"
                            ? PubFeatures.renderVideoFields(area, area.id)
                            : area.type === "link"
                              ? `
                            <div class="link-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="링크 URL" value="${
                                  area.href || ""
                                }" data-id="${area.id}" data-field="href">
                            </div>
                            <div class="alt-text-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="대체 텍스트 (alt)" value="${
                                  area.alt || ""
                                }" data-id="${area.id}" data-field="alt">
                            </div>
                            <div class="anchor-target-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="타겟 (기본: _self)" value="${
                                  area.target || ""
                                }" data-id="${area.id}" data-field="target">
                            </div>
                        `
                              : area.type === "tab"
                                ? `
                            <div class="tab-id-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="탭 ID (예: tab1)" value="${
                                  area.tabId || ""
                                }" data-id="${area.id}" data-field="tabId">
                            </div>
                        `
                                : `
                            <div class="anchor-target-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="앵커 ID (예: #section1)" value="${
                                  area.href || ""
                                }" data-id="${area.id}" data-field="href">
                            </div>
                        `
                        }
                    </div>
                </div>
            `;
      sktAreas.appendChild(areaEl);
    });

    // Add event listeners (컨테이너 범위로 한정 — 다른 탭의 동일 셀렉터와 섞이지 않도록)
    sktAreas.querySelectorAll(".remove-area-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        removeArea(e.target.getAttribute("data-id"));
      });
    });

    sktAreas.querySelectorAll('select[data-field="type"]').forEach((select) => {
      select.addEventListener("change", (e) => {
        updateArea(e.target.getAttribute("data-id"), { type: e.target.value });
        renderAreas();
      });
    });

    // 영상 종류 변경은 입력 필드 구성이 달라지므로 목록을 다시 그린다.
    sktAreas
      .querySelectorAll('select[data-field="videoKind"]')
      .forEach((select) => {
        select.addEventListener("change", (e) => {
          updateArea(e.target.getAttribute("data-id"), {
            videoKind: e.target.value,
          });
          renderAreas();
        });
      });

    sktAreas.querySelectorAll("input[data-field]").forEach((input) => {
      const isCheckbox = input.type === "checkbox";
      input.addEventListener(isCheckbox ? "change" : "input", (e) => {
        const field = e.target.getAttribute("data-field");
        const value = isCheckbox ? e.target.checked : e.target.value;
        const id = e.target.getAttribute("data-id");
        updateArea(id, { [field]: value });
      });
    });
    // persist
    const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
    if (itIdx >= 0) imageListState[itIdx].areas = areas;
  }

  // Render anchors list
  function renderAnchors() {
    sktAnchors.innerHTML = "";
    anchors.forEach((a) => {
      const el = document.createElement("div");
      el.className = "skt-area-item";
      el.innerHTML = `
                <div class="skt-area-header">
                    <h4>앵커: <span class="font-mono">#${a.id}</span></h4>
                    <button class="remove-anchor-btn text-red-500 hover:text-red-700" data-id="${
                      a.id
                    }">삭제</button>
                </div>
                <div class="skt-area-fields">
                    <div>
                        <div class="p-2 bg-gray-50 rounded text-sm">X: ${Math.round(
                          a.x,
                        )} / Y: ${Math.round(a.y)}</div>
                    </div>
                    <div>
                        <input type="text" class="w-full p-2 border rounded" value="#${
                          a.id
                        }" data-id="${a.id}" data-field="id"/>
                        <p class="text-sm text-gray-500 mt-1">변경 시 자동으로 '#' 제거됩니다</p>
                    </div>
                </div>
            `;
      sktAnchors.appendChild(el);
    });

    sktAnchors.querySelectorAll(".remove-anchor-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        anchors = anchors.filter((x) => x.id !== id);
        renderAnchors();
        generateSktCode();
        createImagePreview();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
    });

    sktAnchors.querySelectorAll('input[data-field="id"]').forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const prevId = e.target.getAttribute("data-id");
        const vRaw = e.target.value.replace(/^#/, "");
        const a = anchors.find((x) => x.id === prevId);
        if (a) {
          a.id = vRaw;
          e.target.setAttribute("data-id", vRaw);
        }
        generateSktCode();
        createImagePreview();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
      inp.addEventListener("blur", (e) => {
        let v = e.target.value.replace(/^#/, "").trim();
        if (!v) v = "anchor";
        const prevId = e.target.getAttribute("data-id");
        const a =
          anchors.find((x) => x.id === prevId) ||
          anchors.find((x) => x.id === v);
        if (a) a.id = v;
        renderAnchors();
        createImagePreview();
        generateSktCode();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
    });
  }

  // 앵커 링크 투명화 스타일 (문서 전체에 1회만 출력)
  const SKT_ANCHOR_STYLE = `<style>
/* 앵커 링크 완전 투명화 */
.skt-anchor-link {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-decoration: none !important;
    color: transparent !important;
    display: block;
    z-index: 1;
}

.skt-anchor-link:focus,
.skt-anchor-link:active,
.skt-anchor-link:hover,
.skt-anchor-link:visited {
    outline: none !important;
    -webkit-tap-highlight-color: transparent !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-decoration: none !important;
}
</style>`;

  // Generate SKT code (퍼블 소스 패턴 기반)
  function generateSktCode() {
    if (!imageListState.length) {
      sktCodeOutput.value = "";
      return;
    }

    const toPctRect = PubFeatures.toPctRect;
    const items = imageListState.filter((it) => it.url);
    const overlayStyleExtras =
      "-webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; outline: none; background: transparent; border: none; box-shadow: none; z-index: 1;";

    let hasAnchorLink = false;

    const blocks = items.map((item) => {
      const nW = item.naturalW || 0;
      const nH = item.naturalH || 0;

      const linkCode = (item.areas || [])
        .filter((area) => area.type !== "video")
        .map((area) => {
          const r = toPctRect(area, nW, nH);
          const style = `position: absolute; top: ${r.top}%; left: ${r.left}%; width: ${r.width}%; height: ${r.height}%; text-indent: -9999px; ${overlayStyleExtras}`;
          if (area.type === "tab") {
            hasAnchorLink = true;
            return `    <a class="tab_item_admin skt-anchor-link" href="#${
              area.tabId || "tab1"
            }" style="${style}"></a>`;
          }
          if (area.type === "anchor") {
            hasAnchorLink = true;
            return `    <a href="${
              area.href || "#"
            }" class="skt-anchor-link" style="${style}"></a>`;
          }
          const target = area.target ? ` target="${area.target}"` : "";
          return `    <a href="${
            area.href || "#"
          }"${target} class="skt-anchor-link" style="${style}"></a>`;
        })
        .join("\n");

      // 영상 오버레이
      const videoCode = (item.areas || [])
        .filter((area) => area.type === "video" && area.videoSrc)
        .map((area) =>
          PubFeatures.buildVideoOverlay(
            area,
            toPctRect(area, nW, nH),
            { w: nW, h: nH },
            "    ",
          ),
        )
        .join("\n");

      // 앵커(섹션 마커): 가로 전체 폭 / 높이 1px
      const anchorCode = (item.anchors || [])
        .map((a) => {
          const top = typeof a.yp === "number" ? (a.yp * 100).toFixed(2) : "0";
          return PubFeatures.buildSectionMarker(a.id, top, "    ");
        })
        .join("\n");

      const inner = [linkCode, videoCode, anchorCode]
        .filter(Boolean)
        .join("\n");

      return `  <div style="position: relative; max-width: 800px; margin: 0 auto;">
    <img style="display: block; width: 100%;" src="${item.url}" alt="">${
      inner ? "\n" + inner : ""
    }
  </div>`;
    });

    // 두 기능은 같은 블록 범위를 감싸므로 동시에 적용할 수 없다. 콘텐츠 전환이 우선.
    const switchOn = PubFeatures.hasTabSwitch(tabSwitch, blocks.length);
    const stickyOn =
      !switchOn && stickyTab.enabled && stickyTab.tabs.length > 0;

    const body = switchOn
      ? PubFeatures.wrapBlocksWithTabSwitch(blocks, tabSwitch, "  ")
      : stickyOn
        ? PubFeatures.wrapBlocksWithStickyTabs(blocks, stickyTab, "  ")
        : blocks.join("\n\n");

    const head = [SKT_ANCHOR_STYLE];
    const tail = [];
    if (switchOn) {
      head.push(PubFeatures.buildTabSwitchStyle(tabSwitch, blocks.length));
      tail.push(PubFeatures.buildTabSwitchScript());
      if (hasAnchorLink) head.push(PubFeatures.SMOOTH_SCROLL_STYLE);
    } else if (stickyOn) {
      head.push(PubFeatures.buildStickyTabStyle());
      tail.push(PubFeatures.buildStickyTabScript(stickyTab));
    } else if (hasAnchorLink) {
      head.push(PubFeatures.SMOOTH_SCROLL_STYLE);
    }
    if (!stickyOn && anchorOffsetEnabled && anchorOffsetEnabled.checked) {
      tail.push(
        PubFeatures.buildAnchorOffsetScript(
          Number(anchorOffsetInput.value) || 0,
        ),
      );
    }

    sktCodeOutput.value = [...head, body, ...tail]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  // Render image rows UI
  function renderImageListUI() {
    if (!sktImageRowsContainer) return;
    sktImageRowsContainer.innerHTML = "";
    imageListState.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "p-4 border rounded-lg bg-gray-50 skt-image-row";
      row.dataset.id = item.id;
      row.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <label class="font-semibold text-gray-700">이미지 #${
                      idx + 1
                    }</label>
                    <button class="remove-row text-red-500 hover:text-red-700 text-sm font-bold">삭제</button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                        <input type="text" placeholder="https://example.com/image.jpg" class="image-url w-full p-2 border border-gray-300 rounded-md" value="${
                          item.url || ""
                        }">
                    </div>
                    <div class="flex items-start space-x-4">
                        <img src="${
                          item.url || ""
                        }" class="thumbnail-preview mt-1 ${
                          item.url ? "" : "hidden"
                        }">
                    </div>
                </div>`;
      sktImageRowsContainer.appendChild(row);

      // bind url
      const urlInput = row.querySelector(".image-url");
      urlInput.addEventListener("input", (e) => {
        const v = e.target.value.trim();
        item.url = v;
        if (!activeImageId || activeImageId === item.id) {
          activeImageId = item.id;
          imageUrl = v;
        }
        // 입력 중 행을 다시 그리면 포커스가 끊기므로 썸네일만 갱신한다.
        const thumb = row.querySelector(".thumbnail-preview");
        if (thumb) {
          thumb.src = v;
          thumb.classList.toggle("hidden", !v);
        }
        renderPreview();
      });
      urlInput.addEventListener("change", () => {
        // 원본 픽셀 크기는 mp4 비율/좌표 환산에 필요하다.
        loadImageMeta(item);
        renderImageListUI();
        renderPreview();
        renderStickyPanel();

        renderTabSwitchPanel();
      });
      // remove row
      row.querySelector(".remove-row").addEventListener("click", () => {
        imageListState = imageListState.filter((x) => x.id !== item.id);
        if (activeImageId === item.id) {
          const first = imageListState[0];
          activeImageId = first ? first.id : null;
          imageUrl = first ? first.url || "" : "";
          areas = first ? first.areas || [] : [];
          anchors = first ? first.anchors || [] : [];
          tabs = first ? first.tabs || [] : [];
        }
        renderImageListUI();
        renderPreview();
        renderStickyPanel();

        renderTabSwitchPanel();
      });
      // clicking the row sets it active
      row.addEventListener("click", (e) => {
        if (e.target.closest("input")) return;
        activeImageId = item.id;
        imageUrl = item.url || "";
        areas = item.areas || [];
        anchors = item.anchors || [];
        tabs = item.tabs || [];
        renderPreview();
        renderAreas();
        renderAnchors();
      });
    });
  }

  // 탭 스크롤 세트: 탭 링크 영역 N개 + 섹션 마커 N개를 짝으로 생성
  function addTabScrollSet(count) {
    if (!imageElement || !imageRect) {
      alert("먼저 이미지 URL을 입력하세요.");
      return;
    }
    if (!imageRect.width || !imageRect.height) {
      alert("이미지가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const n = Math.max(2, Math.min(Number(count) || 2, 6));
    const boxW = imageRect.width / n;
    const boxH = Math.max(24, imageRect.height * 0.03);
    const ids = Array.from({ length: n }, (_, i) =>
      String.fromCharCode(97 + i),
    ); // a, b, c ...

    // 스티키 탭과 달리 탭 메뉴 이미지가 섹션마다 반복되므로,
    // 섹션 N개 각각에 N개짜리 탭 메뉴 한 벌씩 = 링크 N×N 개를 만든다.
    ids.forEach((sectionId, s) => {
      const sectionY = imageRect.top + (imageRect.height / (n + 1)) * (s + 1);

      // 섹션 마커 (세로 위치만 의미 있음)
      anchors.push({
        id: sectionId,
        x: Math.round(imageRect.left + imageRect.width / 2),
        y: Math.round(sectionY),
        xp: 0.5,
        yp: (sectionY - imageRect.top) / imageRect.height,
      });

      // 이 섹션 위치의 탭 메뉴 한 벌
      ids.forEach((targetId, t) => {
        const left = imageRect.left + boxW * t;
        addArea("anchor", {
          href: `#${targetId}`,
          coords: {
            x1: left,
            y1: sectionY,
            x2: left + boxW,
            y2: sectionY + boxH,
          },
          coordsPct: {
            x1: (left - imageRect.left) / imageRect.width,
            y1: (sectionY - imageRect.top) / imageRect.height,
            x2: (left - imageRect.left + boxW) / imageRect.width,
            y2: (sectionY - imageRect.top + boxH) / imageRect.height,
          },
        });
      });
    });

    const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
    if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
    renderAnchors();
    renderAreas();
    renderPreview();
    generateSktCode();
  }

  // 스티키 탭 설정 패널
  function renderStickyPanel() {
    // 코드 블록은 URL 이 입력된 이미지만으로 만들어지므로 그 개수를 기준으로 한다.
    PubFeatures.renderStickyTabPanel(
      stickyPanel,
      stickyTab,
      imageListState.filter((it) => it.url).length,
      (_state, needsRerender) => {
        if (needsRerender) renderStickyPanel();
        generateSktCode();
      },
    );
  }

  // 탭 콘텐츠 전환 설정 패널
  function renderTabSwitchPanel() {
    PubFeatures.renderTabSwitchPanel(
      tabSwitchPanel,
      tabSwitch,
      imageListState.filter((it) => it.url).length,
      (_state, needsRerender) => {
        if (needsRerender) renderTabSwitchPanel();
        generateSktCode();
      },
    );
  }

  // Reset SKT tab
  function resetSkt() {
    imageListState = [];
    activeImageId = null;
    areas = [];
    anchors = [];
    tabs = [];
    imageUrl = "";
    stickyTab = {
      enabled: false,
      menuId: "menu",
      maxWidth: 800,
      headerOffset: 0,
      tabs: [],
    };
    tabSwitch = { groups: [] };
    if (anchorOffsetEnabled) anchorOffsetEnabled.checked = false;
    if (anchorOffsetInput) anchorOffsetInput.value = "0";
    if (sktImageRowsContainer) sktImageRowsContainer.innerHTML = "";
    sktPreview.innerHTML =
      '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
    sktCodeOutput.value = "";
    renderAreas();
    renderAnchors();
    renderStickyPanel();

    renderTabSwitchPanel();
  }

  // Event listeners
  addAreaAnchorBtn?.addEventListener("click", () => addArea("anchor"));
  addAreaLinkBtn?.addEventListener("click", () => addArea("link"));
  addAreaVideoBtn?.addEventListener("click", () => addArea("video"));
  addTabScrollBtn?.addEventListener("click", () =>
    addTabScrollSet(tabScrollCountInput ? tabScrollCountInput.value : 2),
  );
  anchorOffsetEnabled?.addEventListener("change", generateSktCode);
  anchorOffsetInput?.addEventListener("input", generateSktCode);

  // Add anchor button handler
  function addAnchor() {
    if (!imageElement || !imageRect) {
      alert("먼저 이미지 URL을 입력하세요.");
      return;
    }
    if (!imageRect.width || !imageRect.height) {
      alert("이미지가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const idx = anchors.length + 1;
    const id = `anchor-${idx}`;
    // 이미지 최상단 중앙을 기준 시작점으로 배치
    const x = Math.round(imageRect.left + imageRect.width / 2);
    const y = Math.round(imageRect.top + 8); // 상단에서 약간 내려 표시
    const xp = (x - imageRect.left) / imageRect.width;
    const yp = (y - imageRect.top) / imageRect.height;
    anchors.push({ id, x, y, xp, yp });
    renderAnchors();
    createImagePreview();
    generateSktCode();
  }
  if (addAnchorBtn) {
    addAnchorBtn.addEventListener("click", addAnchor);
  }

  copySktCodeBtn.addEventListener("click", () => {
    const originalText = copySktCodeBtn.textContent;
    copyWithCRLF(
      sktCodeOutput.value,
      () => {
        copySktCodeBtn.textContent = "복사됨!";
        setTimeout(() => {
          copySktCodeBtn.textContent = originalText;
        }, 2000);
      },
      () => {
        alert("복사에 실패했습니다. 수동으로 Ctrl+C를 사용해 주세요.");
      },
    );
  });

  // 코드 생성 버튼
  if (generateSktCodeBtn) {
    generateSktCodeBtn.addEventListener("click", () => {
      // 원래 문구를 기억했다가 되돌린다 (하드코딩하면 라벨이 바뀔 때 어긋난다)
      const originalText = generateSktCodeBtn.textContent;
      generateSktCode();
      generateSktCodeBtn.textContent = "생성 완료";
      setTimeout(() => (generateSktCodeBtn.textContent = originalText), 1500);
    });
  }
  resetSktBtn.addEventListener("click", resetSkt);
  if (addSktRowBtn) {
    addSktRowBtn.addEventListener("click", () => {
      const id = `img-${Date.now()}`;
      imageListState.push({ id, url: "", areas: [], anchors: [], tabs: [] });
      if (!activeImageId) activeImageId = id;
      renderImageListUI();
      renderPreview();
      renderStickyPanel();

      renderTabSwitchPanel();
    });
  }

  // Initial render
  renderImageListUI();
  renderPreview();
  renderStickyPanel();

  renderTabSwitchPanel();
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeSktTab();
});
