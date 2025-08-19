// DOM 요소들을 script.js 파일 상단에서 한 번만 찾도록 정의합니다.
const imageList = document.getElementById('image-list');
const addImageBtn = document.getElementById('add-image-btn');
const resetBtn = document.getElementById('reset-btn');
const generateBtn = document.getElementById('generate-btn');
const copyBtn = document.getElementById('copy-btn');
const previewIframe = document.getElementById('preview-iframe');
const toggleDebugAreas = document.getElementById('toggle-debug-areas');
const codeOutput = document.getElementById('code-output');
const imageMapSection = document.getElementById('image-map-section');
const mapperImage = document.getElementById('mapper-image');
const canvasContainer = document.getElementById('canvas-container');
const selectionBox = document.getElementById('selection-box');
const coordsInfo = document.getElementById('coords-info');
const applyAreaBtn = document.getElementById('apply-area-btn');
const cancelAreaBtn = document.getElementById('cancel-area-btn');

let imageCounter = 0;
let isFirstClick = true;
let activeMappingInfo = null;
let firstClickCoords = null;
let dragState = null; // {mode: 'move'|'resize', startX, startY, startRect, dir}

// 앱 초기화 함수
function initializeApp() {
    imageList.innerHTML = '';
    imageCounter = 0;
    addImageRow();
    imageMapSection.classList.add('hidden');
    codeOutput.value = '';
    previewIframe.srcdoc = 'about:blank';
    mapperImage.src = '';
    document.getElementById('platform-pc').checked = true;
    activeMappingInfo = null;
}

// 이미지 입력 행 추가 함수
function addImageRow() {
    imageCounter++;
    const div = document.createElement('div');
    div.className = 'p-4 border rounded-lg bg-gray-50 image-row';
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
            <button class="add-new-button-btn w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm">
                + 새 버튼 추가
            </button>
        </div>
    `;
    imageList.appendChild(div);
    
    div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
    div.querySelector('.image-url').addEventListener('input', handleUrlInput);
    div.querySelector('.add-new-button-btn').addEventListener('click', (e) => {
        const imageRow = e.target.closest('.image-row');
        const buttons = JSON.parse(imageRow.dataset.buttons);
        buttons.push({});
        imageRow.dataset.buttons = JSON.stringify(buttons);
        addButtonConfigRow(imageRow, buttons.length - 1);
    });

    // 배경색 입력 동기화/스포이드/이미지 추출 이벤트
    const bgColorInput = div.querySelector('.bg-color');
    const bgColorText = div.querySelector('.bg-color-text');
    const eyedropperBtn = div.querySelector('.eyedropper-btn');
    const extractBtn = div.querySelector('.extract-from-image-btn');

    bgColorInput.addEventListener('input', () => {
        setRowBgColor(div, bgColorInput.value);
    });
    bgColorText.addEventListener('change', () => {
        const hex = normalizeHex(bgColorText.value);
        if (hex) setRowBgColor(div, hex);
    });
    bgColorText.addEventListener('input', () => {
        const hex = normalizeHex(bgColorText.value, true);
        if (hex) bgColorInput.value = hex;
        renderPreview();
    });

    eyedropperBtn.addEventListener('click', async () => {
        if (!('EyeDropper' in window)) {
            alert('이 브라우저는 스포이드를 지원하지 않습니다. Chrome 95+ 권장');
            return;
        }
        try {
            const result = await new window.EyeDropper().open();
            setRowBgColor(div, result.sRGBHex);
        } catch (_) { /* 사용자가 취소 */ }
    });

    extractBtn.addEventListener('click', () => {
        const url = div.querySelector('.image-url').value.trim();
        if (!url) { alert('먼저 이미지 URL을 입력하세요.'); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const w = 50, h = 50; // 저해상도 축소로 평균 속도 개선
            canvas.width = w; canvas.height = h;
            // cover 방식으로 중앙 채우기 후 평균
            const scale = Math.max(w / img.width, h / img.height);
            const dw = img.width * scale; const dh = img.height * scale;
            const dx = (w - dw) / 2; const dy = (h - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            const data = ctx.getImageData(0, 0, w, h).data;
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
            r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
            const hex = rgbToHex(r, g, b);
            setRowBgColor(div, hex);
        };
        img.onerror = () => {
            alert('이미지에서 색을 추출할 수 없습니다. CORS 허용이 필요할 수 있습니다.');
        };
    });
}

// 버튼 설정 UI 추가 함수
function addButtonConfigRow(imageRow, buttonIndex) {
    const buttonsContainer = imageRow.querySelector('.buttons-container');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'p-3 border rounded-md bg-white button-config-row';
    buttonDiv.dataset.buttonIndex = buttonIndex;
    buttonDiv.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <p class="font-semibold text-gray-700">버튼 #${buttonIndex + 1}</p>
            <button class="remove-button-btn text-red-500 hover:text-red-700 text-xs font-bold">삭제</button>
        </div>
        <div class="space-y-2">
            <button class="set-area-btn w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">영역 설정하기</button>
            <label class="block text-sm font-medium text-gray-700">버튼 타입</label>
            <select class="button-type w-full p-2 border border-gray-300 rounded-md">
                <option value="booking">항공권 예약하기</option>
                <option value="link">단순 링크</option>
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
        </div>
    `;
    buttonsContainer.appendChild(buttonDiv);

    buttonDiv.querySelector('.set-area-btn').addEventListener('click', handleSetAreaClick);
    buttonDiv.querySelector('.button-type').addEventListener('change', handleButtonTypeChange);
    buttonDiv.querySelector('.remove-button-btn').addEventListener('click', (e) => {
        const btnRow = e.target.closest('.button-config-row');
        const imgRow = e.target.closest('.image-row');
        const idx = parseInt(btnRow.dataset.buttonIndex, 10);
        
        const buttons = JSON.parse(imgRow.dataset.buttons);
        buttons.splice(idx, 1);
        imgRow.dataset.buttons = JSON.stringify(buttons);
        
        imgRow.querySelector('.buttons-container').innerHTML = '';
        buttons.forEach((_, i) => addButtonConfigRow(imgRow, i));
    });
}

