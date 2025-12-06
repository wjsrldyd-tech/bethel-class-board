// PDF 뷰어 로직 - 화이트보드 기반
const pdfViewer = {
    pdfDoc: null,
    currentPage: 1,
    zoomScale: 1.0,
    whiteboardCanvas: null,
    whiteboardCtx: null,
    container: null,
    viewMode: 'single', // 'single' or 'spread'
    
    // PDF 이미지 데이터 저장 (여러 페이지)
    pdfImages: [], // {canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number, pageNum: number}[]
    
    // 필기 레이어 캔버스 (필기 내용 보존용)
    drawingLayerCanvas: null,
    
    // 현재 모드
    currentMode: 'draw', // 'draw' or 'move'
    isDraggingPdf: false,
    dragStartX: 0,
    dragStartY: 0,
    dragPdfIndex: -1,
    
    // PDF 페이지 위치 추적
    pdfPositions: [], // {x: number, y: number}[]

    async init() {
        this.container = document.getElementById('whiteboard-container');
        this.whiteboardCanvas = document.getElementById('whiteboardCanvas');
        
        if (!this.whiteboardCanvas) {
            console.error('Whiteboard canvas not found');
            return;
        }
        
        this.whiteboardCtx = this.whiteboardCanvas.getContext('2d');
        
        // 캔버스 크기 설정
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // PDF.js 워커 설정
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 브라우저 전체화면 변경 감지 (ESC 키로 종료 시에도 처리)
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange(!!document.fullscreenElement);
        });
        
        // Electron 전체화면 변경 감지 (F11 키)
        if (window.electronAPI && window.electronAPI.onFullscreenChanged) {
            window.electronAPI.onFullscreenChanged((isFullscreen) => {
                this.handleFullscreenChange(isFullscreen);
            });
        }
        
        // drawing.js 초기화 (drawing.js가 이 컨텍스트를 사용할 수 있도록)
        if (window.drawingTool) {
            setTimeout(() => {
                window.drawingTool.init(this.whiteboardCanvas);
            }, 50);
        }
    },
    
    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.whiteboardCanvas.width = rect.width;
        this.whiteboardCanvas.height = rect.height;
        
        // 필기 레이어 캔버스도 리사이즈
        if (this.drawingLayerCanvas) {
            this.drawingLayerCanvas.width = rect.width;
            this.drawingLayerCanvas.height = rect.height;
        }
        
        this.draw();
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
        
        // 모드 전환 버튼
        document.getElementById('drawModeBtn').addEventListener('click', () => {
            this.setMode('draw');
        });
        
        document.getElementById('moveModeBtn').addEventListener('click', () => {
            this.setMode('move');
        });
        
        // 마우스 휠 이벤트 처리 (줌)
        this.whiteboardCanvas.addEventListener('wheel', (e) => {
            // Ctrl/Cmd + 휠: 줌 인/아웃
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = this.whiteboardCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                if (e.deltaY < 0) {
                    this.zoomInAt(x, y);
                } else {
                    this.zoomOutAt(x, y);
                }
            }
        }, { passive: false });
        
        // 문서 이동 모드를 위한 이벤트
        this.whiteboardCanvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.whiteboardCanvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.whiteboardCanvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.whiteboardCanvas.addEventListener('mouseleave', () => this.handleCanvasMouseUp(null));
    },
    
    setMode(mode) {
        this.currentMode = mode;
        
        // 버튼 활성화 상태 업데이트
        document.getElementById('drawModeBtn').classList.toggle('active', mode === 'draw');
        document.getElementById('moveModeBtn').classList.toggle('active', mode === 'move');
        
        // 커서 변경
        if (mode === 'draw') {
            this.whiteboardCanvas.style.cursor = 'crosshair';
        } else {
            this.whiteboardCanvas.style.cursor = 'grab';
        }
    },
    
    handleCanvasMouseDown(e) {
        if (this.currentMode !== 'move') return;
        
        const rect = this.whiteboardCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomScale;
        const y = (e.clientY - rect.top) / this.zoomScale;
        
        // 클릭한 위치가 PDF 이미지 위인지 확인
        this.dragPdfIndex = this.getPdfAtPosition(x, y);
        
        if (this.dragPdfIndex >= 0) {
            this.isDraggingPdf = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.whiteboardCanvas.style.cursor = 'grabbing';
        }
    },
    
    handleCanvasMouseMove(e) {
        if (this.currentMode !== 'move' || !this.isDraggingPdf || this.dragPdfIndex < 0) return;
        
        const deltaX = (e.clientX - this.dragStartX) / this.zoomScale;
        const deltaY = (e.clientY - this.dragStartY) / this.zoomScale;
        
        const pdfImage = this.pdfImages[this.dragPdfIndex];
        if (pdfImage) {
            pdfImage.x += deltaX;
            pdfImage.y += deltaY;
            this.draw();
        }
        
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
    },
    
    handleCanvasMouseUp(e) {
        if (this.isDraggingPdf) {
            this.isDraggingPdf = false;
            this.dragPdfIndex = -1;
            if (this.currentMode === 'move') {
                this.whiteboardCanvas.style.cursor = 'grab';
            }
        }
    },
    
    getPdfAtPosition(x, y) {
        // 뒤에서부터 확인 (마지막에 그려진 것이 위에 있음)
        for (let i = this.pdfImages.length - 1; i >= 0; i--) {
            const pdf = this.pdfImages[i];
            if (x >= pdf.x && x <= pdf.x + pdf.width &&
                y >= pdf.y && y <= pdf.y + pdf.height) {
                return i;
            }
        }
        return -1;
    },
    
    zoomInAt(x, y) {
        const oldScale = this.zoomScale;
        this.zoomScale = Math.min(this.zoomScale + 0.25, 3.0);
        this.updateZoomLevel();
        this.draw();
    },
    
    zoomOutAt(x, y) {
        const oldScale = this.zoomScale;
        this.zoomScale = Math.max(this.zoomScale - 0.25, 0.5);
        this.updateZoomLevel();
        this.draw();
    },

    async loadPdf(filePath) {
        try {
            const loadingTask = pdfjsLib.getDocument(filePath);
            this.pdfDoc = await loadingTask.promise;
            this.currentPage = 1;
            this.zoomScale = 1.0;
            this.viewMode = 'single';
            this.pdfImages = [];
            this.pdfPositions = [];
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

        // 영역 선택 마스킹 상태 초기화 (페이지 변경 시)
        if (window.areaSelector) {
            window.areaSelector.isMasked = false;
            window.areaSelector.originalPdfImageData = null;
            window.areaSelector.originalDrawingImageData = null;
        }

        // 기존 PDF 이미지 제거
        this.pdfImages = [];
        this.pdfPositions = [];

        if (this.viewMode === 'spread') {
            await this.renderSpreadPages();
        } else {
            await this.renderSinglePage();
        }
        
        this.draw();
    },

    async renderSinglePage() {
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1 });
        
        // PDF를 캔버스에 렌더링
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = viewport.width;
        renderCanvas.height = viewport.height;
        
        await page.render({
            canvasContext: renderCanvas.getContext('2d'),
            viewport: viewport
        }).promise;
        
        // 중앙에 배치
        const x = (this.whiteboardCanvas.width - viewport.width) / 2;
        const y = (this.whiteboardCanvas.height - viewport.height) / 2;
        
        this.pdfImages.push({
            canvas: renderCanvas,
            x: x,
            y: y,
            width: viewport.width,
            height: viewport.height,
            pageNum: this.currentPage
        });
        
        this.pdfPositions.push({ x, y });
    },

    async renderSpreadPages() {
        // 2페이지 나란히 보기
        const page1 = await this.pdfDoc.getPage(this.currentPage);
        const viewport1 = page1.getViewport({ scale: 1 });
        
        let page2 = null;
        let viewport2 = null;
        
        // 다음 페이지가 있으면 함께 렌더링
        if (this.currentPage < this.pdfDoc.numPages) {
            page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            viewport2 = page2.getViewport({ scale: 1 });
        }

        // 첫 번째 페이지 렌더링
        const renderCanvas1 = document.createElement('canvas');
        renderCanvas1.width = viewport1.width;
        renderCanvas1.height = viewport1.height;
        
        await page1.render({
            canvasContext: renderCanvas1.getContext('2d'),
            viewport: viewport1
        }).promise;
        
        const totalWidth = viewport1.width + (viewport2 ? viewport2.width + 32 : 0);
        const maxHeight = Math.max(viewport1.height, viewport2 ? viewport2.height : 0);
        
        const startX = (this.whiteboardCanvas.width - totalWidth) / 2;
        const y = (this.whiteboardCanvas.height - maxHeight) / 2;
        
        this.pdfImages.push({
            canvas: renderCanvas1,
            x: startX,
            y: y,
            width: viewport1.width,
            height: viewport1.height,
            pageNum: this.currentPage
        });
        
        this.pdfPositions.push({ x: startX, y });

        // 두 번째 페이지 (있는 경우)
        if (page2 && viewport2) {
            const renderCanvas2 = document.createElement('canvas');
            renderCanvas2.width = viewport2.width;
            renderCanvas2.height = viewport2.height;
            
            await page2.render({
                canvasContext: renderCanvas2.getContext('2d'),
                viewport: viewport2
            }).promise;
            
            this.pdfImages.push({
                canvas: renderCanvas2,
                x: startX + viewport1.width + 32,
                y: y,
                width: viewport2.width,
                height: viewport2.height,
                pageNum: this.currentPage + 1
            });
            
            this.pdfPositions.push({ x: startX + viewport1.width + 32, y });
        }
    },
    
    // 화이트보드 그리기 (렌더링 루프)
    draw() {
        if (!this.whiteboardCtx) return;
        
        const ctx = this.whiteboardCtx;
        const canvas = this.whiteboardCanvas;
        
        // 필기 레이어 캔버스 초기화 (없으면 생성)
        if (!this.drawingLayerCanvas) {
            this.drawingLayerCanvas = document.createElement('canvas');
            this.drawingLayerCanvas.width = canvas.width;
            this.drawingLayerCanvas.height = canvas.height;
        }
        
        // 캔버스 크기가 변경되었으면 레이어도 리사이즈
        if (this.drawingLayerCanvas.width !== canvas.width || this.drawingLayerCanvas.height !== canvas.height) {
            // 기존 필기 내용 보존
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.drawingLayerCanvas.width;
            tempCanvas.height = this.drawingLayerCanvas.height;
            tempCanvas.getContext('2d').drawImage(this.drawingLayerCanvas, 0, 0);
            
            this.drawingLayerCanvas.width = canvas.width;
            this.drawingLayerCanvas.height = canvas.height;
            this.drawingLayerCanvas.getContext('2d').drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
        
        // 캔버스 클리어
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 배경 그리기 (그리드 또는 단색)
        this.drawBackground(ctx);
        
        // Transform 저장
        ctx.save();
        
        // 줌 스케일 적용
        ctx.scale(this.zoomScale, this.zoomScale);
        
        // PDF 이미지들 그리기
        this.drawPdfImages(ctx);
        
        // 필기 레이어 그리기 (줌 스케일 적용된 상태, 항상 최상단)
        ctx.drawImage(this.drawingLayerCanvas, 0, 0, this.drawingLayerCanvas.width, this.drawingLayerCanvas.height);
        
        // Transform 복원
        ctx.restore();
    },
    
    drawBackground(ctx) {
        // 단색 배경
        ctx.fillStyle = '#F7F7F5';
        ctx.fillRect(0, 0, this.whiteboardCanvas.width, this.whiteboardCanvas.height);
        
        // 그리드 패턴 (선택적)
        ctx.strokeStyle = '#E9E9E6';
        ctx.lineWidth = 1;
        
        const gridSize = 20;
        for (let x = 0; x < this.whiteboardCanvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.whiteboardCanvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y < this.whiteboardCanvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.whiteboardCanvas.width, y);
            ctx.stroke();
        }
    },
    
    drawPdfImages(ctx) {
        // PDF 이미지들을 그리기
        for (const pdfImage of this.pdfImages) {
            ctx.drawImage(
                pdfImage.canvas,
                pdfImage.x,
                pdfImage.y,
                pdfImage.width,
                pdfImage.height
            );
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
        this.zoomScale = Math.min(this.zoomScale + 0.25, 3.0);
        this.updateZoomLevel();
        this.draw();
    },

    zoomOut() {
        this.zoomScale = Math.max(this.zoomScale - 0.25, 0.5);
        this.updateZoomLevel();
        this.draw();
    },

    async fitToWidth() {
        if (!this.pdfDoc || this.pdfImages.length === 0) return;
        
        // 첫 번째 PDF 이미지의 너비 기준
        const pdfImage = this.pdfImages[0];
        const containerWidth = this.whiteboardCanvas.width;
        const scale = containerWidth / pdfImage.width;
        
        this.zoomScale = Math.max(0.5, Math.min(scale, 3.0));
        this.updateZoomLevel();
        this.draw();
    },

    async fitToHeight() {
        if (!this.pdfDoc || this.pdfImages.length === 0) return;
        
        // 첫 번째 PDF 이미지의 높이 기준
        const pdfImage = this.pdfImages[0];
        const containerHeight = this.whiteboardCanvas.height;
        const scale = containerHeight / pdfImage.height;
        
        this.zoomScale = Math.max(0.5, Math.min(scale, 3.0));
        this.updateZoomLevel();
        this.draw();
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
        zoomLevel.textContent = Math.round(this.zoomScale * 100) + '%';
    },

    handleFullscreenChange(isFullscreen) {
        if (isFullscreen) {
            document.body.classList.add('fullscreen');
        } else {
            document.body.classList.remove('fullscreen');
        }
        this.resizeCanvas();
        this.draw();
    },
    
    toggleFullscreen() {
        // 전체 페이지를 전체화면으로 (whiteboard-container만이 아닌)
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                // handleFullscreenChange는 fullscreenchange 이벤트에서 자동 호출됨
            });
        } else {
            document.exitFullscreen().then(() => {
                // handleFullscreenChange는 fullscreenchange 이벤트에서 자동 호출됨
            });
        }
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    pdfViewer.init();
});

// 전역으로 노출
window.pdfViewer = pdfViewer;
