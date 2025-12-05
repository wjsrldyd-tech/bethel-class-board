# 벧엘 전자칠판

전자칠판용 PDF 뷰어 및 필기 도구

## 기능

- 📚 학년/단원별 PDF 파일 관리
- 📄 PDF 뷰어 (페이지 이동, 줌)
- ✏️ 필기 도구 (펜, 하이라이트, 지우개)
- 👆 터치 제스처 지원 (스와이프, 핀치 줌)
- 🖥️ 전체화면 모드

## 설치

```bash
npm install
```

## 실행

```bash
npm start
```

## 빌드

```bash
npm run build-win
```

## PDF 파일 구조

PDF 파일은 **프로젝트 폴더 외부**의 `pdfs/` 폴더에 다음과 같은 구조로 저장하세요:

예: 프로젝트가 `C:\Projects\bethel-class-board`에 있다면
PDF 폴더는 `C:\Projects\pdfs\`에 위치합니다.

```
C:\Projects\pdfs\
├── 1학년/
│   ├── 1단원.pdf
│   ├── 2단원.pdf
│   └── ...
├── 2학년/
│   ├── 1단원.pdf
│   └── ...
└── ...
```

**참고:** PDF 파일은 Git에 커밋되지 않습니다. 각자 로컬에서 관리하세요.

## 사용 방법

1. 앱 실행 후 좌측 사이드바에서 학년 선택
2. 해당 학년의 단원 목록이 표시됨
3. 단원 클릭 시 PDF가 열림
4. 상단 툴바에서 필기 도구 선택
5. PDF 위에 필기 가능
6. 전체화면 버튼으로 전체화면 모드 전환

## 기술 스택

- Electron
- HTML/CSS/JavaScript
- PDF.js
- Canvas API

