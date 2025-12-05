// PDF 뷰어 로직
const pdfViewer = {
    pdfDoc: null,
    currentPage: 1,
    scale: 1.0,
    container: null,
    wrapper: null,

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

        // 전체화면
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 마우스 휠 줌
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            }
        });
    },

    async loadPdf(filePath) {
        try {
            const loadingTask = pdfjsLib.getDocument(filePath);
            this.pdfDoc = await loadingTask.promise;
            this.currentPage = 1;
            this.scale = 1.0;
            await this.renderPage();
            this.updatePageInfo();
        } catch (error) {
            console.error('PDF 로드 오류:', error);
            throw error;
        }
    },

    async renderPage() {
        if (!this.pdfDoc) return;

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

        // 기존 내용 제거
        this.wrapper.innerHTML = '';
        
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

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
            this.updatePageInfo();
        }
    },

    nextPage() {
        if (this.currentPage < this.pdfDoc.numPages) {
            this.currentPage++;
            this.renderPage();
            this.updatePageInfo();
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
        const containerWidth = this.container.clientWidth - 64; // 좌우 패딩 32px * 2
        const scale = containerWidth / viewport.width;
        
        this.scale = Math.max(0.5, Math.min(scale, 3.0));
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

    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (this.pdfDoc) {
            pageInfo.textContent = `${this.currentPage} / ${this.pdfDoc.numPages}`;
        }
        
        // 버튼 활성화/비활성화
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= this.pdfDoc.numPages;
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


