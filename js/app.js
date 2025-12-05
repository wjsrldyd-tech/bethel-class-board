// 메인 앱 로직
let pdfData = null;

// 앱 초기화
async function initApp() {
    await loadPdfStructure();
}

// PDF 폴더 구조 로드
async function loadPdfStructure() {
    try {
        const result = await window.electronAPI.scanPdfFolder();
        if (result.success) {
            renderGradeList(result.data);
        } else {
            console.error('PDF 폴더 스캔 실패:', result.error);
            showMessage('PDF 폴더를 읽을 수 없습니다.');
        }
    } catch (error) {
        console.error('PDF 폴더 스캔 오류:', error);
        showMessage('PDF 폴더를 읽는 중 오류가 발생했습니다.');
    }
}

// 학년 목록 렌더링
function renderGradeList(grades) {
    const gradeList = document.getElementById('gradeList');
    gradeList.innerHTML = '';

    const gradeNames = Object.keys(grades).sort((a, b) => {
        // 숫자 추출하여 정렬 (1학년, 2학년 등)
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    gradeNames.forEach(gradeName => {
        const gradeItem = document.createElement('div');
        gradeItem.className = 'grade-item';
        gradeItem.dataset.grade = gradeName;
        gradeItem.innerHTML = `
            <div class="grade-item-title">${gradeName}</div>
            <div class="unit-list" id="units-${gradeName}"></div>
        `;

        gradeItem.addEventListener('click', (e) => {
            if (e.target === gradeItem || e.target.classList.contains('grade-item-title')) {
                toggleGrade(gradeItem, grades[gradeName]);
            }
        });

        gradeList.appendChild(gradeItem);
    });
}

// 학년 토글
function toggleGrade(gradeItem, units) {
    const isActive = gradeItem.classList.contains('active');
    
    // 모든 학년 비활성화
    document.querySelectorAll('.grade-item').forEach(item => {
        item.classList.remove('active');
    });

    if (!isActive) {
        gradeItem.classList.add('active');
        renderUnitList(gradeItem, units);
    } else {
        // 단원 목록 숨기기
        const unitList = gradeItem.querySelector('.unit-list');
        unitList.innerHTML = '';
    }
}

// 단원 목록 렌더링
function renderUnitList(gradeItem, units) {
    const unitList = gradeItem.querySelector('.unit-list');
    unitList.innerHTML = '';

    const unitNames = Object.keys(units).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    unitNames.forEach(unitName => {
        const unitItem = document.createElement('div');
        unitItem.className = 'unit-item';
        unitItem.textContent = unitName;
        unitItem.dataset.path = units[unitName];

        unitItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // 활성화 표시
            document.querySelectorAll('.unit-item').forEach(item => {
                item.classList.remove('active');
            });
            unitItem.classList.add('active');

            // PDF 로드
            await loadPdf(units[unitName]);
        });

        unitList.appendChild(unitItem);
    });
}

// PDF 로드
async function loadPdf(filePath) {
    try {
        const result = await window.electronAPI.readPdfFile(filePath);
        if (result.success) {
            await pdfViewer.loadPdf(result.path);
        } else {
            showMessage('PDF 파일을 열 수 없습니다: ' + result.error);
        }
    } catch (error) {
        console.error('PDF 로드 오류:', error);
        showMessage('PDF 파일을 여는 중 오류가 발생했습니다.');
    }
}

// 메시지 표시 (간단한 알림)
function showMessage(message) {
    // TODO: 토스트 알림 구현
    console.log(message);
    alert(message);
}

// 앱 시작
document.addEventListener('DOMContentLoaded', initApp);

