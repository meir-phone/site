// Load and parse data
let studentsData = [];
let listeningData = {};
let selectedDate = null;
let isLoadingListeningData = false;

// Cache configuration
const CACHE_KEY_STUDENTS = 'merhavim_stats_students_cache';
const CACHE_KEY_LISTENING = 'merhavim_stats_listening_cache';
const CACHE_KEY_TIMESTAMP = 'merhavim_stats_cache_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// API URL for the INI file
const INI_FILE_URL = 'https://www.call2all.co.il/ym/api//DownloadFile?token=WU1BUElL.apik_H5dQJ0e4Fdyc8NiRvSWMdw.jhS6PXCTir0yTsW-ydHKZ45Mu3P3_e-RYTsoEg9p4eo&path=ivr2:18/ListeningOk.ini';

// Check if cache is valid
function isCacheValid() {
    const timestamp = localStorage.getItem(CACHE_KEY_TIMESTAMP);
    if (!timestamp) return false;
    
    const age = Date.now() - parseInt(timestamp);
    return age < CACHE_DURATION;
}

// Load from cache
function loadFromCache() {
    try {
        const studentsCache = localStorage.getItem(CACHE_KEY_STUDENTS);
        const listeningCache = localStorage.getItem(CACHE_KEY_LISTENING);
        
        if (studentsCache && listeningCache) {
            studentsData = JSON.parse(studentsCache);
            listeningData = JSON.parse(listeningCache);
            console.log('⚡ Loaded from cache:', studentsData.length, 'students - INSTANT!');
            return true;
        }
    } catch (error) {
        console.error('Error loading from cache:', error);
    }
    return false;
}

// Save to cache
function saveToCache() {
    try {
        localStorage.setItem(CACHE_KEY_STUDENTS, JSON.stringify(studentsData));
        localStorage.setItem(CACHE_KEY_LISTENING, JSON.stringify(listeningData));
        localStorage.setItem(CACHE_KEY_TIMESTAMP, Date.now().toString());
        console.log('💾 Data saved to cache');
    } catch (error) {
        console.error('Error saving to cache:', error);
        if (error.name === 'QuotaExceededError') {
            console.log('⚠️ Storage quota exceeded, clearing cache...');
            clearCache();
        }
    }
}

// Clear cache
function clearCache() {
    localStorage.removeItem(CACHE_KEY_STUDENTS);
    localStorage.removeItem(CACHE_KEY_LISTENING);
    localStorage.removeItem(CACHE_KEY_TIMESTAMP);
    console.log('🗑️ Cache cleared');
}

// Parse INI file
async function loadListeningData() {
    try {
        console.log('🔄 Loading listening data from server...');
        isLoadingListeningData = true;
        
        const startTime = Date.now();
        const response = await fetch(INI_FILE_URL);
        const loadTime = Date.now() - startTime;
        
        console.log('✅ Server response received in', loadTime, 'ms');
        
        const text = await response.text();
        const lines = text.split('\n');
        
        console.log('📄 Total lines in file:', lines.length);
        
        let processedCount = 0;
        listeningData = {}; // Clear existing data
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            const parts = line.split('-');
            if (parts.length < 7) return;
            
            const id = parts[0].replace('teudat_zehut_', '');
            const extension = parts[1];
            const file = parts[2];
            const originalDate = `${parts[4]}-${parts[5]}-${parts[6]}`;
            const time = `${parts[8]}-${parts[9]}-${parts[10]}`.replace(/-/g, ':');
            
            // Create datetime object
            const datetime = new Date(`${originalDate} ${time}`);
            
            // Subtract 5 hours to shift day boundary from 00:00 to 05:00
            const adjustedDatetime = new Date(datetime.getTime() - (5 * 60 * 60 * 1000));
            
            // Extract adjusted date in YYYY-MM-DD format
            const adjustedDate = adjustedDatetime.toISOString().split('T')[0];
            
            if (!listeningData[id]) {
                listeningData[id] = [];
            }
            
            listeningData[id].push({
                extension,
                file,
                date: adjustedDate,
                time,
                datetime: adjustedDatetime
            });
            
            processedCount++;
        });
        
        const totalStudents = Object.keys(listeningData).length;
        const totalListenings = Object.values(listeningData).reduce((sum, arr) => sum + arr.length, 0);
        
        console.log('✅ Listening data loaded successfully!');
        console.log('👥 Students with listening history:', totalStudents);
        console.log('🎧 Total listening records:', totalListenings);
        
        isLoadingListeningData = false;
        
        // Update students with listening data
        updateStudentsWithListeningData();
        
        // Update chart with new data
        renderProgressChart();
        
        // Save to cache
        saveToCache();
        
    } catch (error) {
        console.error('❌ Error loading listening data:', error);
        isLoadingListeningData = false;
    }
}

