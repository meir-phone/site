// Load and parse data
let studentsData = [];
let listeningData = {};

// API URL for the INI file
const INI_FILE_URL = 'https://www.call2all.co.il/ym/api//DownloadFile?token=029286458:1020&path=ivr2:18/ListeningOk.ini';

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
            // Date format: Date-2026-03-08-Hour-HH-MM-SS
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
        console.log('📊 Processed lines:', processedCount);
        console.log('⏰ Last update:', new Date().toLocaleString('he-IL'));
        
    } catch (error) {
        console.error('❌ Error loading listening data:', error);
        console.error('Error details:', error.message);
    }
}

// Load Excel data (using SheetJS)
async function loadStudentsData() {
    try {
        console.log('Loading Excel file...');
        const response = await fetch('תלמידים.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('Excel data loaded:', data.length, 'rows');
        if (data.length > 0) {
            console.log('First row columns:', Object.keys(data[0]));
            console.log('First row sample:', data[0]);
            console.log('Column names:', JSON.stringify(Object.keys(data[0])));
        }
        
        // Process students data
        studentsData = data.map((row, index) => {
            const id = String(row['מספר זהות'] || '').trim();
            const firstName = String(row['שם פרטי'] || '').trim();
            const lastName = String(row['שם משפחה'] || '').trim();
            const name = `${firstName} ${lastName}`.trim();
            const grade = String(row['שכבה'] || '').trim();
            const className = String(row['כיתה'] || '').trim();
            const phone = ''; // אין עמודת טלפון בקובץ
            
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
        
        console.log('Processed students:', studentsData.length);
        if (studentsData.length > 0) {
            console.log('Sample student:', studentsData[0]);
        }
        
        renderStudents(studentsData);
        updateStats();
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

// Initialize
async function init() {
    await loadListeningData();
    await loadStudentsData();
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
