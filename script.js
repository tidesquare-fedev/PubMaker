// DOM 요소들을 script.js 파일 상단에서 한 번만 찾도록 정의합니다.
const imageList = document.getElementById('image-list');
const addImageBtn = document.getElementById('add-image-btn');
const resetBtn = document.getElementById('reset-btn');
const generateBtn = document.getElementById('generate-btn');
const copyBtn = document.getElementById('copy-btn');
const previewIframe = document.getElementById('preview-iframe');
const codeOutput = document.getElementById('code-output');
const imageMapSection = document.getElementById('image-map-section');
const mapperImage = document.getElementById('mapper-image');
const canvasContainer = document.getElementById('canvas-container');
const selectionBox = document.getElementById('selection-box');
const coordsInfo = document.getElementById('coords-info');

let imageCounter = 0;
let isFirstClick = true;
let activeMappingInfo = null;
let firstClickCoords = null;

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
    } else {
        thumbnail.classList.add('hidden');
    }
}

// 영역 설정 이미지 로드 완료 핸들러
mapperImage.onload = () => {
    if (!activeMappingInfo) return;
    coordsInfo.textContent = '버튼의 왼쪽 상단을 클릭하세요.';
    isFirstClick = true;
    firstClickCoords = null;
    selectionBox.style.display = 'none';
    window.scrollTo({ top: imageMapSection.offsetTop, behavior: 'smooth' });
};

// 영역 설정 이미지 로드 에러 핸들러
mapperImage.onerror = () => {
    alert('이미지를 불러올 수 없습니다. 이미지 서버의 CORS 정책 때문일 수 있습니다. 이미지를 다른 호스팅 서비스(예: postimages.org)에 업로드한 후 다시 시도해 보세요.');
    imageMapSection.classList.add('hidden');
    activeMappingInfo = null;
};

// 영역 지정(클릭) 이벤트 핸들러
canvasContainer.addEventListener('click', (e) => {
    if (!activeMappingInfo) return;

    const rect = mapperImage.getBoundingClientRect();
    const scaleX = mapperImage.naturalWidth / rect.width;
    const scaleY = mapperImage.naturalHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (isFirstClick) {
        firstClickCoords = { x, y };
        isFirstClick = false;
        coordsInfo.textContent = `시작: (${x}, ${y}). 이제 오른쪽 하단을 클릭하세요.`;
        selectionBox.style.left = `${(e.clientX - rect.left)}px`;
        selectionBox.style.top = `${(e.clientY - rect.top)}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    } else {
        const x1 = Math.min(firstClickCoords.x, x);
        const y1 = Math.min(firstClickCoords.y, y);
        const x2 = Math.max(firstClickCoords.x, x);
        const y2 = Math.max(firstClickCoords.y, y);
        const imgWidth = mapperImage.naturalWidth;
        const imgHeight = mapperImage.naturalHeight;

        if (imgWidth === 0 || imgHeight === 0) {
            alert("이미지 크기를 가져올 수 없습니다.");
            return;
        }

        const coords = {
            left: ((x1 / imgWidth) * 100).toFixed(2),
            bottom: (((imgHeight - y2) / imgHeight) * 100).toFixed(2),
            width: (((x2 - x1) / imgWidth) * 100).toFixed(2),
            height: (((y2 - y1) / imgHeight) * 100).toFixed(2)
        };
        
        const { row, buttonIndex } = activeMappingInfo;
        const buttons = JSON.parse(row.dataset.buttons);
        buttons[buttonIndex].coords = coords;
        row.dataset.buttons = JSON.stringify(buttons);
        
        const setAreaBtn = row.querySelectorAll('.set-area-btn')[buttonIndex];
        setAreaBtn.textContent = '✅ 영역 설정 완료';
        setAreaBtn.classList.replace('bg-indigo-500', 'bg-green-500');
        setAreaBtn.classList.replace('hover:bg-indigo-600', 'hover:bg-green-600');

        imageMapSection.classList.add('hidden');
        activeMappingInfo = null;
        firstClickCoords = null;
        isFirstClick = true;
    }
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
                    buttonTag = `<a style="${style}" href="javascript:${jsFunc}('${airlineCode}');">항공권 예약하기</a>`;
                } else {
                    const linkUrl = configRow.querySelector('.link-url').value;
                    buttonTag = `<a style="${style}" href="${linkUrl}" target="_blank">단순 링크</a>`;
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
    
    codeOutput.value = fullHtml;
    previewIframe.srcdoc = fullHtml;

    const previewContainerWidth = previewIframe.parentElement.clientWidth;
    const finalWidth = platform === 'pc' ? 1200 : 375;
    if (previewContainerWidth < finalWidth) {
        const scale = previewContainerWidth / finalWidth;
        previewIframe.style.transform = `scale(${scale})`;
        previewIframe.style.height = `${600 * scale}px`;
    } else {
         previewIframe.style.transform = 'scale(1)';
         previewIframe.style.height = '600px';
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

// 앱 시작
initializeApp();
