// 필기 도구 로직 - 화이트보드 기반
const drawingTool = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentTool: 'pen', // 'pen', 'highlight', 'eraser'
    currentColor: '#FF0000',
    brushSize: 3,
    lastX: 0,
    lastY: 0,
    drawings: [], // 필기 경로 저장 (undo/redo용)
    history: [],
    historyIndex: -1,
    initialized: false,

    init(canvas) {
        if (!canvas) {
            console.error('Drawing canvas not found');
            return;
        }
        
        this.canvas = canvas;
        // pdf-viewer와 같은 컨텍스트를 사용
        if (window.pdfViewer && window.pdfViewer.whiteboardCtx) {
            this.ctx = window.pdfViewer.whiteboardCtx;
        } else {
            this.ctx = canvas.getContext('2d');
        }
        
        // 캔버스 스타일 설정
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'all';
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.touchAction = 'none';
        this.canvas.style.zIndex = '10';
        
        this.setupCanvasEventListeners();
        
        console.log('Drawing tool initialized on whiteboard canvas');
    },
    
    redrawAll() {
        // 저장된 필기 경로를 다시 그리기 (필요시 구현)
        // 현재는 간단하게 유지
    },

    // 초기화 시 한 번만 실행 (버튼 이벤트)
    initToolbarListeners() {
        if (this.initialized) return;
        this.initialized = true;

        // 도구 선택
        const penTool = document.getElementById('penTool');
        const highlightTool = document.getElementById('highlightTool');
        const eraserTool = document.getElementById('eraserTool');
        const clearTool = document.getElementById('clearTool');

        if (penTool) {
            penTool.addEventListener('click', () => {
                this.setTool('pen');
                // 펜 도구 선택 시 자동으로 필기 모드로 전환
                if (window.pdfViewer) {
                    window.pdfViewer.setMode('draw');
                }
            });
        }

        if (highlightTool) {
            highlightTool.addEventListener('click', () => {
                this.setTool('highlight');
                // 하이라이트 도구 선택 시 자동으로 필기 모드로 전환
                if (window.pdfViewer) {
                    window.pdfViewer.setMode('draw');
                }
            });
        }

        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                this.setTool('eraser');
                // 지우개 도구 선택 시 자동으로 필기 모드로 전환
                if (window.pdfViewer) {
                    window.pdfViewer.setMode('draw');
                }
            });
        }

        if (clearTool) {
            clearTool.addEventListener('click', () => {
                this.clearCanvas();
            });
        }

        // 색상 선택
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
                this.currentColor = option.dataset.color;
            });
        });

        // 두께 조절
        const brushSizeInput = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        if (brushSizeInput && brushSizeValue) {
            brushSizeInput.addEventListener('input', (e) => {
                this.brushSize = parseInt(e.target.value);
                brushSizeValue.textContent = this.brushSize;
            });
        }
    },

    // 캔버스 이벤트 리스너
    setupCanvasEventListeners() {
        if (!this.canvas) return;

        // 마우스 이벤트
        this.canvas.addEventListener('mousedown', (e) => {
            // 문서 이동 모드, 화면 이동 모드, 자르기 모드면 필기 비활성화
            if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
                return;
            }
            this.startDrawing(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            // 문서 이동 모드, 화면 이동 모드, 자르기 모드면 필기 비활성화
            if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
                this.stopDrawing();
                return;
            }
            this.draw(e);
        });
        
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // 터치 이벤트
        this.canvas.addEventListener('touchstart', (e) => {
            // 문서 이동 모드, 화면 이동 모드, 자르기 모드면 필기 비활성화
            if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
                return;
            }
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.startDrawing({
                clientX: touch.clientX,
                clientY: touch.clientY,
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            });
        });

        this.canvas.addEventListener('touchmove', (e) => {
            // 문서 이동 모드, 화면 이동 모드, 자르기 모드면 필기 비활성화
            if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
                this.stopDrawing();
                return;
            }
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.draw({
                clientX: touch.clientX,
                clientY: touch.clientY,
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            });
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    },

    setTool(tool) {
        this.currentTool = tool;
        
        // 버튼 활성화 상태 업데이트
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            if (btn.id === 'penTool' || btn.id === 'highlightTool' || btn.id === 'eraserTool') {
                btn.classList.remove('active');
            }
        });

        if (tool === 'pen') {
            document.getElementById('penTool').classList.add('active');
            if (this.canvas) this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'highlight') {
            document.getElementById('highlightTool').classList.add('active');
            if (this.canvas) this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'eraser') {
            document.getElementById('eraserTool').classList.add('active');
            if (this.canvas) this.canvas.style.cursor = 'grab';
        }
    },

    startDrawing(e) {
        if (!this.canvas || !this.ctx) {
            console.warn('Canvas not initialized');
            return;
        }
        
        // 문서 이동 모드, 화면 이동 모드, 자르기 모드일 때 필기 비활성화
        if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
            return;
        }
        
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // 화면 좌표를 캔버스 픽셀 좌표로 변환
        const screenX = (e.offsetX || (e.clientX - rect.left)) * scaleX;
        const screenY = (e.offsetY || (e.clientY - rect.top)) * scaleY;
        
        // 필기 레이어용 절대 좌표 (줌과 뷰포트 오프셋 고려)
        if (window.pdfViewer) {
            this.lastAbsoluteX = window.pdfViewer.viewportOffsetX + (screenX / window.pdfViewer.zoomScale);
            this.lastAbsoluteY = window.pdfViewer.viewportOffsetY + (screenY / window.pdfViewer.zoomScale);
        } else {
            this.lastAbsoluteX = screenX;
            this.lastAbsoluteY = screenY;
        }
    },

    draw(e) {
        if (!this.isDrawing || !this.ctx || !this.canvas) return;
        
        // 영역 선택 모드가 활성화되어 있으면 필기 비활성화
        if (window.areaSelector && window.areaSelector.isActive) {
            this.stopDrawing();
            return;
        }
        
        // 문서 이동 모드, 화면 이동 모드, 자르기 모드일 때 필기 비활성화
        if (window.pdfViewer && (window.pdfViewer.currentMode === 'move' || window.pdfViewer.currentMode === 'pan' || window.pdfViewer.currentMode === 'crop')) {
            this.stopDrawing();
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // 화면 좌표를 캔버스 픽셀 좌표로 변환
        const screenX = (e.offsetX || (e.clientX - rect.left)) * scaleX;
        const screenY = (e.offsetY || (e.clientY - rect.top)) * scaleY;
        
        // 필기 레이어용 절대 좌표 (줌과 뷰포트 오프셋 고려)
        let absoluteX, absoluteY;
        if (window.pdfViewer) {
            absoluteX = window.pdfViewer.viewportOffsetX + (screenX / window.pdfViewer.zoomScale);
            absoluteY = window.pdfViewer.viewportOffsetY + (screenY / window.pdfViewer.zoomScale);
        } else {
            absoluteX = screenX;
            absoluteY = screenY;
        }
        
        // 필기 레이어 캔버스에만 그리기 (메인 캔버스는 draw()에서 필기 레이어를 그려줌)
        const layerCtx = window.pdfViewer && window.pdfViewer.drawingLayerCanvas 
            ? window.pdfViewer.drawingLayerCanvas.getContext('2d')
            : null;
        
        if (!layerCtx) return;
        
        // 필기 레이어에 그릴 때는 brushSize를 그대로 사용
        // (drawImage로 확대/축소할 때 선도 함께 확대/축소되어 정상적으로 보임)
        layerCtx.lineWidth = this.brushSize;
        layerCtx.lineCap = 'round';
        layerCtx.lineJoin = 'round';

        if (this.currentTool === 'pen') {
            layerCtx.globalCompositeOperation = 'source-over';
            layerCtx.strokeStyle = this.currentColor;
            layerCtx.globalAlpha = 1.0;
        } else if (this.currentTool === 'highlight') {
            layerCtx.globalCompositeOperation = 'source-over';
            layerCtx.strokeStyle = this.currentColor;
            layerCtx.globalAlpha = 0.3;
        } else if (this.currentTool === 'eraser') {
            // 지우개는 destination-out 사용 (기존 내용을 지움)
            layerCtx.globalCompositeOperation = 'destination-out';
            layerCtx.globalAlpha = 1.0;
            layerCtx.strokeStyle = 'rgba(0,0,0,1)';
        }

        // 필기 레이어는 절대 좌표 사용 (줌과 뷰포트 오프셋 고려)
        layerCtx.beginPath();
        layerCtx.moveTo(this.lastAbsoluteX, this.lastAbsoluteY);
        layerCtx.lineTo(absoluteX, absoluteY);
        layerCtx.stroke();
        
        // 복원
        layerCtx.globalCompositeOperation = 'source-over';
        layerCtx.globalAlpha = 1.0;
        
        // 메인 캔버스 다시 그리기 (필기 레이어 반영)
        if (window.pdfViewer) {
            window.pdfViewer.draw();
        }

        // 좌표 업데이트
        this.lastAbsoluteX = absoluteX;
        this.lastAbsoluteY = absoluteY;
    },

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.ctx) {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 1.0;
            }
        }
    },

    clearCanvas() {
        // 필기 레이어 캔버스만 지우기 (PDF 보호)
        if (window.pdfViewer && window.pdfViewer.drawingLayerCanvas) {
            const layerCtx = window.pdfViewer.drawingLayerCanvas.getContext('2d');
            layerCtx.clearRect(0, 0, window.pdfViewer.drawingLayerCanvas.width, window.pdfViewer.drawingLayerCanvas.height);
            // 메인 캔버스를 다시 그려서 필기 레이어 반영
            window.pdfViewer.draw();
        }
    }
};

// 전역으로 노출
window.drawingTool = drawingTool;

// DOM 로드 후 툴바 이벤트 초기화 및 캔버스 초기화
document.addEventListener('DOMContentLoaded', () => {
    drawingTool.initToolbarListeners();
    
    // pdf-viewer 초기화 후 drawing 초기화 (약간의 지연)
    setTimeout(() => {
        const whiteboardCanvas = document.getElementById('whiteboardCanvas');
        if (whiteboardCanvas && window.pdfViewer && window.pdfViewer.whiteboardCtx) {
            drawingTool.init(whiteboardCanvas);
        }
    }, 100);
});
