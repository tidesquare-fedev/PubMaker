// Benefia Tab Functionality

// Benefia Tab Functionality
function initializeBenefiaTab() {
  const benefiaAreas = document.getElementById("benefia-areas");
  const addAreaBtn = document.getElementById("add-benefia-area");
  const benefiaPreview = document.getElementById("benefia-preview");
  const benefiaCodeOutput = document.getElementById("benefia-code-output");
  const copyBenefiaCodeBtn = document.getElementById("copy-benefia-code");
  const generateBenefiaCodeBtn = document.getElementById(
    "generate-benefia-code"
  );
  const resetBenefiaBtn = document.getElementById("reset-benefia-btn");
  const benefiaAnchors = document.getElementById("benefia-anchors");
  const addAnchorBtn = document.getElementById("add-benefia-anchor");
  const addAnchorBtnSecondary = document.getElementById(
    "add-benefia-anchor-secondary"
  );
  const addAreaAnchorBtn = document.getElementById("add-benefia-area-anchor");
  const addAreaCouponBtn = document.getElementById("add-benefia-area-coupon");
  const addAreaLinkBtn = document.getElementById("add-benefia-area-link");
  const benefiaImageRowsContainer =
    document.getElementById("benefia-image-rows");
  const addBenefiaRowBtn = document.getElementById("benefia-add-image-row");

  let imageListState = []; // [{id, url, areas:[], anchors:[]}]
  let activeImageId = null; // 현재 편집 중인 이미지 ID
  // 활성 이미지의 상태에 매핑되는 별칭 (미리보기/편집 로직의 최소 변경을 위해 유지)
  let areas = [];
  let anchors = [];
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
    }
  }

  // Create image preview container with selection functionality (stacked)
  function createImagePreview() {
    if (!imageListState.length) {
      benefiaPreview.innerHTML =
        '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
      return;
    }

    // 활성 이미지가 없으면 첫 번째로 지정
    if (!activeImageId) {
      activeImageId = imageListState[0].id;
      imageUrl = imageListState[0].url || "";
      areas = imageListState[0].areas || [];
      anchors = imageListState[0].anchors || [];
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
                <div id="benefia-image-container" class="relative" style="margin:0;">
                    ${
                      imageUrl
                        ? `<img id="benefia-image" src="${imageUrl}" alt="미리보기 이미지" style="display:block; width:100%; height:auto; border:0;">`
                        : '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>'
                    }
                    <div id="benefia-selection" class="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none" style="display: none;"></div>
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
                        const cls = isAnchorArea
                          ? "benefia-anchor-box"
                          : "absolute border-2 border-red-500 bg-red-100 bg-opacity-30 flex items-center justify-center";
                        const labelHtml = isAnchorArea
                          ? `<span class=\"benefia-anchor-label\">ANCHOR</span>`
                          : `<span class=\"bg-red-500 text-white text-xs px-1 rounded absolute -top-3 -left-px\">${
                              index + 1
                            }</span>`;
                        return `<div class="${cls}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;" data-area-id="${area.id}">${labelHtml}
                            <div class=\"benefia-handle nw\" data-dir=\"nw\"></div>
                            <div class=\"benefia-handle n\" data-dir=\"n\"></div>
                            <div class=\"benefia-handle ne\" data-dir=\"ne\"></div>
                            <div class=\"benefia-handle e\" data-dir=\"e\"></div>
                            <div class=\"benefia-handle se\" data-dir=\"se\"></div>
                            <div class=\"benefia-handle s\" data-dir=\"s\"></div>
                            <div class=\"benefia-handle sw\" data-dir=\"sw\"></div>
                            <div class=\"benefia-handle w\" data-dir=\"w\"></div>
                            <button class="remove-area-btn absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" data-id="${area.id}">×</button>
                        </div>`;
                      })
                      .join("")}
                    ${anchors
                      .map((a) => {
                        const left = Math.round(a.x);
                        const top = Math.round(a.y);
                        return `<div class="benefia-anchor-pin" data-anchor-id="${a.id}" style="left:${left}px; top:${top}px" title="${a.id}"></div>`;
                      })
                      .join("")}
                </div>
                <div class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">영역을 선택하려면 이미지 위에서 드래그하세요</div>
            </div>`;
      })
      .join("");

    benefiaPreview.innerHTML = blocksHtml;

    // Get the image element and container
    imageElement = document.getElementById("benefia-image");
    const container = document.getElementById("benefia-image-container");
    const selection = document.getElementById("benefia-selection");

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
        draggingAreaId = id; // reuse variable name
        dragOrigW = 0; // not used for anchor
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
        const handle = e.target.closest(".benefia-handle");
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
          dragOffsetX = mouseX; // store last mouse
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
              Math.min(left, imageRect.left + imageRect.width - 1)
            );
            top = Math.max(
              imageRect.top,
              Math.min(top, imageRect.top + imageRect.height - 1)
            );
            right = Math.max(
              left + 1,
              Math.min(right, imageRect.left + imageRect.width)
            );
            bottom = Math.max(
              top + 1,
              Math.min(bottom, imageRect.top + imageRect.height)
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
              `[data-area-id="${area.id}"]`
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
              Math.min(newLeft, imageRect.left + imageRect.width - dragOrigW)
            );
            newTop = Math.max(
              imageRect.top,
              Math.min(newTop, imageRect.top + imageRect.height - dragOrigH)
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
              `[data-area-id="${area.id}"]`
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
            Math.min(newLeft, imageRect.left + imageRect.width)
          );
          newTop = Math.max(
            imageRect.top,
            Math.min(newTop, imageRect.top + imageRect.height)
          );
          anchorHit.x = newLeft;
          anchorHit.y = newTop;
          if (imageRect && imageRect.width && imageRect.height) {
            anchorHit.xp = (newLeft - imageRect.left) / imageRect.width;
            anchorHit.yp = (newTop - imageRect.top) / imageRect.height;
          }
          const pin = container.querySelector(
            `[data-anchor-id="${draggingAreaId}"]`
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
          generateBenefiaCode();
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
    // 미리보기는 항상 최신 반영, 코드 텍스트는 버튼 클릭 시에만 갱신
    // generateBenefiaCode();
  }

  // Add new area
  function addArea(type = "anchor") {
    const areaId = `area-${Date.now()}-${areaCounter++}`;
    const area = {
      id: areaId,
      type,
      coords: { x1: 0, y1: 0, x2: 100, y2: 50 },
      href: type === "anchor" ? "#anchor" : "",
      alt: "",
      target: "",
      couponIds: "",
    };
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
    benefiaAreas.innerHTML = "";
    areas.forEach((area, index) => {
      const areaEl = document.createElement("div");
      areaEl.className = "benefia-area-item";
      areaEl.innerHTML = `
                <div class="benefia-area-header">
                    <h4>영역 #${index + 1}</h4>
                    <button class="remove-area-btn text-red-500 hover:text-red-700" data-id="${
                      area.id
                    }">삭제</button>
                </div>
                <div class="benefia-area-fields">
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
                                <option value="coupon" ${
                                  area.type === "coupon" ? "selected" : ""
                                }>쿠폰 다운로드</option>
                                <option value="anchor" ${
                                  area.type === "anchor" ? "selected" : ""
                                }>앵커 이동</option>
                            </select>
                        </div>
                        ${
                          area.type === "link"
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
                            : area.type === "coupon"
                            ? `
                            <div class="coupon-ids-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="쿠폰 ID (쉼표로 구분)" value="${
                                  area.couponIds || ""
                                }" data-id="${area.id}" data-field="couponIds">
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
      benefiaAreas.appendChild(areaEl);
    });

    // Add event listeners
    document.querySelectorAll(".remove-area-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        removeArea(e.target.getAttribute("data-id"));
      });
    });

    document.querySelectorAll('select[data-field="type"]').forEach((select) => {
      select.addEventListener("change", (e) => {
        updateArea(e.target.getAttribute("data-id"), { type: e.target.value });
        renderAreas();
      });
    });

    document.querySelectorAll("input[data-field]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const field = e.target.getAttribute("data-field");
        const value = e.target.value;
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
    benefiaAnchors.innerHTML = "";
    anchors.forEach((a) => {
      const el = document.createElement("div");
      el.className = "benefia-area-item";
      el.innerHTML = `
                <div class="benefia-area-header">
                    <h4>앵커: <span class="font-mono">#${a.id}</span></h4>
                    <button class="remove-anchor-btn text-red-500 hover:text-red-700" data-id="${
                      a.id
                    }">삭제</button>
                </div>
                <div class="benefia-area-fields">
                    <div>
                        <div class="p-2 bg-gray-50 rounded text-sm">X: ${Math.round(
                          a.x
                        )} / Y: ${Math.round(a.y)}</div>
                    </div>
                    <div>
                        <input type="text" class="w-full p-2 border rounded" value="#${
                          a.id
                        }" data-id="${a.id}" data-field="id"/>
                        <p class="text-xs text-gray-500 mt-1">변경 시 자동으로 '#' 제거됩니다</p>
                    </div>
                </div>
            `;
      benefiaAnchors.appendChild(el);
    });

    benefiaAnchors.querySelectorAll(".remove-anchor-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        anchors = anchors.filter((x) => x.id !== id);
        renderAnchors();
        generateBenefiaCode();
        createImagePreview();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
    });

    benefiaAnchors.querySelectorAll('input[data-field="id"]').forEach((inp) => {
      // 입력 중에는 즉시 DOM을 리렌더하지 않아 커서가 튀는 문제를 방지
      inp.addEventListener("input", (e) => {
        const prevId = e.target.getAttribute("data-id");
        const vRaw = e.target.value.replace(/^#/, "");
        const a = anchors.find((x) => x.id === prevId);
        if (a) {
          a.id = vRaw; // 공백 포함 임시 허용
          e.target.setAttribute("data-id", vRaw);
        }
        // 코드/미리보기만 갱신
        generateBenefiaCode();
        createImagePreview();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
      // 포커스 해제 시 정규화하고 목록을 리렌더
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
        generateBenefiaCode();
        const itIdx = imageListState.findIndex((x) => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
      });
    });
  }

  // Generate Benefia code (percent-based absolute anchors, no image map)
  function generateBenefiaCode() {
    if (!imageListState.length) {
      benefiaCodeOutput.value = "";
      return;
    }

    const toPctRect = (area, nW, nH) => {
      if (area.coordsPct) {
        return {
          left: (area.coordsPct.x1 * 100).toFixed(2),
          top: (area.coordsPct.y1 * 100).toFixed(2),
          width: ((area.coordsPct.x2 - area.coordsPct.x1) * 100).toFixed(2),
          height: ((area.coordsPct.y2 - area.coordsPct.y1) * 100).toFixed(2),
        };
      }
      if (area.coords && nW && nH) {
        const { x1, y1, x2, y2 } = area.coords;
        return {
          left: ((x1 / nW) * 100).toFixed(2),
          top: ((y1 / nH) * 100).toFixed(2),
          width: (((x2 - x1) / nW) * 100).toFixed(2),
          height: (((y2 - y1) / nH) * 100).toFixed(2),
        };
      }
      return { left: "0", top: "0", width: "0", height: "0" };
    };

    const blocks = imageListState
      .filter((it) => it.url)
      .map((item) => {
        const nW = item.naturalW || 0;
        const nH = item.naturalH || 0;

        const overlayCode = (item.areas || [])
          .map((area) => {
            const r = toPctRect(area, nW, nH);
            const style = `position: absolute; top: ${r.top}%; left: ${r.left}%; width: ${r.width}%; height: ${r.height}%; text-indent: -9999px;`;
            if (area.type === "coupon" && area.couponIds) {
              const ids = area.couponIds
                .split(",")
                .map((id) => `'${id.trim()}'`)
                .filter(Boolean)
                .join(", ");
              return `      <a href="javascript:void(0)" onclick="couponDownloadAll([${ids}]); return false;" style="${style}"></a>`;
            } else if (area.type === "anchor") {
              return `      <a href="${
                area.href || "#"
              }" style="${style}"></a>`;
            } else {
              const target = area.target ? ` target="${area.target}"` : "";
              return `      <a href="${
                area.href || "#"
              }"${target} style="${style}"></a>`;
            }
          })
          .join("\n");

        const anchorCode = (item.anchors || [])
          .map((a) => {
            const left =
              typeof a.xp === "number" ? (a.xp * 100).toFixed(2) : "0";
            const top =
              typeof a.yp === "number" ? (a.yp * 100).toFixed(2) : "0";
            return `      <div id="${a.id}" style="position:absolute; left:${left}%; top:${top}%; width:1px; height:1px; overflow:hidden;">&nbsp;</div>`;
          })
          .join("\n");

        return `
<div class="content">
  <div style="text-align: center;">
    <div style="position:relative; max-width: 1180px; margin: 0 auto;">
      <img src="${item.url}" style="border:0; max-width: 100%; display:block;">
${overlayCode}
${anchorCode}
    </div>
  </div>
</div>`;
      })
      .join("\n\n");

    benefiaCodeOutput.value = blocks.trim();
  }

  // Render image rows UI (투어비스와 유사한 행 기반)
  function renderImageListUI() {
    if (!benefiaImageRowsContainer) return;
    benefiaImageRowsContainer.innerHTML = "";
    imageListState.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "p-4 border rounded-lg bg-gray-50 benefia-image-row";
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
                        <div class="flex-grow">
                            <div class="flex items-center space-x-2">
                                <label class="text-sm">배경색:</label>
                                <input type="color" value="#FFFFFF" class="bg-color w-10 h-8 border-0 cursor-pointer rounded">
                                <input type="text" placeholder="#FFFFFF" class="bg-color-text w-full p-2 border border-gray-300 rounded-md text-sm">
                            </div>
                        </div>
                    </div>
                </div>`;
      benefiaImageRowsContainer.appendChild(row);

      // bind url
      const urlInput = row.querySelector(".image-url");
      urlInput.addEventListener("input", (e) => {
        const v = e.target.value.trim();
        item.url = v;
        if (!activeImageId || activeImageId === item.id) {
          activeImageId = item.id;
          imageUrl = v;
        }
        renderImageListUI();
        renderPreview();
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
        }
        renderImageListUI();
        renderPreview();
      });
      // clicking the row sets it active
      row.addEventListener("click", (e) => {
        if (e.target.closest("input")) return;
        activeImageId = item.id;
        imageUrl = item.url || "";
        areas = item.areas || [];
        anchors = item.anchors || [];
        renderPreview();
        renderAreas();
        renderAnchors();
      });
    });
  }

  // Reset Benefia tab
  function resetBenefia() {
    imageListState = [];
    activeImageId = null;
    areas = [];
    anchors = [];
    imageUrl = "";
    if (benefiaImageRowsContainer) benefiaImageRowsContainer.innerHTML = "";
    benefiaPreview.innerHTML =
      '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
    benefiaCodeOutput.value = "";
    renderAreas();
    renderAnchors();
  }

  // Event listeners
  addAreaBtn?.addEventListener("click", () => addArea("anchor"));
  addAreaAnchorBtn?.addEventListener("click", () => addArea("anchor"));
  addAreaCouponBtn?.addEventListener("click", () => addArea("coupon"));
  addAreaLinkBtn?.addEventListener("click", () => addArea("link"));
  // Add anchor button handler
  function addAnchor() {
    if (!imageElement || !imageRect) {
      alert("먼저 이미지 URL을 입력하세요.");
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
    generateBenefiaCode();
  }
  if (addAnchorBtn) {
    addAnchorBtn.addEventListener("click", addAnchor);
  }
  if (addAnchorBtnSecondary) {
    addAnchorBtnSecondary.addEventListener("click", addAnchor);
  }
  copyBenefiaCodeBtn.addEventListener("click", () => {
    const originalText = copyBenefiaCodeBtn.textContent;
    copyWithCRLF(
      benefiaCodeOutput.value,
      () => {
        copyBenefiaCodeBtn.textContent = "복사됨!";
        setTimeout(() => {
          copyBenefiaCodeBtn.textContent = originalText;
        }, 2000);
      },
      () => {
        alert("복사에 실패했습니다. 수동으로 Ctrl+C를 사용해 주세요.");
      }
    );
  });
  // 코드 생성 버튼: 현재 상태를 코드 텍스트에 반영
  if (generateBenefiaCodeBtn) {
    generateBenefiaCodeBtn.addEventListener("click", () => {
      generateBenefiaCode();
      generateBenefiaCodeBtn.textContent = "생성 완료";
      setTimeout(
        () => (generateBenefiaCodeBtn.textContent = "코드 생성"),
        1500
      );
    });
  }
  resetBenefiaBtn.addEventListener("click", resetBenefia);
  if (addBenefiaRowBtn) {
    addBenefiaRowBtn.addEventListener("click", () => {
      const id = `img-${Date.now()}`;
      imageListState.push({ id, url: "", areas: [], anchors: [] });
      if (!activeImageId) activeImageId = id;
      renderImageListUI();
      renderPreview();
    });
  }

  // Update image URL and preview when changed
  // 더 이상 단일 URL 인풋을 사용하지 않음

  // Initial render
  renderImageListUI();
  renderPreview();
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeBenefiaTab();
});
