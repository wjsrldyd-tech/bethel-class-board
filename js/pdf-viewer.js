// PDF 뷰어 로직
const pdfViewer = {
    pdfDoc: null,
    currentPage: 1,
    scale: 1.0,
    container: null,
    wrapper: null,
    viewMode: 'single', // 'single' or 'spread'

    async init() {
        this.container = document.getElementById('pdfViewerContainer');
        this.wrapper = document.getElementById('pdfViewer');
        
        // PDF.js 워커 설정
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    setupEventListeners() {
        // 페이지 네비게이션
        document.getElementById('prevPage').addEventListener('click', () => {
            this.prevPage();
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.nextPage();
        });

        // 줌 컨트롤
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoomIn();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoomOut();
        });

        document.getElementById('fitToWidth').addEventListener('click', () => {
            this.fitToWidth();
        });

        document.getElementById('fitToHeight').addEventListener('click', () => {
            this.fitToHeight();
        });

        // 뷰 모드 전환
        document.getElementById('viewModeBtn').addEventListener('click', () => {
            this.toggleViewMode();
        });

        // 전체화면
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 마우스 휠 이벤트 처리
        this.container.addEventListener('wheel', (e) => {
            // Ctrl/Cmd + 휠: 줌 인/아웃
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            }
            // Shift + 휠: 좌우 스크롤
            else if (e.shiftKey) {
                e.preventDefault();
                this.container.scrollLeft += e.deltaY;
            }
            // 일반 휠: 위아래 스크롤 (기본 동작 유지)
        });
    },

    async loadPdf(filePath) {
        try {
            const loadingTask = pdfjsLib.getDocument(filePath);
            this.pdfDoc = await loadingTask.promise;
            this.currentPage = 1;
            this.scale = 1.0;
            this.viewMode = 'single';
            await this.renderPage();
            this.updatePageInfo();
            this.updateViewModeButton();
        } catch (error) {
            console.error('PDF 로드 오류:', error);
            throw error;
        }
    },

    async renderPage() {
        if (!this.pdfDoc) return;

        // 기존 내용 제거
        this.wrapper.innerHTML = '';

        if (this.viewMode === 'spread') {
            await this.renderSpreadPages();
        } else {
            await this.renderSinglePage();
        }
    },

    async renderSinglePage() {
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: this.scale });

        // 캔버스 생성
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // PDF 렌더링
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // 페이지 컨테이너 생성
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.style.width = viewport.width + 'px';
        pageWrapper.style.height = viewport.height + 'px';
        
        // 캔버스 추가
        pageWrapper.appendChild(canvas);
        
        // 필기 캔버스 추가
        const drawingCanvas = document.createElement('canvas');
        drawingCanvas.className = 'drawing-canvas';
        drawingCanvas.id = 'drawingCanvas';
        drawingCanvas.width = viewport.width;
        drawingCanvas.height = viewport.height;
        drawingCanvas.style.width = viewport.width + 'px';
        drawingCanvas.style.height = viewport.height + 'px';
        pageWrapper.appendChild(drawingCanvas);
        
        pageContainer.appendChild(pageWrapper);
        this.wrapper.appendChild(pageContainer);

        // 필기 기능 초기화
        if (window.drawingTool) {
            window.drawingTool.init(drawingCanvas, viewport.width, viewport.height);
        }
    },

    async renderSpreadPages() {
        // 2페이지 나란히 보기
        const page1 = await this.pdfDoc.getPage(this.currentPage);
        const viewport1 = page1.getViewport({ scale: this.scale });
        
        let page2 = null;
        let viewport2 = null;
        
        // 다음 페이지가 있으면 함께 렌더링
        if (this.currentPage < this.pdfDoc.numPages) {
            page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            viewport2 = page2.getViewport({ scale: this.scale });
        }

        // 페이지 컨테이너 생성
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container pdf-spread-container';
        
        // 첫 번째 페이지
        const canvas1 = document.createElement('canvas');
        const context1 = canvas1.getContext('2d');
        canvas1.height = viewport1.height;
        canvas1.width = viewport1.width;

        await page1.render({
            canvasContext: context1,
            viewport: viewport1
        }).promise;

        const pageWrapper1 = document.createElement('div');
        pageWrapper1.className = 'pdf-page-wrapper pdf-spread-page';
        pageWrapper1.style.width = viewport1.width + 'px';
        pageWrapper1.style.height = viewport1.height + 'px';
        pageWrapper1.appendChild(canvas1);
        
        // 필기 캔버스 추가 (첫 번째 페이지)
        const drawingCanvas1 = document.createElement('canvas');
        drawingCanvas1.className = 'drawing-canvas';
        drawingCanvas1.id = 'drawingCanvas';
        drawingCanvas1.width = viewport1.width;
        drawingCanvas1.height = viewport1.height;
        drawingCanvas1.style.width = viewport1.width + 'px';
        drawingCanvas1.style.height = viewport1.height + 'px';
        pageWrapper1.appendChild(drawingCanvas1);
        
        pageContainer.appendChild(pageWrapper1);

        // 두 번째 페이지 (있는 경우)
        if (page2 && viewport2) {
            const canvas2 = document.createElement('canvas');
            const context2 = canvas2.getContext('2d');
            canvas2.height = viewport2.height;
            canvas2.width = viewport2.width;

            await page2.render({
                canvasContext: context2,
                viewport: viewport2
            }).promise;

            const pageWrapper2 = document.createElement('div');
            pageWrapper2.className = 'pdf-page-wrapper pdf-spread-page';
            pageWrapper2.style.width = viewport2.width + 'px';
            pageWrapper2.style.height = viewport2.height + 'px';
            pageWrapper2.appendChild(canvas2);
            
            // 두 번째 페이지는 필기 기능 없음 (간단화)
            pageContainer.appendChild(pageWrapper2);
        }

        this.wrapper.appendChild(pageContainer);

        // 필기 기능 초기화 (첫 번째 페이지만)
        if (window.drawingTool) {
            window.drawingTool.init(drawingCanvas1, viewport1.width, viewport1.height);
        }
    },

    prevPage() {
        if (this.viewMode === 'spread') {
            // 2페이지 모드에서는 2페이지씩 이동
            if (this.currentPage > 1) {
                this.currentPage = Math.max(1, this.currentPage - 2);
                this.renderPage();
                this.updatePageInfo();
            }
        } else {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPage();
                this.updatePageInfo();
            }
        }
    },

    nextPage() {
        if (this.viewMode === 'spread') {
            // 2페이지 모드에서는 2페이지씩 이동
            if (this.currentPage < this.pdfDoc.numPages - 1) {
                this.currentPage = Math.min(this.pdfDoc.numPages - 1, this.currentPage + 2);
                this.renderPage();
                this.updatePageInfo();
            }
        } else {
            if (this.currentPage < this.pdfDoc.numPages) {
                this.currentPage++;
                this.renderPage();
                this.updatePageInfo();
            }
        }
    },

    zoomIn() {
        this.scale = Math.min(this.scale + 0.25, 3.0);
        this.renderPage();
        this.updateZoomLevel();
    },

    zoomOut() {
        this.scale = Math.max(this.scale - 0.25, 0.5);
        this.renderPage();
        this.updateZoomLevel();
    },

    async fitToWidth() {
        if (!this.pdfDoc) return;
        
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // 컨테이너의 가로폭 계산 (패딩 제외)
        let containerWidth = this.container.clientWidth - 64; // 좌우 패딩 32px * 2
        
        // 2페이지 모드일 때는 두 페이지 너비 + 간격 고려
        if (this.viewMode === 'spread' && this.currentPage < this.pdfDoc.numPages) {
            const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            const viewport2 = page2.getViewport({ scale: 1.0 });
            const totalWidth = viewport.width + viewport2.width + 32; // 페이지 간격 32px
            containerWidth = containerWidth - 32; // 추가 간격 고려
            const scale = containerWidth / totalWidth;
            this.scale = Math.max(0.5, Math.min(scale, 3.0));
        } else {
            const scale = containerWidth / viewport.width;
            this.scale = Math.max(0.5, Math.min(scale, 3.0));
        }
        
        await this.renderPage();
        this.updateZoomLevel();
    },

    async fitToHeight() {
        if (!this.pdfDoc) return;
        
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // 컨테이너의 세로폭 계산 (패딩 제외)
        const containerHeight = this.container.clientHeight - 64; // 상하 패딩 32px * 2
        const scale = containerHeight / viewport.height;
        
        this.scale = Math.max(0.5, Math.min(scale, 3.0));
        await this.renderPage();
        this.updateZoomLevel();
    },

    toggleViewMode() {
        this.viewMode = this.viewMode === 'single' ? 'spread' : 'single';
        this.renderPage();
        this.updateViewModeButton();
    },

    updateViewModeButton() {
        const btn = document.getElementById('viewModeBtn');
        if (this.viewMode === 'spread') {
            btn.classList.add('active');
            btn.title = '1페이지 보기';
        } else {
            btn.classList.remove('active');
            btn.title = '2페이지 나란히 보기';
        }
    },

    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (this.pdfDoc) {
            if (this.viewMode === 'spread' && this.currentPage < this.pdfDoc.numPages) {
                pageInfo.textContent = `${this.currentPage}-${this.currentPage + 1} / ${this.pdfDoc.numPages}`;
            } else {
                pageInfo.textContent = `${this.currentPage} / ${this.pdfDoc.numPages}`;
            }
        }
        
        // 버튼 활성화/비활성화
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        // 2페이지 모드일 때는 마지막 페이지에서도 다음 버튼 비활성화
        if (this.viewMode === 'spread') {
            document.getElementById('nextPage').disabled = this.currentPage >= this.pdfDoc.numPages - 1;
        } else {
            document.getElementById('nextPage').disabled = this.currentPage >= this.pdfDoc.numPages;
        }
    },

    updateZoomLevel() {
        const zoomLevel = document.getElementById('zoomLevel');
        zoomLevel.textContent = Math.round(this.scale * 100) + '%';
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            document.body.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen');
        }
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    pdfViewer.init();
});


