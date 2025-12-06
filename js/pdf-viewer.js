// PDF 뷰어 로직 - 화이트보드 기반
const pdfViewer = {
    pdfDoc: null,
    currentPage: 1,
    zoomScale: 1.0,
    renderScale: 2.5, // PDF 렌더링 해상도 (기본값: 2.5, 설정 파일로 오버라이드 가능)
    whiteboardCanvas: null,
    whiteboardCtx: null,
    container: null,
    
    // PDF 이미지 데이터 저장 (여러 페이지)
    pdfImages: [], // {canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number, pageNum: number}[]
    
    // 필기 레이어 캔버스 (필기 내용 보존용)
    drawingLayerCanvas: null,
    drawingLayerBaseWidth: null,  // 필기 레이어 초기 너비 (절대 크기)
    drawingLayerBaseHeight: null, // 필기 레이어 초기 높이 (절대 크기)
    
    // 현재 모드
    currentMode: 'draw', // 'draw', 'move', or 'crop'
    isDraggingPdf: false,
    dragStartX: 0,
    dragStartY: 0,
    dragPdfIndex: -1,
    
    // PDF 페이지 위치 추적
    pdfPositions: [], // {x: number, y: number}[]
    
    // 자르기 관련 변수
    originalPdfImages: null, // 원본 PDF 이미지 저장 (복원용)
    originalPdfCanvases: null, // 원본 PDF 캔버스 저장 (복원용)
    isCropping: false, // 자르기 모드 활성화 여부
    cropStartX: 0,
    cropStartY: 0,
    cropEndX: 0,
    cropEndY: 0,
    isSelectingCrop: false, // 영역 선택 중 여부

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

        // 렌더링 스케일 초기화 (디바이스 픽셀 비율 기반 + 설정 파일 오버라이드)
        await this.initRenderScale();

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
    
    async initRenderScale() {
        // 설정 파일에서 PDF 렌더링 스케일 읽기
        let configScale = null;
        if (window.electronAPI && window.electronAPI.getConfig) {
            try {
                const config = await window.electronAPI.getConfig();
                if (config.pdfRenderScale && typeof config.pdfRenderScale === 'number') {
                    configScale = config.pdfRenderScale;
                }
            } catch (error) {
                console.warn('설정 파일 읽기 실패:', error);
            }
        }
        
        // 설정 파일에 값이 있으면 사용, 없으면 2.5로 고정
        if (configScale !== null) {
            this.renderScale = Math.max(1.0, Math.min(configScale, 4.0)); // 1.0 ~ 4.0 범위 제한
            console.log(`PDF 렌더링 스케일 (설정 파일): ${this.renderScale}`);
        } else {
            // 기본값: 2.5로 고정
            this.renderScale = 2.5;
            console.log(`PDF 렌더링 스케일 (기본값): ${this.renderScale}`);
        }
    },

    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.whiteboardCanvas.width = rect.width;
        this.whiteboardCanvas.height = rect.height;
        
        // 필기 레이어는 절대 크기로 유지 (스케일링하지 않음)
        // 화면에 그릴 때만 비율에 맞춰 스케일링
        
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
        
        // 페이지 정보 버튼 (현재 페이지 다시 보기 / 자르기 취소)
        document.getElementById('pageInfo').addEventListener('click', () => {
            this.reloadCurrentPage();
        });

        // 줌 컨트롤
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoomIn();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoomOut();
        });

        // 줌 레벨 버튼 클릭 시 초기화 (200%)
        document.getElementById('zoomLevel').addEventListener('click', () => {
            this.resetZoom();
        });

        // 전체화면
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // 문서 이동 모드 버튼
        document.getElementById('moveModeBtn').addEventListener('click', () => {
            this.setMode('move');
        });
        
        // 자르기 모드 버튼
        document.getElementById('cropModeBtn').addEventListener('click', () => {
            this.setMode('crop');
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
        const moveBtn = document.getElementById('moveModeBtn');
        const cropBtn = document.getElementById('cropModeBtn');
        
        if (moveBtn) {
            moveBtn.classList.toggle('active', mode === 'move');
        }
        if (cropBtn) {
            cropBtn.classList.toggle('active', mode === 'crop');
        }
        
        // 커서 변경
        if (mode === 'draw') {
            this.whiteboardCanvas.style.cursor = 'crosshair';
        } else if (mode === 'crop') {
            this.whiteboardCanvas.style.cursor = 'crosshair';
        } else {
            this.whiteboardCanvas.style.cursor = 'grab';
        }
    },
    
    handleCanvasMouseDown(e) {
        if (this.currentMode === 'crop') {
            // 자르기 모드: 영역 선택 시작
            const rect = this.whiteboardCanvas.getBoundingClientRect();
            this.cropStartX = (e.clientX - rect.left) / this.zoomScale;
            this.cropStartY = (e.clientY - rect.top) / this.zoomScale;
            this.cropEndX = this.cropStartX;
            this.cropEndY = this.cropStartY;
            this.isSelectingCrop = true;
            return;
        }
        
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
        if (this.currentMode === 'crop' && this.isSelectingCrop) {
            // 자르기 모드: 영역 선택 중
            const rect = this.whiteboardCanvas.getBoundingClientRect();
            this.cropEndX = (e.clientX - rect.left) / this.zoomScale;
            this.cropEndY = (e.clientY - rect.top) / this.zoomScale;
            this.draw(); // 선택 영역 표시를 위해 다시 그리기
            return;
        }
        
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
        if (this.currentMode === 'crop' && this.isSelectingCrop) {
            // 자르기 모드: 영역 선택 완료
            this.isSelectingCrop = false;
            this.applyCrop();
            return;
        }
        
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
            this.zoomScale = 2.0; // 초기 배율 200% (수업용 최적 크기)
            this.pdfImages = [];
            this.pdfPositions = [];
            
            // 필기 레이어 초기화 (새로운 PDF 로드 시)
            if (this.drawingLayerCanvas) {
                const ctx = this.drawingLayerCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.drawingLayerCanvas.width, this.drawingLayerCanvas.height);
            }
            
            await this.renderPage();
            this.updatePageInfo();
            this.updateZoomLevel(); // 줌 레벨 표시 업데이트
        } catch (error) {
            console.error('PDF 로드 오류:', error);
            throw error;
        }
    },

    async renderPage() {
        if (!this.pdfDoc) return;

        // 페이지 이동 시 자르기 상태 초기화
        if (this.isCropping) {
            this.isCropping = false;
            this.originalPdfImages = null;
            this.originalPdfCanvases = null;
            const cropCancelBtn = document.getElementById('cropCancelBtn');
            if (cropCancelBtn) {
                cropCancelBtn.style.display = 'none';
            }
        }

        // 기존 PDF 이미지 제거
        this.pdfImages = [];
        this.pdfPositions = [];

        await this.renderSinglePage();
        this.draw();
    },

    async renderSinglePage() {
        const page = await this.pdfDoc.getPage(this.currentPage);
        // renderScale을 사용하여 고해상도로 렌더링
        const viewport = page.getViewport({ scale: this.renderScale });
        
        // PDF를 캔버스에 렌더링
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = viewport.width;
        renderCanvas.height = viewport.height;
        
        await page.render({
            canvasContext: renderCanvas.getContext('2d'),
            viewport: viewport
        }).promise;
        
        // 화면에 표시할 크기는 renderScale로 나눈 값 (원본 크기)
        const displayWidth = viewport.width / this.renderScale;
        const displayHeight = viewport.height / this.renderScale;
        
        // 좌측 상단에 배치 (수업용)
        const margin = 20; // 여백
        const x = margin;
        const y = margin;
        
        this.pdfImages.push({
            canvas: renderCanvas,
            x: x,
            y: y,
            width: displayWidth,  // 화면 표시 크기
            height: displayHeight, // 화면 표시 크기
            pageNum: this.currentPage
        });
        
        this.pdfPositions.push({ x, y });
    },
    
    // 화이트보드 그리기 (렌더링 루프)
    draw() {
        if (!this.whiteboardCtx) return;
        
        const ctx = this.whiteboardCtx;
        const canvas = this.whiteboardCanvas;
        
        // 필기 레이어 캔버스 초기화 (없으면 생성)
        if (!this.drawingLayerCanvas) {
            this.drawingLayerCanvas = document.createElement('canvas');
            // 초기 크기를 절대 크기로 저장 (화면 크기 변경 시에도 유지)
            this.drawingLayerBaseWidth = canvas.width;
            this.drawingLayerBaseHeight = canvas.height;
            this.drawingLayerCanvas.width = this.drawingLayerBaseWidth;
            this.drawingLayerCanvas.height = this.drawingLayerBaseHeight;
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
        // 필기 레이어는 절대 크기로 유지하고, 화면에 그릴 때만 화면 크기에 맞춰 스케일링
        const scaleX = (canvas.width / this.zoomScale) / this.drawingLayerBaseWidth;
        const scaleY = (canvas.height / this.zoomScale) / this.drawingLayerBaseHeight;
        ctx.drawImage(
            this.drawingLayerCanvas, 
            0, 0, this.drawingLayerBaseWidth, this.drawingLayerBaseHeight,
            0, 0, this.drawingLayerBaseWidth * scaleX, this.drawingLayerBaseHeight * scaleY
        );
        
        // 자르기 선택 영역 표시
        if (this.currentMode === 'crop' && this.isSelectingCrop) {
            this.drawCropSelection(ctx);
        }
        
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
        // 고해상도 이미지 보간 품질 설정
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
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
        this.zoomScale = Math.min(this.zoomScale + 0.25, 3.0);
        this.updateZoomLevel();
        this.draw();
    },

    zoomOut() {
        this.zoomScale = Math.max(this.zoomScale - 0.25, 0.5);
        this.updateZoomLevel();
        this.draw();
    },

    resetZoom() {
        this.zoomScale = 2.0; // 초기 배율 200%
        this.updateZoomLevel();
        this.draw();
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
        zoomLevel.textContent = Math.round(this.zoomScale * 100) + '%';
    },
    
    // 현재 페이지 다시 로드 (자르기 취소 및 모든 상태 초기화)
    async reloadCurrentPage() {
        if (!this.pdfDoc) return;
        
        // 필기 레이어 초기화
        if (this.drawingLayerCanvas) {
            const ctx = this.drawingLayerCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.drawingLayerCanvas.width, this.drawingLayerCanvas.height);
        }
        
        // 현재 페이지 다시 렌더링 (자르기 상태도 초기화됨)
        await this.renderPage();
        this.updatePageInfo();
    },
    
    // 자르기 선택 영역 그리기
    drawCropSelection(ctx) {
        const x = Math.min(this.cropStartX, this.cropEndX);
        const y = Math.min(this.cropStartY, this.cropEndY);
        const width = Math.abs(this.cropEndX - this.cropStartX);
        const height = Math.abs(this.cropEndY - this.cropStartY);
        
        const canvasWidth = this.whiteboardCanvas.width / this.zoomScale;
        const canvasHeight = this.whiteboardCanvas.height / this.zoomScale;
        
        // 선택 영역을 제외한 나머지 부분에 반투명 배경 그리기 (경로 사용)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        // 전체 화면 경로
        ctx.rect(0, 0, canvasWidth, canvasHeight);
        // 선택 영역을 제외 (역방향으로)
        ctx.rect(x, y, width, height);
        ctx.fill('evenodd'); // even-odd 규칙으로 선택 영역 제외
        
        // 선택 영역 테두리만 그리기
        ctx.strokeStyle = '#0066FF';
        ctx.lineWidth = 3 / this.zoomScale;
        ctx.setLineDash([8 / this.zoomScale, 4 / this.zoomScale]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
        
        // 선택 영역 모서리에 핸들 표시
        const handleSize = 8 / this.zoomScale;
        ctx.fillStyle = '#0066FF';
        // 네 모서리
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
    },
    
    // 자르기 적용
    applyCrop() {
        if (this.pdfImages.length === 0) return;
        
        // 원본 PDF 이미지 및 캔버스 저장 (복원용)
        if (!this.isCropping) {
            this.originalPdfImages = JSON.parse(JSON.stringify(this.pdfImages.map(img => ({
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                pageNum: img.pageNum
            }))));
            
            // 원본 캔버스 복사 저장
            this.originalPdfCanvases = this.pdfImages.map(img => {
                const copyCanvas = document.createElement('canvas');
                copyCanvas.width = img.canvas.width;
                copyCanvas.height = img.canvas.height;
                copyCanvas.getContext('2d').drawImage(img.canvas, 0, 0);
                return copyCanvas;
            });
        }
        
        // 선택 영역 계산
        const x = Math.min(this.cropStartX, this.cropEndX);
        const y = Math.min(this.cropStartY, this.cropEndY);
        const width = Math.abs(this.cropEndX - this.cropStartX);
        const height = Math.abs(this.cropEndY - this.cropStartY);
        
        // PDF 이미지가 선택 영역과 겹치는지 확인
        const pdfImage = this.pdfImages[0];
        if (!pdfImage) return;
        
        // PDF 이미지 영역
        const pdfLeft = pdfImage.x;
        const pdfTop = pdfImage.y;
        const pdfRight = pdfImage.x + pdfImage.width;
        const pdfBottom = pdfImage.y + pdfImage.height;
        
        // 선택 영역이 PDF와 겹치는 부분 계산
        const cropLeft = Math.max(x, pdfLeft);
        const cropTop = Math.max(y, pdfTop);
        const cropRight = Math.min(x + width, pdfRight);
        const cropBottom = Math.min(y + height, pdfBottom);
        
        if (cropLeft >= cropRight || cropTop >= cropBottom) {
            // 선택 영역이 PDF와 겹치지 않음
            return;
        }
        
        // 선택 영역을 PDF 좌표계로 변환
        const cropX = cropLeft - pdfLeft;
        const cropY = cropTop - pdfTop;
        const cropWidth = cropRight - cropLeft;
        const cropHeight = cropBottom - cropTop;
        
        // 원본 캔버스에서 선택 영역만 잘라내기
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth * this.renderScale;
        croppedCanvas.height = cropHeight * this.renderScale;
        const croppedCtx = croppedCanvas.getContext('2d');
        
        // 고해상도 캔버스에서 선택 영역 추출
        croppedCtx.drawImage(
            pdfImage.canvas,
            cropX * this.renderScale,
            cropY * this.renderScale,
            cropWidth * this.renderScale,
            cropHeight * this.renderScale,
            0,
            0,
            cropWidth * this.renderScale,
            cropHeight * this.renderScale
        );
        
        // 잘린 이미지를 좌측 상단에 배치
        const margin = 20;
        pdfImage.canvas = croppedCanvas;
        pdfImage.x = margin;
        pdfImage.y = margin;
        pdfImage.width = cropWidth;
        pdfImage.height = cropHeight;
        
        this.isCropping = true;
        
        // 필기 모드로 자동 전환
        this.setMode('draw');
        
        this.draw();
    },
    
    // 자르기 취소
    cancelCrop() {
        if (!this.originalPdfImages || !this.originalPdfCanvases || !this.isCropping) return;
        
        // 원본 PDF 이미지 및 캔버스 복원
        if (this.originalPdfImages.length > 0 && this.pdfImages.length > 0) {
            const original = this.originalPdfImages[0];
            const originalCanvas = this.originalPdfCanvases[0];
            
            this.pdfImages[0].canvas = originalCanvas;
            this.pdfImages[0].x = original.x;
            this.pdfImages[0].y = original.y;
            this.pdfImages[0].width = original.width;
            this.pdfImages[0].height = original.height;
        }
        
        this.isCropping = false;
        this.originalPdfImages = null;
        this.originalPdfCanvases = null;
        
        // 자르기 취소 버튼 숨김
        const cropCancelBtn = document.getElementById('cropCancelBtn');
        if (cropCancelBtn) {
            cropCancelBtn.style.display = 'none';
        }
        
        this.draw();
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
