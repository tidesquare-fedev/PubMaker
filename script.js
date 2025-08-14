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
        activeMappingInfo = { row: imageRow, buttonIndex: buttonIndex };
        mapperImage.crossOrigin = "anonymous";
        mapperImage.src = imageUrl;
        
        imageMapSection.classList.remove('hidden');
        coordsInfo.textContent = '이미지 로딩 중...';
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
        coordsInfo.textContent = '이미지를 불러올 수 없습니다. CORS 문제일 수 있습니다. 다른 호스팅(예: postimages.org)으로 업로드 후 다시 시도해 주세요.';
        lastImageErrorUrl = failedUrl;
    }
    imageMapSection.classList.add('hidden');
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
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="${linkUrl}" target="_blank">단순 링크</a>`;
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
        const debugStyle = `\n<style> [data-map-anchor]{outline:2px dashed rgba(220,38,38,.9); background: rgba(220,38,38,.2);} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${debugStyle}</head>`);
    }
    previewIframe.srcdoc = previewHtml;
    adjustPreviewHeight();
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
                    buttonTag = `<a data-map-anchor="true" style="${style}" href="${linkUrl}" target="_blank">단순 링크</a>`;
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
        const debugStyle = `\n<style> [data-map-anchor]{outline:2px dashed rgba(220,38,38,.9); background: rgba(220,38,38,.2);} </style>\n`;
        previewHtml = fullHtml.replace('</head>', `${debugStyle}</head>`);
    }
    previewIframe.srcdoc = previewHtml;
    adjustPreviewHeight();
}

function adjustPreviewHeight() {
    // srcdoc는 동일 출처라 접근 가능
    setTimeout(() => {
        try {
            const doc = previewIframe.contentDocument;
            if (doc) {
                const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
                previewIframe.style.height = `${height}px`;
                previewIframe.style.transform = 'none';
            }
        } catch (_) {}
    }, 50);
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

// 앱 시작
initializeApp();