// Update students with listening data after it's loaded
function updateStudentsWithListeningData() {
    if (studentsData.length === 0) return;
    
    console.log('🔄 Updating students with listening data...');
    
    studentsData = studentsData.map(student => ({
        ...student,
        listeningHistory: listeningData[student.id] || []
    }));
    
    populateDateDropdown();
    calculateStatistics();
    
    console.log('✅ Students updated with listening data');
}

// Load Excel data
async function loadStudentsData() {
    try {
        console.log('⚡ Loading Excel file (fast mode)...');
        const response = await fetch('תלמידים.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('✅ Excel data loaded:', data.length, 'rows');
        
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
        
        console.log('✅ Processed students:', studentsData.length);
        
        // Show initial stats (will be updated when listening data loads)
        populateDateDropdown();
        calculateStatistics();
        
        console.log('⚡ Page rendered!');
        
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
    
    // Populate custom dropdown
    const customOptions = document.querySelector('.custom-options');
    
    // Clear existing options except the first one (the default "כל התאריכים")
    const firstOption = customOptions.querySelector('.custom-option');
    customOptions.innerHTML = '';
    customOptions.appendChild(firstOption);
    
    dates.forEach(date => {
        const option = document.createElement('div');
        option.className = 'custom-option';
        option.dataset.value = date;
        option.innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            ${formatDate(date)}
        `;
        customOptions.appendChild(option);
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
    
    // Update main stats with animation
    animateNumber('totalStudents', totalStudents);
    animateNumber('totalListenings', totalListenings);
    animateNumber('activeStudents', activeStudents);
    animateNumber('inactiveStudents', inactiveStudents);
    
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
    
    // Render progress chart
    renderProgressChart();
}

// Animate number update
function animateNumber(elementId, targetNumber) {
    const element = document.getElementById(elementId);
    const currentText = element.textContent.trim();
    
    // If it's loading dots, start from 0
    const startNumber = currentText.includes('.') ? 0 : parseInt(currentText) || 0;
    
    const duration = 1000; // 1 second
    const steps = 30;
    const increment = (targetNumber - startNumber) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const timer = setInterval(() => {
        currentStep++;
        const currentValue = Math.round(startNumber + (increment * currentStep));
        
        if (currentStep >= steps) {
            element.textContent = targetNumber;
            clearInterval(timer);
        } else {
            element.textContent = currentValue;
        }
    }, stepDuration);
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

// Render progress chart
let progressChart = null;

function renderProgressChart() {
    const canvas = document.getElementById('progressChart');
    if (!canvas) {
        console.log('⚠️ Canvas element not found');
        return;
    }
    
    console.log('📊 Rendering progress chart...');
    
    // Collect all dates and calculate percentages
    const dateMap = {};
    const totalStudents = studentsData.length;
    
    if (totalStudents === 0) {
        console.log('⚠️ No students data available');
        return;
    }
    
    // Initialize all dates with 0
    Object.values(listeningData).forEach(history => {
        history.forEach(item => {
            if (!dateMap[item.date]) {
                dateMap[item.date] = new Set();
            }
        });
    });
    
    // Count unique students per date
    Object.entries(listeningData).forEach(([studentId, history]) => {
        history.forEach(item => {
            if (!dateMap[item.date]) {
                dateMap[item.date] = new Set();
            }
            dateMap[item.date].add(studentId);
        });
    });
    
    // Convert to arrays and calculate percentages
    const dates = Object.keys(dateMap).sort();
    
    if (dates.length === 0) {
        console.log('⚠️ No dates found in listening data');
        // Show empty state
        const ctx = canvas.getContext('2d');
        if (progressChart) {
            progressChart.destroy();
        }
        ctx.font = '16px Heebo';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('אין נתונים להצגה', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const percentages = dates.map(date => {
        const uniqueStudents = dateMap[date].size;
        return Math.round((uniqueStudents / totalStudents) * 100);
    });
    
    console.log(`📊 Chart data: ${dates.length} dates, ${percentages.length} percentages`);
    
    // Format dates for display (last 30 days or all if less)
    const displayDates = dates.slice(-30).map(date => formatDate(date));
    const displayPercentages = percentages.slice(-30);
    
    // Destroy existing chart if exists
    if (progressChart) {
        progressChart.destroy();
    }
    
    // Create new chart
    const ctx = canvas.getContext('2d');
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayDates,
            datasets: [{
                label: 'אחוז תלמידות פעילות',
                data: displayPercentages,
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: 'rgb(76, 175, 80)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        font: {
                            family: 'Heebo',
                            size: 14,
                            weight: '600'
                        },
                        color: '#2d5016',
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(45, 80, 22, 0.95)',
                    titleFont: {
                        family: 'Heebo',
                        size: 14,
                        weight: '700'
                    },
                    bodyFont: {
                        family: 'Heebo',
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + '% מהתלמידות';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        font: {
                            family: 'Heebo',
                            size: 12,
                            weight: '600'
                        },
                        color: '#5a6c57'
                    },
                    grid: {
                        color: 'rgba(76, 175, 80, 0.1)',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        font: {
                            family: 'Heebo',
                            size: 11,
                            weight: '500'
                        },
                        color: '#5a6c57',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    console.log('✅ Chart rendered successfully');
}

// Date filter handlers - Custom select
function initCustomSelect() {
    const customSelect = document.getElementById('customDateSelect');
    const trigger = customSelect.querySelector('.custom-select-trigger');
    const options = customSelect.querySelectorAll('.custom-option');
    const selectedText = customSelect.querySelector('.selected-text');
    const hiddenInput = document.getElementById('selectedDate');
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });
    
    // Handle option selection
    customSelect.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-option');
        if (!option) return;
        
        // Remove active class from all options
        options.forEach(opt => opt.classList.remove('active'));
        
        // Add active class to selected option
        option.classList.add('active');
        
        // Update selected text
        const text = option.textContent.trim();
        selectedText.textContent = text;
        
        // Update hidden input value
        const value = option.dataset.value || '';
        hiddenInput.value = value;
        
        // Update selected date and recalculate
        selectedDate = value || null;
        calculateStatistics();
        
        // Close dropdown
        customSelect.classList.remove('open');
    });
}

// Export to Excel
document.getElementById('exportToExcel').addEventListener('click', () => {
    exportToExcel();
});

function exportToExcel() {
    let exportData = [];
    
    if (selectedDate) {
        // Export for specific date - one row per student
        exportData = studentsData.map(student => {
            const listenedOnDate = student.listeningHistory.some(item => item.date === selectedDate);
            const status = listenedOnDate ? 'הקשיבה' : 'לא הקשיבה';
            
            return {
                'שכבה': student.grade,
                'כיתה': student.className,
                'תעודת זהות': student.id,
                'שם פרטי': student.firstName,
                'שם משפחה': student.lastName,
                'סטטוס': status
            };
        });
    } else {
        // Export all dates - one row per student per date
        studentsData.forEach(student => {
            if (student.listeningHistory.length > 0) {
                // Group listening history by date
                const dateMap = {};
                student.listeningHistory.forEach(listening => {
                    if (!dateMap[listening.date]) {
                        dateMap[listening.date] = true;
                    }
                });
                
                // Add a row for each unique date
                Object.keys(dateMap).sort().forEach(date => {
                    exportData.push({
                        'תאריך': formatDate(date),
                        'שכבה': student.grade,
                        'כיתה': student.className,
                        'תעודת זהות': student.id,
                        'שם פרטי': student.firstName,
                        'שם משפחה': student.lastName,
                        'סטטוס': 'הקשיבה'
                    });
                });
            } else {
                // Add one row for students with no listening history
                exportData.push({
                    'תאריך': '',
                    'שכבה': student.grade,
                    'כיתה': student.className,
                    'תעודת זהות': student.id,
                    'שם פרטי': student.firstName,
                    'שם משפחה': student.lastName,
                    'סטטוס': 'לא הקשיבה'
                });
            }
        });
    }
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set RTL (Right to Left) for the worksheet
    if (!ws['!views']) ws['!views'] = [{}];
    ws['!views'][0] = { rightToLeft: true };
    
    // Set column widths based on export type
    if (selectedDate) {
        ws['!cols'] = [
            { wch: 10 },  // שכבה
            { wch: 15 },  // כיתה
            { wch: 15 },  // תעודת זהות
            { wch: 20 },  // שם פרטי
            { wch: 20 },  // שם משפחה
            { wch: 15 }   // סטטוס
        ];
    } else {
        ws['!cols'] = [
            { wch: 15 },  // תאריך
            { wch: 10 },  // שכבה
            { wch: 15 },  // כיתה
            { wch: 15 },  // תעודת זהות
            { wch: 20 },  // שם פרטי
            { wch: 20 },  // שם משפחה
            { wch: 15 }   // סטטוס
        ];
    }
    
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

// Initialize - Progressive loading with cache!
async function init() {
    // Check if we have valid cache
    if (isCacheValid() && loadFromCache()) {
        console.log('⚡⚡⚡ INSTANT LOAD FROM CACHE - 0ms! ⚡⚡⚡');
        populateDateDropdown();
        calculateStatistics();
        renderProgressChart();
        initTabs();
        
        // Show cache age
        const timestamp = localStorage.getItem(CACHE_KEY_TIMESTAMP);
        const age = Math.round((Date.now() - parseInt(timestamp)) / 1000);
        console.log(`📅 Cache age: ${age} seconds (valid for ${CACHE_DURATION/1000} seconds)`);
        return;
    }
    
    console.log('📥 No valid cache - loading fresh data...');
    
    // Clear old cache
    clearCache();
    
    // Step 1: Load and show students IMMEDIATELY (fast!)
    await loadStudentsData();
    
    // Step 2: Load listening data in background (slower)
    loadListeningData(); // No await - runs in background
    
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
    
    // Initialize custom select
    initCustomSelect();
}

// Refresh data - force reload
document.getElementById('refreshData').addEventListener('click', async () => {
    const btn = document.getElementById('refreshData');
    const icon = btn.querySelector('i');
    
    // Add spinning animation
    icon.classList.add('fa-spin');
    btn.disabled = true;
    
    console.log('🔄 Force refresh - clearing cache...');
    
    // Clear cache
    clearCache();
    
    // Clear existing data
    listeningData = {};
    studentsData = [];
    
    // Reload data progressively
    await loadStudentsData();
    loadListeningData(); // Background load
    
    // Remove spinning animation after students load
    icon.classList.remove('fa-spin');
    btn.disabled = false;
});

init();
