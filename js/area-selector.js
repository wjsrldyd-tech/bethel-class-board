// 영역 선택 기능
const areaSelector = {
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    selectionBox: null,
    overlayCanvas: null,
    originalPdfCanvas: null,
    originalDrawingCanvas: null,
    originalPdfImageData: null,
    originalDrawingImageData: null,
    isMasked: false,
    maskCanvas: null,
    isActive: false,
    boundHandlers: {},

    init() {
        const btn = document.getElementById('areaSelectBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                this.toggleSelectionMode();
            });
        }
    },

    toggleSelectionMode() {
        const btn = document.getElementById('areaSelectBtn');
        
        // 이미 마스킹이 적용된 상태에서 버튼을 누르면 원본으로 복원
        if (this.isMasked && !this.isActive) {
            this.restoreOriginal();
            return;
        }
        
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            btn.classList.add('active');
            btn.title = '영역 선택 취소';
            this.enterSelectionMode();
        } else {
            btn.classList.remove('active');
            btn.title = '영역 선택';
            this.exitSelectionMode();
        }
    },

    enterSelectionMode() {
        const wrapper = document.getElementById('pdfViewer');
        if (!wrapper) return;

        // 기존 선택 박스 제거
        this.removeSelectionBox();

        // 필기 캔버스 비활성화
        const drawingCanvas = document.querySelector('.drawing-canvas');
        if (drawingCanvas) {
            drawingCanvas.style.pointerEvents = 'none';
        }

        // 필기 도구 버튼들 비활성화
        const penTool = document.getElementById('penTool');
        const highlightTool = document.getElementById('highlightTool');
        const eraserTool = document.getElementById('eraserTool');
        
        if (penTool) {
            penTool.disabled = true;
            penTool.classList.remove('active');
        }
        if (highlightTool) {
            highlightTool.disabled = true;
            highlightTool.classList.remove('active');
        }
        if (eraserTool) {
            eraserTool.disabled = true;
            eraserTool.classList.remove('active');
        }

        // 오버레이 캔버스 생성 (선택 영역 표시용)
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.className = 'selection-overlay';
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.zIndex = '100';
        
        const pageWrapper = wrapper.querySelector('.pdf-page-wrapper');
        if (pageWrapper) {
            const rect = pageWrapper.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            
            this.overlayCanvas.width = pageWrapper.offsetWidth;
            this.overlayCanvas.height = pageWrapper.offsetHeight;
            this.overlayCanvas.style.width = pageWrapper.offsetWidth + 'px';
            this.overlayCanvas.style.height = pageWrapper.offsetHeight + 'px';
            
            pageWrapper.appendChild(this.overlayCanvas);
        }

        // 이벤트 리스너 추가 (제거를 위해 바인딩된 함수 저장)
        this.boundHandlers.mousedown = this.handleMouseDown.bind(this);
        this.boundHandlers.mousemove = this.handleMouseMove.bind(this);
        this.boundHandlers.mouseup = this.handleMouseUp.bind(this);
        
        wrapper.addEventListener('mousedown', this.boundHandlers.mousedown);
        wrapper.addEventListener('mousemove', this.boundHandlers.mousemove);
        wrapper.addEventListener('mouseup', this.boundHandlers.mouseup);
        wrapper.style.cursor = 'crosshair';
    },

    exitSelectionMode() {
        const wrapper = document.getElementById('pdfViewer');
        if (wrapper) {
            wrapper.style.cursor = '';
            if (this.boundHandlers.mousedown) {
                wrapper.removeEventListener('mousedown', this.boundHandlers.mousedown);
            }
            if (this.boundHandlers.mousemove) {
                wrapper.removeEventListener('mousemove', this.boundHandlers.mousemove);
            }
            if (this.boundHandlers.mouseup) {
                wrapper.removeEventListener('mouseup', this.boundHandlers.mouseup);
            }
            this.boundHandlers = {};
        }

        // 필기 캔버스 다시 활성화
        const drawingCanvas = document.querySelector('.drawing-canvas');
        if (drawingCanvas) {
            drawingCanvas.style.pointerEvents = 'all';
        }

        // 필기 도구 버튼들 다시 활성화
        const penTool = document.getElementById('penTool');
        const highlightTool = document.getElementById('highlightTool');
        const eraserTool = document.getElementById('eraserTool');
        
        if (penTool) {
            penTool.disabled = false;
        }
        if (highlightTool) {
            highlightTool.disabled = false;
        }
        if (eraserTool) {
            eraserTool.disabled = false;
        }

        this.removeSelectionBox();
        this.isSelecting = false;
    },

    handleMouseDown(e) {
        if (!this.isActive) return;
        
        const pageWrapper = document.querySelector('.pdf-page-wrapper');
        if (!pageWrapper) return;

        const rect = pageWrapper.getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        this.isSelecting = true;

        // 선택 박스 생성
        this.createSelectionBox();
    },

    handleMouseMove(e) {
        if (!this.isActive || !this.isSelecting) return;

        const pageWrapper = document.querySelector('.pdf-page-wrapper');
        if (!pageWrapper) return;

        const rect = pageWrapper.getBoundingClientRect();
        this.currentX = e.clientX - rect.left;
        this.currentY = e.clientY - rect.top;

        this.updateSelectionBox();
    },

    handleMouseUp(e) {
        if (!this.isActive || !this.isSelecting) return;

        this.isSelecting = false;
        this.applyMask();
    },

    createSelectionBox() {
        if (this.overlayCanvas) {
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }
    },

    updateSelectionBox() {
        if (!this.overlayCanvas) return;

        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        // 선택 영역 표시 (점선 테두리)
        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);

        // 선택 영역 내부 반투명 표시
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.fillRect(x, y, width, height);
    },

    applyMask() {
        const pageWrapper = document.querySelector('.pdf-page-wrapper');
        if (!pageWrapper) return;

        const pdfCanvas = pageWrapper.querySelector('canvas:not(.drawing-canvas):not(.selection-overlay)');
        const drawingCanvas = pageWrapper.querySelector('.drawing-canvas');
        
        if (!pdfCanvas) return;

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        // 유효한 선택 영역인지 확인
        if (width < 10 || height < 10) {
            alert('더 큰 영역을 선택해주세요.');
            this.removeSelectionBox();
            return;
        }

        // PDF 캔버스에 마스크 적용
        const pdfCtx = pdfCanvas.getContext('2d');
        
        // 원본 데이터 저장 (마스킹 전)
        if (!this.isMasked) {
            this.originalPdfImageData = pdfCtx.getImageData(0, 0, pdfCanvas.width, pdfCanvas.height);
        }
        
        const pdfImageData = pdfCtx.getImageData(0, 0, pdfCanvas.width, pdfCanvas.height);
        
        // 선택 영역 외부를 흰색으로 변경
        const scaleX = pdfCanvas.width / pageWrapper.offsetWidth;
        const scaleY = pdfCanvas.height / pageWrapper.offsetHeight;
        
        const maskX = x * scaleX;
        const maskY = y * scaleY;
        const maskWidth = width * scaleX;
        const maskHeight = height * scaleY;

        for (let py = 0; py < pdfCanvas.height; py++) {
            for (let px = 0; px < pdfCanvas.width; px++) {
                // 선택 영역 밖이면 흰색으로
                if (px < maskX || px >= maskX + maskWidth || 
                    py < maskY || py >= maskY + maskHeight) {
                    const index = (py * pdfCanvas.width + px) * 4;
                    pdfImageData.data[index] = 255;     // R
                    pdfImageData.data[index + 1] = 255; // G
                    pdfImageData.data[index + 2] = 255; // B
                    pdfImageData.data[index + 3] = 255; // A
                }
            }
        }

        pdfCtx.putImageData(pdfImageData, 0, 0);

        // 필기 캔버스에도 마스크 적용
        if (drawingCanvas) {
            const drawingCtx = drawingCanvas.getContext('2d');
            
            // 원본 데이터 저장 (마스킹 전)
            if (!this.isMasked) {
                this.originalDrawingImageData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
            }
            
            const drawingImageData = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
            
            const drawScaleX = drawingCanvas.width / pageWrapper.offsetWidth;
            const drawScaleY = drawingCanvas.height / pageWrapper.offsetHeight;
            
            const drawMaskX = x * drawScaleX;
            const drawMaskY = y * drawScaleY;
            const drawMaskWidth = width * drawScaleX;
            const drawMaskHeight = height * drawScaleY;

            for (let py = 0; py < drawingCanvas.height; py++) {
                for (let px = 0; px < drawingCanvas.width; px++) {
                    // 선택 영역 밖이면 투명하게
                    if (px < drawMaskX || px >= drawMaskX + drawMaskWidth || 
                        py < drawMaskY || py >= drawMaskY + drawMaskHeight) {
                        const index = (py * drawingCanvas.width + px) * 4;
                        drawingImageData.data[index + 3] = 0; // Alpha를 0으로 (투명)
                    }
                }
            }

            drawingCtx.putImageData(drawingImageData, 0, 0);
        }

        // 마스킹 적용 완료 표시
        this.isMasked = true;

        // 선택 모드 종료
        this.toggleSelectionMode();
    },

    restoreOriginal() {
        const pageWrapper = document.querySelector('.pdf-page-wrapper');
        if (!pageWrapper) return;

        const pdfCanvas = pageWrapper.querySelector('canvas:not(.drawing-canvas):not(.selection-overlay)');
        const drawingCanvas = pageWrapper.querySelector('.drawing-canvas');
        
        // PDF 캔버스 원본 복원
        if (pdfCanvas && this.originalPdfImageData) {
            const pdfCtx = pdfCanvas.getContext('2d');
            pdfCtx.putImageData(this.originalPdfImageData, 0, 0);
        }

        // 필기 캔버스 원본 복원
        if (drawingCanvas && this.originalDrawingImageData) {
            const drawingCtx = drawingCanvas.getContext('2d');
            drawingCtx.putImageData(this.originalDrawingImageData, 0, 0);
        }

        // 마스킹 상태 초기화
        this.isMasked = false;
        this.originalPdfImageData = null;
        this.originalDrawingImageData = null;
        
        const btn = document.getElementById('areaSelectBtn');
        if (btn) {
            btn.classList.remove('active');
            btn.title = '영역 선택';
        }
    },

    removeSelectionBox() {
        if (this.overlayCanvas) {
            this.overlayCanvas.remove();
            this.overlayCanvas = null;
        }
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    areaSelector.init();
});

// 전역으로 노출
window.areaSelector = areaSelector;

