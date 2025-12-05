// 필기 도구 로직
const drawingTool = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentTool: 'pen', // 'pen', 'highlight', 'eraser'
    currentColor: '#FF0000',
    brushSize: 3,
    lastX: 0,
    lastY: 0,
    drawings: [], // 페이지별 필기 저장
    initialized: false,

    init(canvas, width, height) {
        if (!canvas) {
            console.error('Drawing canvas not found');
            return;
        }
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 캔버스 스타일 설정
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'all';
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.touchAction = 'none';
        
        // 이전 필기 복원 (선택적)
        this.clearCanvas();
        
        this.setupCanvasEventListeners();
        
        console.log('Drawing tool initialized:', { width, height, canvas: this.canvas });
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
            });
        }

        if (highlightTool) {
            highlightTool.addEventListener('click', () => {
                this.setTool('highlight');
            });
        }

        if (eraserTool) {
            eraserTool.addEventListener('click', () => {
                this.setTool('eraser');
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

    // 캔버스 이벤트 리스너 (PDF 로드 후)
    setupCanvasEventListeners() {
        if (!this.canvas) return;

        // 마우스 이벤트
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // 터치 이벤트
        this.canvas.addEventListener('touchstart', (e) => {
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
            btn.classList.remove('active');
        });

        if (tool === 'pen') {
            document.getElementById('penTool').classList.add('active');
            this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'highlight') {
            document.getElementById('highlightTool').classList.add('active');
            this.canvas.style.cursor = 'crosshair';
        } else if (tool === 'eraser') {
            document.getElementById('eraserTool').classList.add('active');
            this.canvas.style.cursor = 'grab';
        }
    },

    startDrawing(e) {
        if (!this.canvas || !this.ctx) {
            console.warn('Canvas not initialized');
            return;
        }
        
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.lastX = (e.offsetX || (e.clientX - rect.left)) * scaleX;
        this.lastY = (e.offsetY || (e.clientY - rect.top)) * scaleY;
    },

    draw(e) {
        if (!this.isDrawing || !this.ctx || !this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const currentX = (e.offsetX || (e.clientX - rect.left)) * scaleX;
        const currentY = (e.offsetY || (e.clientY - rect.top)) * scaleY;

        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.globalAlpha = 1.0;
        } else if (this.currentTool === 'highlight') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.globalAlpha = 0.3;
        } else if (this.currentTool === 'eraser') {
            // 지우개는 destination-out 사용 (기존 내용을 지움)
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.globalAlpha = 1.0;
            // strokeStyle은 destination-out에서는 무시되지만 명시적으로 설정
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();

        this.lastX = currentX;
        this.lastY = currentY;
    },

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.globalAlpha = 1.0;
        }
    },

    clearCanvas() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
};

// 전역으로 노출
window.drawingTool = drawingTool;

// DOM 로드 후 툴바 이벤트 초기화
document.addEventListener('DOMContentLoaded', () => {
    drawingTool.initToolbarListeners();
});


