// 저장 기능 관리
const saveManager = {
    savedImageCanvas: null,
    savedImageCtx: null,
    currentSavedImage: null,
    currentSavedImagePath: null,
    savedImageVisible: false,

    init() {
        // 저장된 이미지 오버레이 캔버스 생성
        this.createSavedImageCanvas();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    createSavedImageCanvas() {
        const container = document.getElementById('whiteboard-container');
        if (!container) {
            console.error('whiteboard-container를 찾을 수 없습니다');
            return;
        }

        console.log('저장된 이미지 캔버스 생성 시작');

        // 오버레이 캔버스 생성
        this.savedImageCanvas = document.createElement('canvas');
        this.savedImageCanvas.id = 'savedImageCanvas';
        this.savedImageCanvas.style.position = 'absolute';
        this.savedImageCanvas.style.top = '0';
        this.savedImageCanvas.style.left = '0';
        this.savedImageCanvas.style.width = '100%';
        this.savedImageCanvas.style.height = '100%';
        this.savedImageCanvas.style.pointerEvents = 'none'; // 필기 방해하지 않도록
        this.savedImageCanvas.style.zIndex = '9'; // whiteboardCanvas(1) 위, drawingLayerCanvas(10) 아래
        this.savedImageCanvas.style.display = 'none'; // 기본적으로 숨김
        this.savedImageCanvas.style.backgroundColor = 'transparent'; // 투명 배경

        // whiteboardCanvas 바로 다음에 삽입 (DOM 순서로 z-index 보완)
        const whiteboardCanvas = document.getElementById('whiteboardCanvas');
        if (whiteboardCanvas && whiteboardCanvas.nextSibling) {
            container.insertBefore(this.savedImageCanvas, whiteboardCanvas.nextSibling);
        } else {
            container.appendChild(this.savedImageCanvas);
        }
        console.log('캔버스가 컨테이너에 추가됨');
        
        // 컨텍스트 가져오기
        this.savedImageCtx = this.savedImageCanvas.getContext('2d');
        
        // 캔버스 크기 설정
        this.resizeSavedImageCanvas();
        window.addEventListener('resize', () => this.resizeSavedImageCanvas());
        
        console.log('저장된 이미지 캔버스 생성 완료');
    },

    resizeSavedImageCanvas() {
        if (!this.savedImageCanvas) return;
        
        const container = document.getElementById('whiteboard-container');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        this.savedImageCanvas.width = rect.width;
        this.savedImageCanvas.height = rect.height;
        
        console.log('캔버스 크기 조정:', rect.width, rect.height);
        
        // 저장된 이미지가 있으면 다시 그리기
        if (this.currentSavedImage) {
            // 이미지 다시 로드하여 그리기
            this.reloadCurrentSavedImage();
        }
    },

    setupEventListeners() {
        // 저장 버튼
        const saveBtn = document.getElementById('saveCanvasBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentCanvas());
        }

        // 저장 목록 버튼
        const savedListBtn = document.getElementById('savedListBtn');
        if (savedListBtn) {
            savedListBtn.addEventListener('click', () => this.openSavedListModal());
        }

        // 저장된 이미지 숨기기 버튼
        const hideBtn = document.getElementById('hideSavedImageBtn');
        if (hideBtn) {
            hideBtn.addEventListener('click', () => this.hideSavedImage());
        }

        // 모달 닫기 버튼
        const closeModalBtn = document.getElementById('closeSavedListModal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.closeSavedListModal());
        }

        // 모달 오버레이 클릭 시 닫기
        const modal = document.getElementById('savedListModal');
        if (modal) {
            const overlay = modal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => this.closeSavedListModal());
            }
        }
    },

    async saveCurrentCanvas() {
        if (!window.pdfViewer || !window.pdfViewer.whiteboardCanvas) {
            showMessage('캔버스를 찾을 수 없습니다.');
            return;
        }

        try {
            const canvas = window.pdfViewer.whiteboardCanvas;
            
            // 캔버스를 이미지로 변환
            const imageData = canvas.toDataURL('image/png');
            
            // Electron API로 저장
            const result = await window.electronAPI.saveCanvasImage(imageData, null);
            
            if (result.success) {
                showMessage(`저장 완료: ${result.filename}`);
            } else {
                showMessage(`저장 실패: ${result.error}`);
            }
        } catch (error) {
            console.error('저장 오류:', error);
            showMessage('저장 중 오류가 발생했습니다.');
        }
    },

    async openSavedListModal() {
        const modal = document.getElementById('savedListModal');
        if (!modal) return;

        modal.classList.add('active');
        await this.loadSavedImages();
    },

    closeSavedListModal() {
        const modal = document.getElementById('savedListModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    async loadSavedImages() {
        const grid = document.getElementById('savedImagesGrid');
        if (!grid) return;

        try {
            const result = await window.electronAPI.getSavedImages();
            
            if (!result.success) {
                showMessage('저장된 이미지 목록을 불러올 수 없습니다.');
                return;
            }

            grid.innerHTML = '';

            if (result.images.length === 0) {
                grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">저장된 문제가 없습니다.</div>';
                return;
            }

            result.images.forEach(async (image) => {
                const item = document.createElement('div');
                item.className = 'saved-image-item';
                item.dataset.filename = image.filename;
                
                const img = document.createElement('img');
                img.alt = image.filename;
                
                // base64로 이미지 로드
                try {
                    const imageResult = await window.electronAPI.readSavedImageBase64(image.filename);
                    if (imageResult.success) {
                        img.src = imageResult.dataUrl;
                    } else {
                        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7slYzslYzslYzslYzslYzslYw8L3RleHQ+PC9zdmc+';
                    }
                } catch (error) {
                    console.error('썸네일 로드 오류:', error);
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7slYzslYzslYzslYzslYzslYw8L3RleHQ+PC9zdmc+';
                }
                
                const info = document.createElement('div');
                info.className = 'saved-image-info';
                
                const name = document.createElement('span');
                name.className = 'saved-image-name';
                name.textContent = image.filename;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'saved-image-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.title = '삭제';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`"${image.filename}"을(를) 삭제하시겠습니까?`)) {
                        await this.deleteSavedImage(image.filename);
                    }
                });
                
                info.appendChild(name);
                info.appendChild(deleteBtn);
                
                item.appendChild(img);
                item.appendChild(info);
                
                // 이미지 클릭 시 캔버스에 표시
                item.addEventListener('click', () => {
                    this.showSavedImageOnCanvas(image.filename, image.path);
                });
                
                grid.appendChild(item);
            });
        } catch (error) {
            console.error('저장된 이미지 목록 로드 오류:', error);
            showMessage('저장된 이미지 목록을 불러오는 중 오류가 발생했습니다.');
        }
    },

    async deleteSavedImage(filename) {
        try {
            const result = await window.electronAPI.deleteSavedImage(filename);
            
            if (result.success) {
                // 현재 표시 중인 이미지가 삭제된 경우 숨기기
                if (this.currentSavedImage === filename) {
                    this.hideSavedImage();
                }
                
                // 목록 새로고침
                await this.loadSavedImages();
                showMessage('삭제 완료');
            } else {
                showMessage(`삭제 실패: ${result.error}`);
            }
        } catch (error) {
            console.error('이미지 삭제 오류:', error);
            showMessage('삭제 중 오류가 발생했습니다.');
        }
    },

    async showSavedImageOnCanvas(filename, imagePath) {
        try {
            console.log('이미지 표시 시작:', filename, imagePath);
            
            // base64로 이미지 읽기 (보안 정책 우회)
            const result = await window.electronAPI.readSavedImageBase64(filename);
            
            if (!result.success) {
                console.error('이미지 읽기 실패:', result.error);
                showMessage('이미지를 불러올 수 없습니다: ' + result.error);
                return;
            }
            
            console.log('이미지 base64 읽기 성공');
            
            // 이미지 로드
            const img = new Image();
            
            img.onload = () => {
                console.log('이미지 로드 성공:', img.width, img.height);
                
                // 저장된 이미지 정보 저장
                this.currentSavedImage = filename;
                this.currentSavedImagePath = imagePath;
                this.savedImageVisible = true;
                
                // 오버레이 캔버스에 그리기
                this.drawSavedImage(img);
                
                // 캔버스 표시
                if (this.savedImageCanvas) {
                    console.log('캔버스 표시:', this.savedImageCanvas.width, this.savedImageCanvas.height);
                    
                    // 강제로 스타일 설정
                    this.savedImageCanvas.style.display = 'block';
                    this.savedImageCanvas.style.visibility = 'visible';
                    this.savedImageCanvas.style.opacity = '1';
                    this.savedImageCanvas.style.zIndex = '999'; // 매우 높은 z-index로 테스트
                    this.savedImageCanvas.style.pointerEvents = 'none';
                    
                    // 디버깅: 캔버스 상태 확인
                    const rect = this.savedImageCanvas.getBoundingClientRect();
                    console.log('캔버스 위치:', {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        display: window.getComputedStyle(this.savedImageCanvas).display,
                        zIndex: window.getComputedStyle(this.savedImageCanvas).zIndex,
                        position: window.getComputedStyle(this.savedImageCanvas).position,
                        visibility: window.getComputedStyle(this.savedImageCanvas).visibility,
                        opacity: window.getComputedStyle(this.savedImageCanvas).opacity
                    });
                    
                    // 부모 요소 확인
                    const parent = this.savedImageCanvas.parentElement;
                    if (parent) {
                        const parentRect = parent.getBoundingClientRect();
                        const parentStyle = window.getComputedStyle(parent);
                        console.log('부모 요소:', {
                            id: parent.id,
                            width: parentRect.width,
                            height: parentRect.height,
                            overflow: parentStyle.overflow,
                            zIndex: parentStyle.zIndex
                        });
                    }
                    
                    // 다른 캔버스들과 비교
                    const whiteboardCanvas = document.getElementById('whiteboardCanvas');
                    if (whiteboardCanvas) {
                        const wbStyle = window.getComputedStyle(whiteboardCanvas);
                        console.log('whiteboardCanvas 스타일:', {
                            zIndex: wbStyle.zIndex,
                            position: wbStyle.position,
                            display: wbStyle.display
                        });
                    }
                } else {
                    console.error('savedImageCanvas가 없습니다!');
                }
                
                // 숨기기 버튼 표시
                const hideBtn = document.getElementById('hideSavedImageBtn');
                if (hideBtn) {
                    hideBtn.style.display = 'block';
                }
                
                // 모달에서 선택 표시
                document.querySelectorAll('.saved-image-item').forEach(item => {
                    item.classList.remove('selected');
                    if (item.dataset.filename === filename) {
                        item.classList.add('selected');
                    }
                });
            };
            
            img.onerror = (e) => {
                console.error('이미지 로드 실패:', e);
                showMessage('이미지를 불러올 수 없습니다: ' + filename);
            };
            
            img.src = result.dataUrl;
        } catch (error) {
            console.error('이미지 표시 오류:', error);
            showMessage('이미지를 표시하는 중 오류가 발생했습니다.');
        }
    },

    drawSavedImage(img) {
        if (!this.savedImageCanvas || !this.savedImageCtx) {
            console.error('캔버스 또는 컨텍스트가 없습니다');
            return;
        }
        
        const canvas = this.savedImageCanvas;
        const ctx = this.savedImageCtx;
        
        console.log('이미지 그리기 시작:', canvas.width, canvas.height, '이미지 크기:', img.width, img.height);
        
        // 캔버스 클리어
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 디버깅: 배경색으로 캔버스가 보이는지 확인 (줌 스케일 적용 전)
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // 반투명 빨간색 (캔버스 확인용)
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        if (!img) {
            console.log('이미지가 없음, 다시 로드 시도');
            // img가 제공되지 않으면 현재 저장된 이미지 다시 로드
            if (this.currentSavedImage) {
                this.reloadCurrentSavedImage();
                return;
            }
            return;
        }
        
        // 줌 스케일 적용하지 않고 직접 그리기 (테스트)
        // 줌 스케일 적용 (pdf-viewer와 동일하게)
        const zoomScale = window.pdfViewer ? window.pdfViewer.zoomScale : 1.0;
        
        console.log('줌 스케일:', zoomScale);
        
        // 이미지를 캔버스 전체에 직접 그리기 (줌 스케일 없이)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        console.log('이미지 그리기 (직접):', 0, 0, canvas.width, canvas.height);
        
        // 디버깅: 이미지가 실제로 그려졌는지 확인
        const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
        const hasData = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0); // 알파 채널 제외하고 데이터 있는지 확인
        console.log('이미지 데이터 확인:', hasData ? '있음' : '없음', '첫 픽셀:', Array.from(imageData.data.slice(0, 4)));
        
        console.log('이미지 그리기 완료');
        
        // 디버깅: 캔버스가 실제로 보이는지 확인
        console.log('캔버스 스타일:', {
            display: canvas.style.display,
            zIndex: canvas.style.zIndex,
            position: canvas.style.position,
            width: canvas.style.width,
            height: canvas.style.height
        });
    },

    hideSavedImage() {
        if (this.savedImageCanvas) {
            this.savedImageCanvas.style.display = 'none';
        }
        
        this.savedImageVisible = false;
        this.currentSavedImage = null;
        this.currentSavedImagePath = null;
        
        // 숨기기 버튼 숨김
        const hideBtn = document.getElementById('hideSavedImageBtn');
        if (hideBtn) {
            hideBtn.style.display = 'none';
        }
        
        // 모달에서 선택 해제
        document.querySelectorAll('.saved-image-item').forEach(item => {
            item.classList.remove('selected');
        });
    },

    // 현재 저장된 이미지 다시 로드
    async reloadCurrentSavedImage() {
        if (!this.currentSavedImage) return;
        
        try {
            const result = await window.electronAPI.readSavedImageBase64(this.currentSavedImage);
            if (result.success) {
                const img = new Image();
                img.onload = () => {
                    this.drawSavedImage(img);
                };
                img.onerror = () => {
                    console.error('저장된 이미지 재로드 실패');
                };
                img.src = result.dataUrl;
            }
        } catch (error) {
            console.error('이미지 재로드 오류:', error);
        }
    },

    // 줌 변경 시 저장된 이미지 다시 그리기
    onZoomChange() {
        if (this.savedImageVisible && this.currentSavedImage) {
            // 이미지 다시 로드하여 그리기
            this.reloadCurrentSavedImage();
        }
    }
};

// 전역으로 노출
window.saveManager = saveManager;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        saveManager.init();
    }, 200);
});

