// Load and parse data
let studentsData = [];
let listeningData = {};
let selectedDate = null;

// API URL for the INI file
const INI_FILE_URL = 'https://www.call2all.co.il/ym/api//DownloadFile?token=WU1BUElL.apik_H5dQJ0e4Fdyc8NiRvSWMdw.jhS6PXCTir0yTsW-ydHKZ45Mu3P3_e-RYTsoEg9p4eo&path=ivr2:18/ListeningOk.ini';

// Parse INI file
async function loadListeningData() {
    try {
        console.log('🔄 Loading listening data from server...');
        console.log('📡 Server URL:', INI_FILE_URL);
        
        const startTime = Date.now();
        const response = await fetch(INI_FILE_URL);
        const loadTime = Date.now() - startTime;
        
        console.log('✅ Server response received in', loadTime, 'ms');
        console.log('📊 Response status:', response.status, response.statusText);
        console.log('📦 Content-Type:', response.headers.get('content-type'));
        
        const text = await response.text();
        const lines = text.split('\n');
        
        console.log('📄 Total lines in file:', lines.length);
        console.log('📝 First line sample:', lines[0]);
        console.log('📝 Last line sample:', lines[lines.length - 2]);
        
        let processedCount = 0;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            const parts = line.split('-');
            if (parts.length < 7) return;
            
            const id = parts[0].replace('teudat_zehut_', '');
            const extension = parts[1];
            const file = parts[2];
            // Date format in file: Date-2026-03-08-Hour
            // parts[3] = "Date", parts[4] = "2026", parts[5] = "03", parts[6] = "08", parts[7] = "Hour"
            const date = `${parts[4]}-${parts[5]}-${parts[6]}`;
            const time = `${parts[8]}-${parts[9]}-${parts[10]}`.replace(/-/g, ':');
            
            if (!listeningData[id]) {
                listeningData[id] = [];
            }
            
            listeningData[id].push({
                extension,
                file,
                date,
                time,
                datetime: new Date(`${date} ${time}`)
            });
            
            processedCount++;
        });
        
        const totalStudents = Object.keys(listeningData).length;
        const totalListenings = Object.values(listeningData).reduce((sum, arr) => sum + arr.length, 0);
        
        console.log('✅ Listening data loaded successfully!');
        console.log('👥 Students with listening history:', totalStudents);
        console.log('🎧 Total listening records:', totalListenings);
        console.log('📊 Processed lines:', processedCount);
        console.log('⏰ Last update:', new Date().toLocaleString('he-IL'));
        
        // Debug: show sample dates
        const sampleDates = new Set();
        Object.values(listeningData).slice(0, 5).forEach(history => {
            history.forEach(item => sampleDates.add(item.date));
        });
        console.log('📅 Sample dates found:', Array.from(sampleDates));
    } catch (error) {
        console.error('❌ Error loading listening data:', error);
        console.error('Error details:', error.message);
    }
}

// Load Excel data
async function loadStudentsData() {
    try {
        console.log('Loading Excel file...');
        const response = await fetch('תלמידים.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        
        studentsData = data.map((row, index) => {
            const id = String(row['מספר זהות'] || '').trim();
            const firstName = String(row['שם פרטי'] || '').trim();
            const lastName = String(row['שם משפחה'] || '').trim();
            const name = `${firstName} ${lastName}`.trim();
            const grade = String(row['שכבה'] || '').trim();
            const className = String(row['כיתה'] || '').trim();
            
            return {
                id,
                name,
                firstName,
                lastName,
                grade,
                className,
                listeningHistory: listeningData[id] || []
            };
        }).filter(student => student.name && student.id);
        
        console.log('Processed students:', studentsData.length);
        
        populateDateDropdown();
        calculateStatistics();
    } catch (error) {
        console.error('Error loading students data:', error);
    }
}

// Populate date dropdown with available dates
function populateDateDropdown() {
    const dateSet = new Set();
    
    // Collect all unique dates from listening data
    Object.values(listeningData).forEach(history => {
        history.forEach(item => {
            dateSet.add(item.date);
        });
    });
    
    // Convert to array and sort (newest first)
    const dates = Array.from(dateSet).sort((a, b) => {
        return new Date(b) - new Date(a);
    });
    
    // Populate dropdown
    const select = document.getElementById('selectedDate');
    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = formatDate(date);
        select.appendChild(option);
    });
    
    console.log('Found', dates.length, 'unique dates');
}

