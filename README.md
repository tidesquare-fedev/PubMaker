# 프로모션 퍼블 자동 생성기

반복적인 프로모션 페이지 퍼블리싱 작업을 자동화합니다. 이미지 URL과 버튼/영역 정보를
입력하면 PC·모바일용 HTML 코드를 생성해 줍니다.

배포: https://pub-maker-drab.vercel.app/

## 로컬 개발 환경

```bash
npm install      # 최초 1회
npm run dev      # 개발 서버 (http://localhost:5173, 자동 새로고침)
npm test         # 코드 생성 로직 + UI 배선 테스트
npm run build    # 배포 산출물 생성 → dist/
npm run preview  # 빌드 결과 확인 (http://localhost:4173)
npm run format   # Prettier 포맷팅
```

`js/*.js` 는 전역 스코프를 공유하는 일반 스크립트(non-module)라 Vite 가 번들하지 않고,
`vite.config.js` 의 `copy-plain-scripts` 플러그인이 `dist/js/` 로 그대로 복사합니다.
따라서 **스크립트 로드 순서**(`common → features → tourism → benefia → skt`)가 중요합니다.

## 프로젝트 구조

```
index.html          메인 화면 (생성기 3개 탭)
style.css           스타일
js/
  common.js         클립보드 복사 · HEX 유틸 · 상단 탭 전환
  features.js       공통 기능 모듈 (탭 스크롤 / 스티키 탭 / 영상) — PubFeatures
  tourism.js        투어비스(항공일반) 생성기
  benefia.js        베네피아·휴가샵 생성기
  skt.js            SKT 생성기
test/
  features.test.mjs 코드 생성 함수 단위 테스트
  dom.test.mjs      jsdom 으로 index.html 을 올려 UI 배선 검증
docs/
  사용설명서.md         사용법 + 기능점검 체크리스트 (실무 기준서)
  사용가이드-원고.md     PDF 배포용 가이드 원고 (스크린샷 자리 표시 포함)
  스크린샷-촬영목록.md   원고에 넣을 화면 12장의 촬영 방법
  기능개선-계획서.md    탭 스크롤 · 스티키 탭 · 영상 첨부 설계 문서
```

## 생성기 공통 기능

| 기능           | 설명                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 탭 스크롤      | 탭 클릭 시 같은 페이지 내 섹션으로 이동. 섹션 마커는 `가로 전체 폭 / 높이 1px` 로 출력되어 반응형에서 위치가 흔들리지 않습니다. |
| 스티키 탭      | 스크롤 시 탭바가 상단 고정되고, 현재 위치에 따라 탭 이미지가 `_off` ↔ `_on` 으로 자동 전환됩니다.                               |
| 탭 콘텐츠 전환 | 탭 클릭 시 스크롤 없이 제자리에서 콘텐츠가 교체됩니다. 한 페이지에 그룹을 여러 개 둘 수 있습니다.                               |
| 영상 첨부      | 이미지 위 %좌표에 유튜브 iframe 또는 mp4 `<video>` 를 배치합니다.                                                               |

- 조작법과 점검 항목은 **[사용설명서](docs/사용설명서.md)**
- 레퍼런스 마크업 분석과 설계 근거는 [기능개선-계획서](docs/기능개선-계획서.md)
