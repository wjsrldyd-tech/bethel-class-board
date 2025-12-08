// 터치 제스처 처리 - 화이트보드 기반
const touchHandler = {
    init() {
        const canvas = document.getElementById('whiteboardCanvas');
        if (!canvas) return;
        
        // 스와이프 제스처 (페이지 이동)
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 3) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 3 && e.touches.length === 0) {
                touchEndX = e.changedTouches[0].clientX;
                touchEndY = e.changedTouches[0].clientY;
                handleSwipe();
            }
        }, { passive: true });

        function handleSwipe() {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const minSwipeDistance = 50;

            // 수평 스와이프가 수직 스와이프보다 크면 페이지 이동
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX > 0) {
                    // 오른쪽 스와이프 = 이전 페이지
                    if (window.pdfViewer) {
                        window.pdfViewer.prevPage();
                    }
                } else {
                    // 왼쪽 스와이프 = 다음 페이지
                    if (window.pdfViewer) {
                        window.pdfViewer.nextPage();
                    }
                }
            }
        }

        // 핀치 줌 - 비활성화
        // let initialDistance = 0;
        // let initialScale = 1.0;
        // let lastCenterX = 0;
        // let lastCenterY = 0;

        // canvas.addEventListener('touchstart', (e) => {
        //     if (e.touches.length === 2) {
        //         const touch1 = e.touches[0];
        //         const touch2 = e.touches[1];
        //         initialDistance = Math.hypot(
        //             touch2.clientX - touch1.clientX,
        //             touch2.clientY - touch1.clientY
        //         );
        //         if (window.pdfViewer) {
        //             initialScale = window.pdfViewer.zoomScale;
        //         }
        //         lastCenterX = (touch1.clientX + touch2.clientX) / 2;
        //         lastCenterY = (touch1.clientY + touch2.clientY) / 2;
        //     }
        // }, { passive: true });

        // canvas.addEventListener('touchmove', (e) => {
        //     if (e.touches.length === 2) {
        //         e.preventDefault();
        //         const touch1 = e.touches[0];
        //         const touch2 = e.touches[1];
        //         const currentDistance = Math.hypot(
        //             touch2.clientX - touch1.clientX,
        //             touch2.clientY - touch1.clientY
        //         );

        //         if (initialDistance > 0 && window.pdfViewer) {
        //             const scaleChange = currentDistance / initialDistance;
        //             window.pdfViewer.zoomScale = Math.max(0.5, Math.min(3.0, initialScale * scaleChange));
        //             window.pdfViewer.updateZoomLevel();
        //             window.pdfViewer.draw();
        //         }
        //     }
        // }, { passive: false });

        // 더블 탭 줌 - 비활성화
        // let lastTap = 0;
        // canvas.addEventListener('touchend', (e) => {
        //     if (e.touches.length === 0 && e.changedTouches.length === 1) {
        //         const currentTime = new Date().getTime();
        //         const tapLength = currentTime - lastTap;
        //
        //         if (tapLength < 300 && tapLength > 0) {
        //             // 더블 탭
        //             if (window.pdfViewer) {
        //                 if (window.pdfViewer.zoomScale > 1.0) {
        //                     window.pdfViewer.zoomScale = 1.0;
        //                 } else {
        //                     window.pdfViewer.zoomScale = 2.0;
        //                 }
        //                 window.pdfViewer.updateZoomLevel();
        //                 window.pdfViewer.draw();
        //             }
        //             e.preventDefault();
        //         }
        //         lastTap = currentTime;
        //     }
        // }, { passive: true });
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    touchHandler.init();
});
