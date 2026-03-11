// Load and parse data
let studentsData = [];
let listeningData = {};
let isLoadingListeningData = false;

// Cache configuration
const CACHE_KEY_STUDENTS = 'merhavim_students_cache';
const CACHE_KEY_LISTENING = 'merhavim_listening_cache';
const CACHE_KEY_EXCEL = 'merhavim_excel_cache';
const CACHE_KEY_TIMESTAMP = 'merhavim_cache_timestamp';
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
        // If quota exceeded, clear old cache and try again
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
    localStorage.removeItem(CACHE_KEY_EXCEL);
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
            const date = `${parts[4]}-${parts[5]}-${parts[6]}`;
            const time = `${parts[8]}-${parts[9]}-${parts[10]}`.replace(/-/g, ':');
            
            if (!listeningData[id]) {
                listeningData[id] = [];
            }
            
            listeningData[id].push({
                extension,
                file,
                date,
                time
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
        listeningCount: listeningData[student.id] ? listeningData[student.id].length : 0,
        listeningHistory: listeningData[student.id] || []
    }));
    
    // Re-render with updated data
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const activeGrade = document.querySelector('.filter-btn.active')?.dataset.grade || 'all';
    
    let filtered = studentsData;
    
    if (searchTerm) {
        filtered = filtered.filter(student => 
            student.name.toLowerCase().includes(searchTerm) ||
            student.grade.toLowerCase().includes(searchTerm) ||
            student.className.toLowerCase().includes(searchTerm) ||
            student.id.includes(searchTerm)
        );
    }
    
    if (activeGrade !== 'all') {
        filtered = filtered.filter(s => s.grade === activeGrade);
    }
    
    renderStudents(filtered);
    updateStats();
    
    console.log('✅ Students updated with listening data');
}

// Load Excel data (using SheetJS) - FAST, no waiting for listening data
async function loadStudentsData() {
    try {
        console.log('⚡ Loading Excel file (fast mode)...');
        const response = await fetch('תלמידים.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('✅ Excel data loaded:', data.length, 'rows');
        
        // Process students data WITHOUT listening data (will be added later)
        studentsData = data.map((row, index) => {
            const id = String(row['מספר זהות'] || '').trim();
            const firstName = String(row['שם פרטי'] || '').trim();
            const lastName = String(row['שם משפחה'] || '').trim();
            const name = `${firstName} ${lastName}`.trim();
            const grade = String(row['שכבה'] || '').trim();
            const className = String(row['כיתה'] || '').trim();
            const phone = '';
            
            return {
                id,
                name,
                firstName,
                lastName,
                grade,
                className,
                phone,
                listeningCount: listeningData[id] ? listeningData[id].length : 0,
                listeningHistory: listeningData[id] || []
            };
        }).filter(student => student.name && student.id);
        
        console.log('✅ Processed students:', studentsData.length);
        
        // Render immediately
        renderStudents(studentsData);
        updateStats();
        
        console.log('⚡ Page rendered!');
        
    } catch (error) {
        console.error('Error loading students data:', error);
        document.getElementById('studentsGrid').innerHTML = 
            '<div class="no-data">שגיאה בטעינת נתוני התלמידים: ' + error.message + '</div>';
    }
}

// Render students grid
function renderStudents(students) {
    const grid = document.getElementById('studentsGrid');
    
    if (students.length === 0) {
        grid.innerHTML = '<div class="no-data">לא נמצאו תלמידים</div>';
        return;
    }
    
    grid.innerHTML = students.map(student => `
        <a href="student-detail.html?id=${student.id}" class="student-card">
            <div class="student-header">
                <div>
                    <div class="student-name">${student.name}</div>
                    ${student.grade && student.className ? `<span class="student-badge">${student.className}</span>` : ''}
                </div>
            </div>
            <div class="student-info">
                <div class="info-row">
                    <i class="fas fa-id-card"></i>
                    <span>ת.ז: ${student.id}</span>
                </div>
                ${student.grade ? `
                <div class="info-row">
                    <i class="fas fa-graduation-cap"></i>
                    <span>שכבה: ${student.grade}</span>
                </div>
                ` : ''}
            </div>
            <div class="listening-count">
                <i class="fas fa-headphones"></i>
                <div>
                    <div class="count-number">${student.listeningCount}</div>
                    <div style="font-size: 0.9em; color: var(--text-light);">האזנות</div>
                </div>
            </div>
        </a>
    `).join('');
}

// Update statistics
function updateStats() {
    document.getElementById('totalStudents').textContent = studentsData.length;
    const totalListenings = studentsData.reduce((sum, s) => sum + s.listeningCount, 0);
    document.getElementById('totalListenings').textContent = totalListenings;
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = studentsData.filter(student => 
        student.name.toLowerCase().includes(searchTerm) ||
        student.grade.toLowerCase().includes(searchTerm) ||
        student.className.toLowerCase().includes(searchTerm) ||
        student.id.includes(searchTerm)
    );
    renderStudents(filtered);
});

// Filter by grade
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const grade = btn.dataset.grade;
        if (grade === 'all') {
            renderStudents(studentsData);
        } else {
            const filtered = studentsData.filter(s => s.grade === grade);
            renderStudents(filtered);
        }
    });
});

// Initialize - Progressive loading with cache!
async function init() {
    // Check if we have valid cache
    if (isCacheValid() && loadFromCache()) {
        console.log('⚡⚡⚡ INSTANT LOAD FROM CACHE - 0ms! ⚡⚡⚡');
        renderStudents(studentsData);
        updateStats();
        
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