// Calculate statistics
function calculateStatistics() {
    const totalStudents = studentsData.length;
    
    // Filter by date if selected
    let filteredStudents = studentsData.map(student => {
        let filteredHistory = student.listeningHistory;
        
        if (selectedDate) {
            // Filter for specific date only
            filteredHistory = student.listeningHistory.filter(item => {
                return item.date === selectedDate;
            });
        }
        
        return {
            ...student,
            filteredListeningCount: filteredHistory.length,
            filteredHistory: filteredHistory
        };
    });
    
    const totalListenings = filteredStudents.reduce((sum, s) => sum + s.filteredListeningCount, 0);
    const activeStudents = filteredStudents.filter(s => s.filteredListeningCount > 0).length;
    const inactiveStudents = totalStudents - activeStudents;
    
    // Update main stats
    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('totalListenings').textContent = totalListenings;
    document.getElementById('activeStudents').textContent = activeStudents;
    document.getElementById('inactiveStudents').textContent = inactiveStudents;
    
    // Update filter info
    const filterInfo = document.getElementById('filterInfo');
    if (selectedDate) {
        filterInfo.innerHTML = `<i class="fas fa-info-circle"></i> מציג נתונים לתאריך: <strong>${formatDate(selectedDate)}</strong>`;
        filterInfo.style.display = 'block';
    } else {
        filterInfo.innerHTML = '<i class="fas fa-info-circle"></i> מציג את כל הנתונים';
        filterInfo.style.display = 'block';
    }
    
    // Show inactive students
    renderInactiveStudents(filteredStudents.filter(s => s.filteredListeningCount === 0));
    
    // Show grade statistics
    renderGradeStats(filteredStudents);
    
    // Show top students
    renderTopStudents(filteredStudents);
}

// Format date for display
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