// 버튼 타입 변경 핸들러
function handleButtonTypeChange(e) {
    const buttonRow = e.target.closest('.button-config-row');
    const bookingFields = buttonRow.querySelector('.booking-fields');
    const linkFields = buttonRow.querySelector('.link-fields');
    bookingFields.classList.toggle('hidden', e.target.value !== 'booking');
    linkFields.classList.toggle('hidden', e.target.value === 'booking');
}

// '영역 설정' 버튼 클릭 핸들러
function handleSetAreaClick(e) {
    const buttonRow = e.target.closest('.button-config-row');
    const imageRow = e.target.closest('.image-row');
    const buttonIndex = parseInt(buttonRow.dataset.buttonIndex, 10);
    const imageUrl = imageRow.querySelector('.image-url').value.trim();

    if (imageUrl) {
        // http/https만 허용
        if (!/^https?:\/\//i.test(imageUrl)) {
            alert('유효한 이미지 URL이 아닙니다. https:// 로 시작하는 경로를 입력해주세요.');
            return;
        }
        activeMappingInfo = { row: imageRow, buttonIndex: buttonIndex };
        try { mapperImage.removeAttribute('crossorigin'); } catch(_) {}
        imageMapSection.classList.remove('hidden');
        coordsInfo.textContent = '이미지 로딩 중...';
        // 캐시 버스트로 강제 로드
        const bust = (imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        mapperImage.src = imageUrl + bust;
    } else {
        alert('버튼 영역을 설정하려면 먼저 이미지 URL을 입력해주세요.');
    }
}

// URL 입력 핸들러
function handleUrlInput(e) {
    const url = e.target.value.trim();
    const row = e.target.closest('.image-row');
    const thumbnail = row.querySelector('.thumbnail-preview');

    if (url) {
        thumbnail.src = url;
        thumbnail.classList.remove('hidden');
        // 이미지 입력 시 즉시 미리보기 업데이트
        renderPreview();
    } else {
        thumbnail.classList.add('hidden');
        renderPreview();
    }
}

// 공통 유틸: HEX 정규화/세팅/변환
function normalizeHex(input, loose = false) {
    if (!input) return loose ? null : '#FFFFFF';
    let v = input.trim().replace(/^#/,'');
    if (v.length === 3) v = v.split('').map(c => c + c).join('');
    v = v.toUpperCase();
    if (/^[0-9A-F]{6}$/.test(v)) return '#' + v;
    return loose ? null : '#FFFFFF';
}

function setRowBgColor(row, hex) {
    const norm = normalizeHex(hex) || '#FFFFFF';
    const colorInput = row.querySelector('.bg-color');
    const textInput = row.querySelector('.bg-color-text');
    colorInput.value = norm; textInput.value = norm;
    renderPreview();
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// 영역 설정 이미지 로드 완료 핸들러
mapperImage.onload = () => {
    if (!activeMappingInfo) return;
    coordsInfo.textContent = '박스를 드래그해 위치를 잡고, 모서리로 크기를 조절하세요. 적용을 눌러 저장합니다.';
    isFirstClick = true; // deprecated but kept for minimal changes
    firstClickCoords = null;
    // 초기 박스를 이미지의 중앙 40% 크기로 표시
    const rect = mapperImage.getBoundingClientRect();
    const initWidth = rect.width * 0.4;
    const initHeight = rect.height * 0.2;
    const initLeft = (rect.width - initWidth) / 2;
    const initTop = (rect.height - initHeight) / 2;
    Object.assign(selectionBox.style, {
        display: 'block', left: `${initLeft}px`, top: `${initTop}px`, width: `${initWidth}px`, height: `${initHeight}px`
    });
    window.scrollTo({ top: imageMapSection.offsetTop, behavior: 'smooth' });
};

// 영역 설정 이미지 로드 에러 핸들러 (중복 알림 방지 및 비차단 방식)
let lastImageErrorUrl = null;
mapperImage.onerror = () => {
    const failedUrl = mapperImage.src;
    if (lastImageErrorUrl !== failedUrl) {
        coordsInfo.textContent = '이미지를 불러올 수 없습니다. CORS/URL 문제일 수 있습니다. 이미지 직접 링크(JPG/PNG 등)인지 확인하거나, 다른 호스팅(예: postimages.org)으로 업로드 후 다시 시도해 주세요.';
        lastImageErrorUrl = failedUrl;
    }
    selectionBox.style.display = 'none';
    activeMappingInfo = null;
};

// 영역 지정(클릭) 이벤트 핸들러
// 드래그로 박스 이동/리사이즈
function getBoxRect() {
    return {
        left: parseFloat(selectionBox.style.left || '0'),
        top: parseFloat(selectionBox.style.top || '0'),
        width: parseFloat(selectionBox.style.width || '0'),
        height: parseFloat(selectionBox.style.height || '0')
    };
}

function clampBox(rectPx) {
    const imgRect = mapperImage.getBoundingClientRect();
    const maxLeft = imgRect.width - rectPx.width;
    const maxTop = imgRect.height - rectPx.height;
    rectPx.left = Math.max(0, Math.min(rectPx.left, Math.max(0, maxLeft)));
    rectPx.top = Math.max(0, Math.min(rectPx.top, Math.max(0, maxTop)));
    rectPx.width = Math.max(1, Math.min(rectPx.width, imgRect.width - rectPx.left));
    rectPx.height = Math.max(1, Math.min(rectPx.height, imgRect.height - rectPx.top));
    return rectPx;
}

canvasContainer.addEventListener('mousedown', (e) => {
    if (!activeMappingInfo) return;
    const target = e.target;
    const imgRect = mapperImage.getBoundingClientRect();
    const startX = e.clientX; const startY = e.clientY;
    const startRect = getBoxRect();
    if (target.classList.contains('handle')) {
        dragState = { mode: 'resize', dir: target.dataset.dir, startX, startY, startRect };
    } else {
        // 이동 모드 (selectionBox 또는 이미지 영역 클릭)
        dragState = { mode: 'move', startX, startY, startRect };
    }
    canvasContainer.classList.add('dragging');
    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (!dragState || !activeMappingInfo) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    let r = { ...dragState.startRect };
    if (dragState.mode === 'move') {
        r.left += dx; r.top += dy;
    } else if (dragState.mode === 'resize') {
        const dir = dragState.dir;
        if (dir.includes('e')) r.width += dx;
        if (dir.includes('s')) r.height += dy;
        if (dir.includes('w')) { r.left += dx; r.width -= dx; }
        if (dir.includes('n')) { r.top += dy; r.height -= dy; }
    }
    r = clampBox(r);
    Object.assign(selectionBox.style, {
        left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`
    });
});

window.addEventListener('mouseup', () => {
    if (!dragState) return;
    dragState = null;
    canvasContainer.classList.remove('dragging');
});

function saveSelectionToRow() {
    const rect = mapperImage.getBoundingClientRect();
    const imgW = mapperImage.naturalWidth; const imgH = mapperImage.naturalHeight;
    const scaleX = imgW / rect.width; const scaleY = imgH / rect.height;
    const px = getBoxRect();
    const x1 = px.left * scaleX;
    const y1 = px.top * scaleY;
    const x2 = (px.left + px.width) * scaleX;
    const y2 = (px.top + px.height) * scaleY;

    const coords = {
        left: ((x1 / imgW) * 100).toFixed(2),
        bottom: (((imgH - y2) / imgH) * 100).toFixed(2),
        width: (((x2 - x1) / imgW) * 100).toFixed(2),
        height: (((y2 - y1) / imgH) * 100).toFixed(2)
    };
    const { row, buttonIndex } = activeMappingInfo;
    const buttons = JSON.parse(row.dataset.buttons);
    buttons[buttonIndex].coords = coords;
    row.dataset.buttons = JSON.stringify(buttons);
    const setAreaBtn = row.querySelectorAll('.set-area-btn')[buttonIndex];
    setAreaBtn.textContent = '✅ 영역 설정 완료';
    setAreaBtn.classList.replace('bg-indigo-500', 'bg-green-500');
    setAreaBtn.classList.replace('hover:bg-indigo-600', 'hover:bg-green-600');
}

applyAreaBtn.addEventListener('click', () => {
    if (!activeMappingInfo) return;
    saveSelectionToRow();
    imageMapSection.classList.add('hidden');
    activeMappingInfo = null;
});

cancelAreaBtn.addEventListener('click', () => {
    imageMapSection.classList.add('hidden');
    activeMappingInfo = null;
});

// 코드 생성 함수
function generateCode() {
    let bodyContent = '';
    const platform = document.querySelector('input[name="platform"]:checked').value;
    const imageRows = imageList.querySelectorAll('.image-row');

    let allChecksPassed = true;
    imageRows.forEach((row, index) => {
        if (!allChecksPassed) return;
        const imageUrl = row.querySelector('.image-url').value.trim();
        if (!imageUrl) {
            allChecksPassed = false;
            alert(`이미지 #${index + 1}의 URL을 입력해주세요.`);
            return;
        }
        const buttons = JSON.parse(row.dataset.buttons);
        buttons.forEach((btn, btnIndex) => {
            if (!btn.coords || !btn.coords.width) {
                allChecksPassed = false;
                alert(`이미지 #${index + 1}의 버튼 #${btnIndex + 1} 영역을 설정해주세요.`);
            }
        });
    });
    if(!allChecksPassed) return;

    imageRows.forEach((row) => {
        const imageUrl = row.querySelector('.image-url').value.trim();
        const bgColor = row.querySelector('.bg-color-text').value;
        const buttons = JSON.parse(row.dataset.buttons);

        let contentInsideDiv = `<img src="${imageUrl}" alt="" border="0" style="display: block; width: 100%" />`;

        if (buttons.length > 0) {
            const buttonConfigRows = row.querySelectorAll('.button-config-row');
            buttons.forEach((btn, index) => {
                const configRow = buttonConfigRows[index];
                const buttonType = configRow.querySelector('.button-type').value;
                const style = `position: absolute; bottom: ${btn.coords.bottom}%; left: ${btn.coords.left}%; width: ${btn.coords.width}%; height: ${btn.coords.height}%; text-indent: -9999px; font-size: 0`;
                let buttonTag = '';
                if (buttonType === 'booking') {
                    const airlineCode = configRow.querySelector('.airline-code').value;
                    const jsFunc = platform === 'pc' ? 'promoFixPop' : 'compactPopOpen';
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="javascript:${jsFunc}('${airlineCode}');">항공권 예약하기</a>`;
                } else {
                    const linkUrl = configRow.querySelector('.link-url').value;
                    const linkTarget = (configRow.querySelector('.link-target')?.value) || '_blank';
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="${linkUrl}" target="${linkTarget}">단순 링크</a>`;
                }
                contentInsideDiv += `\n        ${buttonTag}`;
            });
        }
        
        let wrapperDiv;
        const paddingStyle = platform === 'pc' ? 'padding: 0 200px;' : '';
        if (bgColor && bgColor.toUpperCase() !== '#FFFFFF') {
             wrapperDiv = `      <div style="position: relative; ${paddingStyle} background: ${bgColor};">\n        ${contentInsideDiv}\n      </div>\n`;
        } else {
             wrapperDiv = `      <div style="position: relative;">\n        ${contentInsideDiv}\n      </div>\n`;
        }
        bodyContent += wrapperDiv;
    });

    const fullHtml = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>프로모션 ${platform}</title>
  </head>
  <body>
    <!-- 시작 -->
    <div class="new-pb-container event-wrap" style="position: relative; width: 100%;">
${bodyContent.trimEnd()}
    </div>
    <!-- 끝 -->
  </body>
</html>`;
    
    // 내보낼 코드는 항상 디버그 표시 없이 유지
    codeOutput.value = fullHtml;

    // 미리보기 전용: 디버그가 켜져 있으면 스타일 주입
    let previewHtml = fullHtml;
    if (toggleDebugAreas?.checked) {
        const debugStyle = `\n<style> html,body{margin:0;padding:0;} .new-pb-container,.event-wrap{line-height:0;font-size:0} .new-pb-container img{display:block;width:100%;height:auto;border:0} [data-map-anchor]{outline:2px dashed rgba(220,38,38,.9); background: rgba(220,38,38,.2);} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${debugStyle}</head>`);
    } else {
        const baseStyle = `\n<style> html,body{margin:0;padding:0;} .new-pb-container,.event-wrap{line-height:0;font-size:0} .new-pb-container img{display:block;width:100%;height:auto;border:0} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${baseStyle}</head>`);
    }
    previewIframe.srcdoc = previewHtml;
    bindIframeAutoHeight();
}

// 즉시 미리보기 렌더링 (생성 버튼 없이)
function renderPreview() {
    const platform = document.querySelector('input[name="platform"]:checked').value;
    const imageRows = imageList.querySelectorAll('.image-row');
    let bodyContent = '';
    imageRows.forEach((row) => {
        const imageUrl = row.querySelector('.image-url').value.trim();
        if (!imageUrl) return;
        const bgColor = row.querySelector('.bg-color-text').value;
        const buttons = JSON.parse(row.dataset.buttons || '[]');
        let contentInsideDiv = `<img src="${imageUrl}" alt="" border="0" style="display: block; width: 100%" />`;
        if (buttons.length > 0) {
            const buttonConfigRows = row.querySelectorAll('.button-config-row');
            buttons.forEach((btn, index) => {
                if (!btn.coords) return; // 좌표 없는 버튼은 미리보기 생략
                const configRow = buttonConfigRows[index];
                const buttonType = configRow.querySelector('.button-type').value;
                const style = `position: absolute; bottom: ${btn.coords.bottom}%; left: ${btn.coords.left}%; width: ${btn.coords.width}%; height: ${btn.coords.height}%; text-indent: -9999px; font-size: 0`;
                let buttonTag = '';
                if (buttonType === 'booking') {
                    const airlineCode = configRow.querySelector('.airline-code').value;
                    const jsFunc = platform === 'pc' ? 'promoFixPop' : 'compactPopOpen';
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="javascript:${jsFunc}('${airlineCode}');">항공권 예약하기</a>`;
                } else {
                    const linkUrl = configRow.querySelector('.link-url').value;
                    const linkTarget = (configRow.querySelector('.link-target')?.value) || '_blank';
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="${linkUrl}" target="${linkTarget}">단순 링크</a>`;
                }
                contentInsideDiv += `\n        ${buttonTag}`;
            });
        }
        const paddingStyle = platform === 'pc' ? 'padding: 0 200px;' : '';
        const wrapperDiv = (bgColor && bgColor.toUpperCase() !== '#FFFFFF')
            ? `      <div style="position: relative; ${paddingStyle} background: ${bgColor};">\n        ${contentInsideDiv}\n      </div>\n`
            : `      <div style="position: relative;">\n        ${contentInsideDiv}\n      </div>\n`;
        bodyContent += wrapperDiv;
    });
    const fullHtml = `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>프로모션 ${platform}</title>
  </head>
  <body>
    <div class="new-pb-container event-wrap" style="position: relative; width: 100%;">
${bodyContent.trimEnd()}
    </div>
  </body>
</html>`;
    let previewHtml = fullHtml;
    if (toggleDebugAreas?.checked) {
        const debugStyle = `\n<style> html,body{margin:0;padding:0;} .new-pb-container,.event-wrap{line-height:0;font-size:0} .new-pb-container img{display:block;width:100%;height:auto;border:0} [data-map-anchor]{outline:2px dashed rgba(220,38,38,.9); background: rgba(220,38,38,.2);} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${debugStyle}</head>`);
    } else {
        const baseStyle = `\n<style> html,body{margin:0;padding:0;} .new-pb-container,.event-wrap{line-height:0;font-size:0} .new-pb-container img{display:block;width:100%;height:auto;border:0} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${baseStyle}</head>`);
    }
    previewIframe.srcdoc = previewHtml;
    bindIframeAutoHeight();
}

function bindIframeAutoHeight() {
    const recalc = () => {
        try {
            const doc = previewIframe.contentDocument;
            if (!doc) return;
            const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
            previewIframe.style.height = `${height}px`;
            previewIframe.style.transform = 'none';
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
            img.addEventListener('load', recalc, { once: true });
            img.addEventListener('error', recalc, { once: true });
        }
    });
    // DOM 변경 감지
    try {
        const mo = new MutationObserver(recalc);
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true });
    } catch (_) {}
    // 리사이즈 관찰
    if (window.ResizeObserver) {
        try { new ResizeObserver(recalc).observe(doc.documentElement); } catch (_) {}
    }
}

// 전역 이벤트 리스너
addImageBtn.addEventListener('click', addImageRow);
resetBtn.addEventListener('click', initializeApp);
generateBtn.addEventListener('click', generateCode);
copyBtn.addEventListener('click', () => {
    codeOutput.select();
    document.execCommand('copy');
    copyBtn.textContent = '복사 완료!';
    setTimeout(() => { copyBtn.textContent = '복사'; }, 2000);
});

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initializeBenefiaTab();
    setupTabSwitching();
});

// Tab switching functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('text-gray-500', 'hover:text-gray-700');
                btn.classList.remove('text-blue-600');
            });
            button.classList.add('active', 'text-blue-600');
            button.classList.remove('text-gray-500', 'hover:text-gray-700');
            
            // Show selected tab content
            tabContents.forEach(content => {
                if (content.id === `${tabId}-tab`) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });
}

// Benefia Tab Functionality
function initializeBenefiaTab() {
    const benefiaAreas = document.getElementById('benefia-areas');
    const addAreaBtn = document.getElementById('add-benefia-area');
    const benefiaPreview = document.getElementById('benefia-preview');
    const benefiaCodeOutput = document.getElementById('benefia-code-output');
    const copyBenefiaCodeBtn = document.getElementById('copy-benefia-code');
    const generateBenefiaCodeBtn = document.getElementById('generate-benefia-code');
    const resetBenefiaBtn = document.getElementById('reset-benefia-btn');
    const benefiaAnchors = document.getElementById('benefia-anchors');
    const addAnchorBtn = document.getElementById('add-benefia-anchor');
    const addAnchorBtnSecondary = document.getElementById('add-benefia-anchor-secondary');
    const addAreaAnchorBtn = document.getElementById('add-benefia-area-anchor');
    const addAreaCouponBtn = document.getElementById('add-benefia-area-coupon');
    const addAreaLinkBtn = document.getElementById('add-benefia-area-link');
    const benefiaImageRowsContainer = document.getElementById('benefia-image-rows');
    const addBenefiaRowBtn = document.getElementById('benefia-add-image-row');

    let imageListState = []; // [{id, url, areas:[], anchors:[]}]
    let activeImageId = null; // 현재 편집 중인 이미지 ID
    // 활성 이미지의 상태에 매핑되는 별칭 (미리보기/편집 로직의 최소 변경을 위해 유지)
    let areas = [];
    let anchors = [];
    let imageUrl = '';
    let areaCounter = 0;
    let isDrawing = false;
    let startX, startY, currentArea = null;
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
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            item.naturalW = img.naturalWidth || img.width;
            item.naturalH = img.naturalHeight || img.height;
        };
        img.src = item.url;
    }

    // 활성 이미지 레코드 동기화
    function syncActiveRecord() {
        const idx = imageListState.findIndex(x => x.id === activeImageId);
        if (idx >= 0) {
            imageListState[idx].url = imageUrl;
            imageListState[idx].areas = areas;
            imageListState[idx].anchors = anchors;
        }
    }

    // Create image preview container with selection functionality (stacked)
    function createImagePreview() {
        if (!imageListState.length) {
            benefiaPreview.innerHTML = '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
            return;
        }

        // 활성 이미지가 없으면 첫 번째로 지정
        if (!activeImageId) {
            activeImageId = imageListState[0].id;
            imageUrl = imageListState[0].url || '';
            areas = imageListState[0].areas || [];
            anchors = imageListState[0].anchors || [];
        }

        const blocksHtml = imageListState.map(item => {
            const isActive = item.id === activeImageId;
            if (!isActive) {
                return `
                <div class="relative w-full overflow-hidden" style="background:#fff; text-align:left; line-height:0;">
                    <div class="relative" style="margin:0;">
                        ${item.url ? `<img src="${item.url}" alt="미리보기 이미지" style="display:block; width:100%; height:auto; border:0;">` : '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>'}
                    </div>
                </div>`;
            }

            return `
            <div class="relative w-full overflow-hidden" style="background:#fff; text-align:left; line-height:0;">
                <div id="benefia-image-container" class="relative" style="margin:0;">
                    ${imageUrl ? `<img id="benefia-image" src="${imageUrl}" alt="미리보기 이미지" style="display:block; width:100%; height:auto; border:0;">` : '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>'}
                    <div id="benefia-selection" class="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none" style="display: none;"></div>
                    ${areas.map((area, index) => {
                        const { x1, y1, x2, y2 } = area.coords;
                        const width = Math.abs(x2 - x1);
                        const height = Math.abs(y2 - y1);
                        const left = Math.min(x1, x2);
                        const top = Math.min(y1, y2);
                        const isAnchorArea = area.type === 'anchor' && area.href && area.href.startsWith('#');
                        const cls = isAnchorArea ? 'benefia-anchor-box' : 'absolute border-2 border-red-500 bg-red-100 bg-opacity-30 flex items-center justify-center';
                        const labelHtml = isAnchorArea ? `<span class=\"benefia-anchor-label\">ANCHOR</span>` : `<span class=\"bg-red-500 text-white text-xs px-1 rounded absolute -top-3 -left-px\">${index + 1}</span>`;
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
                    }).join('')}
                    ${anchors.map(a => {
                        const left = Math.round(a.x);
                        const top = Math.round(a.y);
                        return `<div class="benefia-anchor-pin" data-anchor-id="${a.id}" style="left:${left}px; top:${top}px" title="${a.id}"></div>`;
                    }).join('')}
                </div>
                <div class="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">영역을 선택하려면 이미지 위에서 드래그하세요</div>
            </div>`;
        }).join('');

        benefiaPreview.innerHTML = blocksHtml;

        // Get the image element and container
        imageElement = document.getElementById('benefia-image');
        const container = document.getElementById('benefia-image-container');
        const selection = document.getElementById('benefia-selection');

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
                    height: imageRect.height
                };
            }
        };

        // Initial update (only when active image exists in DOM)
        if (imageElement) updateImageRect();
        
        // Update on window resize
        const resizeObserver = new ResizeObserver(updateImageRect);
        resizeObserver.observe(container);
        
        // Update on image load
        imageElement.addEventListener('load', updateImageRect);

        // Mouse down handler (draw new, drag existing area, drag anchor)
        container.addEventListener('mousedown', (e) => {
            if (!imageElement) return;

            const containerRect = container.getBoundingClientRect();
            const anchorPin = e.target.closest('[data-anchor-id]');
            const overlay = e.target.closest('[data-area-id]');

            // Drag anchor pin
            if (anchorPin) {
                const id = anchorPin.getAttribute('data-anchor-id');
                const anc = anchors.find(x => x.id === id);
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
                const areaId = overlay.getAttribute('data-area-id');
                const area = areas.find(a => a.id === areaId);
                if (!area) return;

                // Determine if user grabbed a resize handle
                const handle = e.target.closest('.benefia-handle');
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
                    draggingAreaId = areaId + '::resize::' + dir;
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
                type: 'anchor',
                coords: { x1: startX, y1: startY, x2: startX, y2: startY },
                href: '#anchor',
                alt: '',
                target: ''
            };

            selection.style.left = `${startX}px`;
            selection.style.top = `${startY}px`;
            selection.style.width = '0px';
            selection.style.height = '0px';
            selection.style.display = 'block';

            e.preventDefault();
        });

        // Mouse move handler (draw or drag area/anchor)
        container.addEventListener('mousemove', (e) => {
            const containerRect = container.getBoundingClientRect();

            // Dragging existing area
            if (isDraggingArea && draggingAreaId) {
                // Try area first
                const areaIdOnly = draggingAreaId.split('::')[0];
                const area = areas.find(a => a.id === areaIdOnly);
                const anchorHit = anchors.find(x => x.id === draggingAreaId);

                let mouseX = e.clientX - containerRect.left;
                let mouseY = e.clientY - containerRect.top;
                if (area) {
                    const parts = draggingAreaId.split('::');
                    if (parts[1] === 'resize') {
                        // Resize logic based on direction
                        const dir = parts[2];
                        let { x1, y1, x2, y2 } = area.coords;
                        let left = Math.min(x1, x2);
                        let top = Math.min(y1, y2);
                        let right = Math.max(x1, x2);
                        let bottom = Math.max(y1, y2);

                        if (dir.includes('e')) right = mouseX;
                        if (dir.includes('s')) bottom = mouseY;
                        if (dir.includes('w')) left = mouseX;
                        if (dir.includes('n')) top = mouseY;

                        // Clamp
                        left = Math.max(imageRect.left, Math.min(left, imageRect.left + imageRect.width - 1));
                        top = Math.max(imageRect.top, Math.min(top, imageRect.top + imageRect.height - 1));
                        right = Math.max(left + 1, Math.min(right, imageRect.left + imageRect.width));
                        bottom = Math.max(top + 1, Math.min(bottom, imageRect.top + imageRect.height));

                        area.coords = { x1: left, y1: top, x2: right, y2: bottom };
                        if (imageRect && imageRect.width && imageRect.height) {
                            area.coordsPct = {
                                x1: (left - imageRect.left) / imageRect.width,
                                y1: (top - imageRect.top) / imageRect.height,
                                x2: (right - imageRect.left) / imageRect.width,
                                y2: (bottom - imageRect.top) / imageRect.height,
                            };
                        }
                        const overlay = container.querySelector(`[data-area-id="${area.id}"]`);
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
                        newLeft = Math.max(imageRect.left, Math.min(newLeft, imageRect.left + imageRect.width - dragOrigW));
                        newTop = Math.max(imageRect.top, Math.min(newTop, imageRect.top + imageRect.height - dragOrigH));
                        // Update model coords
                        area.coords = { x1: newLeft, y1: newTop, x2: newLeft + dragOrigW, y2: newTop + dragOrigH };
                        if (imageRect && imageRect.width && imageRect.height) {
                            area.coordsPct = {
                                x1: (newLeft - imageRect.left) / imageRect.width,
                                y1: (newTop - imageRect.top) / imageRect.height,
                                x2: (newLeft - imageRect.left + dragOrigW) / imageRect.width,
                                y2: (newTop - imageRect.top + dragOrigH) / imageRect.height,
                            };
                        }
                        // Update overlay style live
                        const overlay = container.querySelector(`[data-area-id="${area.id}"]`);
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
                    newLeft = Math.max(imageRect.left, Math.min(newLeft, imageRect.left + imageRect.width));
                    newTop = Math.max(imageRect.top, Math.min(newTop, imageRect.top + imageRect.height));
                    anchorHit.x = newLeft;
                    anchorHit.y = newTop;
                    if (imageRect && imageRect.width && imageRect.height) {
                        anchorHit.xp = (newLeft - imageRect.left) / imageRect.width;
                        anchorHit.yp = (newTop - imageRect.top) / imageRect.height;
                    }
                    const pin = container.querySelector(`[data-anchor-id="${draggingAreaId}"]`);
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
                y2: Math.max(startY, y)
            };
            if (imageRect && imageRect.width && imageRect.height) {
                const left = Math.min(startX, x);
                const top = Math.min(startY, y);
                const right = Math.max(startX, x);
                const bottom = Math.max(startY, y);
                currentArea.coordsPct = {
                    x1: (left) / imageRect.width,
                    y1: (top) / imageRect.height,
                    x2: (right) / imageRect.width,
                    y2: (bottom) / imageRect.height,
                };
            }

            e.preventDefault();
        });

        // Mouse up handler (finish draw or drag)
        if (container) container.addEventListener('mouseup', () => {
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
            selection.style.display = 'none';

            const { x1, y1, x2, y2 } = currentArea.coords;
            if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
                areas.push(currentArea);
                renderAreas();
                renderPreview();
            }

            currentArea = null;
        });

        // Remove area when clicking on remove button
        if (container) container.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-area-btn');
            if (removeBtn) {
                const areaId = removeBtn.getAttribute('data-id');
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
    function addArea(type = 'anchor') {
        const areaId = `area-${Date.now()}-${areaCounter++}`;
        const area = {
            id: areaId,
            type,
            coords: { x1: 0, y1: 0, x2: 100, y2: 50 },
            href: type === 'anchor' ? '#anchor' : '',
            alt: '',
            target: '',
            couponIds: ''
        };
        areas.push(area);
        // 이미지별 상태에 동기화
        const itIdx = imageListState.findIndex(x => x.id === activeImageId);
        if (itIdx >= 0) {
            imageListState[itIdx].areas = areas;
        }
        renderAreas();
        renderPreview();
        return area;
    }

    // Remove area
    function removeArea(id) {
        areas = areas.filter(area => area.id !== id);
        const itIdx = imageListState.findIndex(x => x.id === activeImageId);
        if (itIdx >= 0) {
            imageListState[itIdx].areas = areas;
        }
        renderAreas();
        renderPreview();
    }

    // Update area
    function updateArea(id, updates) {
        const area = areas.find(a => a.id === id);
        if (area) {
            Object.assign(area, updates);
            renderPreview();
            // persist to active record
            const itIdx = imageListState.findIndex(x => x.id === activeImageId);
            if (itIdx >= 0) imageListState[itIdx].areas = areas;
        }
    }

    // Render areas list
    function renderAreas() {
        benefiaAreas.innerHTML = '';
        areas.forEach((area, index) => {
            const areaEl = document.createElement('div');
            areaEl.className = 'benefia-area-item';
            areaEl.innerHTML = `
                <div class="benefia-area-header">
                    <h4>영역 #${index + 1}</h4>
                    <button class="remove-area-btn text-red-500 hover:text-red-700" data-id="${area.id}">삭제</button>
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
                            <select class="w-full p-2 border rounded" data-id="${area.id}" data-field="type">
                                <option value="link" ${area.type === 'link' ? 'selected' : ''}>링크</option>
                                <option value="coupon" ${area.type === 'coupon' ? 'selected' : ''}>쿠폰 다운로드</option>
                                <option value="anchor" ${area.type === 'anchor' ? 'selected' : ''}>앵커 이동</option>
                            </select>
                        </div>
                        ${area.type === 'link' ? `
                            <div class="link-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="링크 URL" value="${area.href || ''}" data-id="${area.id}" data-field="href">
                            </div>
                            <div class="alt-text-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="대체 텍스트 (alt)" value="${area.alt || ''}" data-id="${area.id}" data-field="alt">
                            </div>
                            <div class="anchor-target-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="타겟 (기본: _self)" value="${area.target || ''}" data-id="${area.id}" data-field="target">
                            </div>
                        ` : area.type === 'coupon' ? `
                            <div class="coupon-ids-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="쿠폰 ID (쉼표로 구분)" value="${area.couponIds || ''}" data-id="${area.id}" data-field="couponIds">
                            </div>
                        ` : `
                            <div class="anchor-target-input mt-2">
                                <input type="text" class="w-full p-2 border rounded" placeholder="앵커 ID (예: #section1)" value="${area.href || ''}" data-id="${area.id}" data-field="href">
                            </div>
                        `}
                    </div>
                </div>
            `;
            benefiaAreas.appendChild(areaEl);
        });

        // Add event listeners
        document.querySelectorAll('.remove-area-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                removeArea(e.target.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('select[data-field="type"]').forEach(select => {
            select.addEventListener('change', (e) => {
                updateArea(e.target.getAttribute('data-id'), { type: e.target.value });
                renderAreas();
            });
        });

        document.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.getAttribute('data-field');
                const value = e.target.value;
                const id = e.target.getAttribute('data-id');
                updateArea(id, { [field]: value });
            });
        });
        // persist
        const itIdx = imageListState.findIndex(x => x.id === activeImageId);
        if (itIdx >= 0) imageListState[itIdx].areas = areas;
    }

    // Render anchors list
    function renderAnchors() {
        benefiaAnchors.innerHTML = '';
        anchors.forEach((a) => {
            const el = document.createElement('div');
            el.className = 'benefia-area-item';
            el.innerHTML = `
                <div class="benefia-area-header">
                    <h4>앵커: <span class="font-mono">#${a.id}</span></h4>
                    <button class="remove-anchor-btn text-red-500 hover:text-red-700" data-id="${a.id}">삭제</button>
                </div>
                <div class="benefia-area-fields">
                    <div>
                        <div class="p-2 bg-gray-50 rounded text-sm">X: ${Math.round(a.x)} / Y: ${Math.round(a.y)}</div>
                    </div>
                    <div>
                        <input type="text" class="w-full p-2 border rounded" value="#${a.id}" data-id="${a.id}" data-field="id"/>
                        <p class="text-xs text-gray-500 mt-1">변경 시 자동으로 '#' 제거됩니다</p>
                    </div>
                </div>
            `;
            benefiaAnchors.appendChild(el);
        });

        benefiaAnchors.querySelectorAll('.remove-anchor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                anchors = anchors.filter(x => x.id !== id);
                renderAnchors();
                generateBenefiaCode();
                createImagePreview();
                const itIdx = imageListState.findIndex(x => x.id === activeImageId);
                if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
            });
        });

        benefiaAnchors.querySelectorAll('input[data-field="id"]').forEach(inp => {
            // 입력 중에는 즉시 DOM을 리렌더하지 않아 커서가 튀는 문제를 방지
            inp.addEventListener('input', (e) => {
                const prevId = e.target.getAttribute('data-id');
                const vRaw = e.target.value.replace(/^#/, '');
                const a = anchors.find(x => x.id === prevId);
                if (a) {
                    a.id = vRaw; // 공백 포함 임시 허용
                    e.target.setAttribute('data-id', vRaw);
                }
                // 코드/미리보기만 갱신
                generateBenefiaCode();
                createImagePreview();
                const itIdx = imageListState.findIndex(x => x.id === activeImageId);
                if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
            });
            // 포커스 해제 시 정규화하고 목록을 리렌더
            inp.addEventListener('blur', (e) => {
                let v = e.target.value.replace(/^#/, '').trim();
                if (!v) v = 'anchor';
                const prevId = e.target.getAttribute('data-id');
                const a = anchors.find(x => x.id === prevId) || anchors.find(x => x.id === v);
                if (a) a.id = v;
                renderAnchors();
                createImagePreview();
                generateBenefiaCode();
                const itIdx = imageListState.findIndex(x => x.id === activeImageId);
                if (itIdx >= 0) imageListState[itIdx].anchors = anchors;
            });
        });
    }

    // Generate Benefia code (percent-based absolute anchors, no image map)
    function generateBenefiaCode() {
        if (!imageListState.length) { benefiaCodeOutput.value = ''; return; }

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
                    left: (x1 / nW * 100).toFixed(2),
                    top: (y1 / nH * 100).toFixed(2),
                    width: ((x2 - x1) / nW * 100).toFixed(2),
                    height: ((y2 - y1) / nH * 100).toFixed(2),
                };
            }
            return { left: '0', top: '0', width: '0', height: '0' };
        };

        const blocks = imageListState.filter(it => it.url).map((item) => {
            const nW = item.naturalW || 0;
            const nH = item.naturalH || 0;

            const overlayCode = (item.areas || []).map(area => {
                const r = toPctRect(area, nW, nH);
                const style = `position: absolute; top: ${r.top}%; left: ${r.left}%; width: ${r.width}%; height: ${r.height}%; text-indent: -9999px;`;
                if (area.type === 'coupon' && area.couponIds) {
                    const ids = area.couponIds.split(',').map(id => `'${id.trim()}'`).filter(Boolean).join(', ');
                    return `      <a href="javascript:void(0)" onclick="couponDownloadAll([${ids}]); return false;" style="${style}"></a>`;
                } else if (area.type === 'anchor') {
                    return `      <a href="${area.href || '#'}" style="${style}"></a>`;
                } else {
                    const target = area.target ? ` target="${area.target}"` : '';
                    return `      <a href="${area.href || '#'}"${target} style="${style}"></a>`;
                }
            }).join('\n');

            const anchorCode = (item.anchors || []).map(a => {
                const left = typeof a.xp === 'number' ? (a.xp * 100).toFixed(2) : '0';
                const top = typeof a.yp === 'number' ? (a.yp * 100).toFixed(2) : '0';
                return `      <div id="${a.id}" style="position:absolute; left:${left}%; top:${top}%; width:1px; height:1px; overflow:hidden;">&nbsp;</div>`;
            }).join('\n');

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
        }).join('\n\n');

        benefiaCodeOutput.value = blocks.trim();
    }

    // Render image rows UI (투어비스와 유사한 행 기반)
    function renderImageListUI() {
        if (!benefiaImageRowsContainer) return;
        benefiaImageRowsContainer.innerHTML = '';
        imageListState.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'p-4 border rounded-lg bg-gray-50 benefia-image-row';
            row.dataset.id = item.id;
            row.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <label class="font-semibold text-gray-700">이미지 #${idx + 1}</label>
                    <button class="remove-row text-red-500 hover:text-red-700 text-sm font-bold">삭제</button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                        <input type="text" placeholder="https://example.com/image.jpg" class="image-url w-full p-2 border border-gray-300 rounded-md" value="${item.url || ''}">
                    </div>
                    <div class="flex items-start space-x-4">
                        <img src="${item.url || ''}" class="thumbnail-preview mt-1 ${item.url ? '' : 'hidden'}">
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
            const urlInput = row.querySelector('.image-url');
            urlInput.addEventListener('input', (e) => {
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
            row.querySelector('.remove-row').addEventListener('click', () => {
                imageListState = imageListState.filter(x => x.id !== item.id);
                if (activeImageId === item.id) {
                    const first = imageListState[0];
                    activeImageId = first ? first.id : null;
                    imageUrl = first ? (first.url || '') : '';
                    areas = first ? (first.areas || []) : [];
                    anchors = first ? (first.anchors || []) : [];
                }
                renderImageListUI();
                renderPreview();
            });
            // clicking the row sets it active
            row.addEventListener('click', (e) => {
                if (e.target.closest('input')) return;
                activeImageId = item.id;
                imageUrl = item.url || '';
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
        imageUrl = '';
        if (benefiaImageRowsContainer) benefiaImageRowsContainer.innerHTML = '';
        benefiaPreview.innerHTML = '<p class="text-gray-500 text-center py-20">이미지 URL을 입력하세요</p>';
        benefiaCodeOutput.value = '';
        renderAreas();
        renderAnchors();
    }

    // Event listeners
    addAreaBtn?.addEventListener('click', () => addArea('anchor'));
    addAreaAnchorBtn?.addEventListener('click', () => addArea('anchor'));
    addAreaCouponBtn?.addEventListener('click', () => addArea('coupon'));
    addAreaLinkBtn?.addEventListener('click', () => addArea('link'));
    // Add anchor button handler
    function addAnchor() {
        if (!imageElement || !imageRect) {
            alert('먼저 이미지 URL을 입력하세요.');
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
        addAnchorBtn.addEventListener('click', addAnchor);
    }
    if (addAnchorBtnSecondary) {
        addAnchorBtnSecondary.addEventListener('click', addAnchor);
    }
    copyBenefiaCodeBtn.addEventListener('click', () => {
        benefiaCodeOutput.select();
        document.execCommand('copy');
        const originalText = copyBenefiaCodeBtn.textContent;
        copyBenefiaCodeBtn.textContent = '복사됨!';
        setTimeout(() => {
            copyBenefiaCodeBtn.textContent = originalText;
        }, 2000);
    });
    // 코드 생성 버튼: 현재 상태를 코드 텍스트에 반영
    if (generateBenefiaCodeBtn) {
        generateBenefiaCodeBtn.addEventListener('click', () => {
            generateBenefiaCode();
            generateBenefiaCodeBtn.textContent = '생성 완료';
            setTimeout(() => generateBenefiaCodeBtn.textContent = '코드 생성', 1500);
        });
    }
    resetBenefiaBtn.addEventListener('click', resetBenefia);
    if (addBenefiaRowBtn) {
        addBenefiaRowBtn.addEventListener('click', () => {
            const id = `img-${Date.now()}`;
            imageListState.push({ id, url: '', areas: [], anchors: [] });
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