// Render inactive students
function renderInactiveStudents(inactiveStudents) {
    const container = document.getElementById('inactiveStudentsList');
    
    if (inactiveStudents.length === 0) {
        container.innerHTML = '<div class="no-data">כל התלמידות פעילות בתקופה זו!</div>';
        return;
    }
    
    // Group by grade
    const byGrade = {};
    inactiveStudents.forEach(student => {
        const grade = student.grade || 'ללא שכבה';
        if (!byGrade[grade]) byGrade[grade] = [];
        byGrade[grade].push(student);
    });
    
    const html = Object.keys(byGrade).sort().map(grade => `
        <div class="grade-group">
            <h4 class="grade-title">
                <i class="fas fa-graduation-cap"></i>
                שכבה ${grade} (${byGrade[grade].length} תלמידות)
            </h4>
            <div class="students-list">
                ${byGrade[grade].map(student => `
                    <div class="student-item">
                        <a href="student-detail.html?id=${student.id}">
                            <i class="fas fa-user"></i>
                            ${student.name}
                        </a>
                        <span class="class-badge">${student.className}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Render grade statistics
function renderGradeStats(students) {
    const container = document.getElementById('gradeStats');
    
    const byGrade = {};
    students.forEach(student => {
        const grade = student.grade || 'ללא שכבה';
        if (!byGrade[grade]) {
            byGrade[grade] = {
                total: 0,
                active: 0,
                listenings: 0
            };
        }
        byGrade[grade].total++;
        if (student.filteredListeningCount > 0) {
            byGrade[grade].active++;
            byGrade[grade].listenings += student.filteredListeningCount;
        }
    });
    
    const html = Object.keys(byGrade).sort().map(grade => {
        const stats = byGrade[grade];
        const activePercent = Math.round((stats.active / stats.total) * 100);
        
        return `
            <div class="grade-stat-card">
                <div class="grade-stat-header">
                    <h4>שכבה ${grade}</h4>
                    <div class="grade-badge">${stats.total} תלמידות</div>
                </div>
                <div class="grade-stat-body">
                    <div class="stat-row">
                        <span class="stat-label">תלמידות פעילות:</span>
                        <span class="stat-value">${stats.active} (${activePercent}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">סך האזנות:</span>
                        <span class="stat-value">${stats.listenings}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">ממוצע לתלמידה:</span>
                        <span class="stat-value">${stats.active > 0 ? Math.round(stats.listenings / stats.active) : 0}</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${activePercent}%"></div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Render top students
function renderTopStudents(students) {
    const container = document.getElementById('topStudents');
    
    const sorted = students
        .filter(s => s.filteredListeningCount > 0)
        .sort((a, b) => b.filteredListeningCount - a.filteredListeningCount)
        .slice(0, 20);
    
    if (sorted.length === 0) {
        container.innerHTML = '<div class="no-data">אין נתונים להצגה</div>';
        return;
    }
    
    const html = sorted.map((student, index) => `
        <div class="top-student-item">
            <div class="rank">${index + 1}</div>
            <div class="student-info-top">
                <a href="student-detail.html?id=${student.id}" class="student-name-link">
                    ${student.name}
                </a>
                <div class="student-meta">
                    <span class="class-badge">${student.className}</span>
                </div>
            </div>
            <div class="listening-count-top">
                <i class="fas fa-headphones"></i>
                ${student.filteredListeningCount} האזנות
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Date filter handlers
document.getElementById('selectedDate').addEventListener('change', (e) => {
    selectedDate = e.target.value || null;
    calculateStatistics();
});

document.getElementById('applyDateFilter').addEventListener('click', () => {
    const dateInput = document.getElementById('selectedDate').value;
    selectedDate = dateInput || null;
    calculateStatistics();
});

document.getElementById('resetDateFilter').addEventListener('click', () => {
    document.getElementById('selectedDate').value = '';
    selectedDate = null;
    calculateStatistics();
});

// Export to Excel
document.getElementById('exportToExcel').addEventListener('click', () => {
    exportToExcel();
});

function exportToExcel() {
    // Prepare data for export
    const exportData = studentsData.map(student => {
        // Check if student listened on selected date
        let status = 'לא הקשיבה';
        
        if (selectedDate) {
            const listenedOnDate = student.listeningHistory.some(item => item.date === selectedDate);
            status = listenedOnDate ? 'הקשיבה' : 'לא הקשיבה';
        } else {
            // If no date selected, check if student has any listening history
            status = student.listeningHistory.length > 0 ? 'הקשיבה' : 'לא הקשיבה';
        }
        
        return {
            'שכבה': student.grade,
            'כיתה': student.className,
            'תעודת זהות': student.id,
            'שם פרטי': student.firstName,
            'שם משפחה': student.lastName,
            'סטטוס': status
        };
    });
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set RTL (Right to Left) for the worksheet
    if (!ws['!views']) ws['!views'] = [{}];
    ws['!views'][0] = { rightToLeft: true };
    
    // Set column widths
    ws['!cols'] = [
        { wch: 10 },  // שכבה
        { wch: 15 },  // כיתה
        { wch: 15 },  // תעודת זהות
        { wch: 20 },  // שם פרטי
        { wch: 20 },  // שם משפחה
        { wch: 15 }   // סטטוס
    ];
    
    // Style the header row
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        if (!ws[address].s) ws[address].s = {};
        ws[address].s = {
            font: { bold: true, sz: 12 },
            fill: { fgColor: { rgb: "90C695" } },
            alignment: { horizontal: "right", vertical: "center" }
        };
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Set workbook properties for RTL
    wb.Workbook = {
        Views: [{
            RTL: true
        }]
    };
    
    XLSX.utils.book_append_sheet(wb, ws, 'דוח');
    
    // Generate filename
    let filename = 'דוח';
    if (selectedDate) {
        const formattedDate = formatDateForFilename(selectedDate);
        filename = `דוח_${formattedDate}`;
    } else {
        const today = new Date();
        const formattedDate = formatDateForFilename(today.toISOString().split('T')[0]);
        filename = `דוח_כללי_${formattedDate}`;
    }
    
    // Save file
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

function formatDateForFilename(dateStr) {
    // Convert YYYY-MM-DD to DD-MM-YYYY
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
}

// Initialize
async function init() {
    await loadListeningData();
    await loadStudentsData();
    initTabs();
}

// Initialize tabs
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

// Refresh data
document.getElementById('refreshData').addEventListener('click', async () => {
    const btn = document.getElementById('refreshData');
    const icon = btn.querySelector('i');
    
    // Add spinning animation
    icon.classList.add('fa-spin');
    btn.disabled = true;
    
    // Clear existing data
    listeningData = {};
    studentsData = [];
    
    // Reload data
    await loadListeningData();
    await loadStudentsData();
    
    // Remove spinning animation
    icon.classList.remove('fa-spin');
    btn.disabled = false;
});

init();
