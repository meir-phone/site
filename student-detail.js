// Get student ID from URL
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

let studentData = null;
let listeningData = {};

// API URL for the INI file
const INI_FILE_URL = 'https://www.call2all.co.il/ym/api//DownloadFile?token=kRBbHssbQu1Hqm7X&path=ivr2:18/ListeningOk.ini';

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
        
        const text = await response.text();
        const lines = text.split('\n');
        
        console.log('📄 Total lines in file:', lines.length);
        
        let processedCount = 0;
        
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
                time,
                datetime: new Date(`${date} ${time}`)
            });
            
            processedCount++;
        });
        
        // Sort by date descending
        Object.keys(listeningData).forEach(id => {
            listeningData[id].sort((a, b) => b.datetime - a.datetime);
        });
        
        const totalStudents = Object.keys(listeningData).length;
        const totalListenings = Object.values(listeningData).reduce((sum, arr) => sum + arr.length, 0);
        
        console.log('✅ Listening data loaded successfully!');
        console.log('👥 Students with listening history:', totalStudents);
        console.log('🎧 Total listening records:', totalListenings);
        console.log('⏰ Last update:', new Date().toLocaleString('he-IL'));
    } catch (error) {
        console.error('❌ Error loading listening data:', error);
        console.error('Error details:', error.message);
    }
}

// Load student data from Excel
async function loadStudentData() {
    try {
        const response = await fetch('תלמידים.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        
        const student = data.find(row => {
            const id = String(row['מספר זהות'] || '').trim();
            return id === studentId;
        });
        
        if (student) {
            const firstName = String(student['שם פרטי'] || '').trim();
            const lastName = String(student['שם משפחה'] || '').trim();
            const name = `${firstName} ${lastName}`.trim();
            
            studentData = {
                id: studentId,
                name: name,
                firstName: firstName,
                lastName: lastName,
                grade: student['שכבה'] || '',
                className: student['כיתה'] || '',
                phone: '',
                listeningHistory: listeningData[studentId] || []
            };
            
            renderStudentProfile();
            renderListeningHistory();
        } else {
            document.getElementById('studentProfile').innerHTML = 
                '<div class="no-data">תלמידה לא נמצאה</div>';
        }
    } catch (error) {
        console.error('Error loading student data:', error);
        document.getElementById('studentProfile').innerHTML = 
            '<div class="no-data">שגיאה בטעינת נתונים</div>';
    }
}

// Render student profile
function renderStudentProfile() {
    const profile = document.getElementById('studentProfile');
    
    profile.innerHTML = `
        <div class="profile-header">
            <div class="profile-info">
                <h2>${studentData.name}</h2>
                ${studentData.className ? `<span class="student-badge">${studentData.className}</span>` : ''}
            </div>
        </div>
        <div class="profile-details">
            <div class="detail-item">
                <i class="fas fa-id-card"></i>
                <div class="detail-content">
                    <div class="detail-label">תעודת זהות</div>
                    <div class="detail-value">${studentData.id}</div>
                </div>
            </div>
            ${studentData.grade ? `
            <div class="detail-item">
                <i class="fas fa-graduation-cap"></i>
                <div class="detail-content">
                    <div class="detail-label">שכבה</div>
                    <div class="detail-value">${studentData.grade}</div>
                </div>
            </div>
            ` : ''}
            ${studentData.className ? `
            <div class="detail-item">
                <i class="fas fa-users"></i>
                <div class="detail-content">
                    <div class="detail-label">כיתה</div>
                    <div class="detail-value">${studentData.className}</div>
                </div>
            </div>
            ` : ''}
            <div class="detail-item">
                <i class="fas fa-headphones"></i>
                <div class="detail-content">
                    <div class="detail-label">סך האזנות</div>
                    <div class="detail-value">${studentData.listeningHistory.length}</div>
                </div>
            </div>
        </div>
    `;
}

// Render listening history
function renderListeningHistory() {
    const history = document.getElementById('listeningHistory');
    
    if (studentData.listeningHistory.length === 0) {
        history.innerHTML = `
            <div class="history-header">
                <i class="fas fa-headphones"></i>
                <h3>היסטוריית האזנות</h3>
            </div>
            <div class="no-data">אין היסטוריית האזנות</div>
        `;
        return;
    }
    
    const historyItems = studentData.listeningHistory.map((item, index) => `
        <div class="history-item">
            <div class="history-item-header">
                <div class="file-name">
                    <i class="fas fa-file-audio"></i>
                    ${item.file}
                </div>
                <div class="history-date">
                    <i class="fas fa-clock"></i>
                    ${item.date} בשעה ${item.time}
                </div>
            </div>
            <div class="file-path">
                <i class="fas fa-folder"></i>
                נתיב: ${item.extension}
            </div>
        </div>
    `).join('');
    
    history.innerHTML = `
        <div class="history-header">
            <i class="fas fa-headphones"></i>
            <h3>היסטוריית האזנות (${studentData.listeningHistory.length})</h3>
        </div>
        <div class="history-list">
            ${historyItems}
        </div>
    `;
}

// Calculate listening duration
function calculateDuration(history) {
    if (history.length < 2) return 'לא זמין';
    
    const first = history[history.length - 1].datetime;
    const last = history[0].datetime;
    const diffMs = last - first;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
        return `${diffMins} דקות`;
    } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours} שעות ${mins} דקות`;
    }
}

// Initialize
async function init() {
    if (!studentId) {
        document.getElementById('studentProfile').innerHTML = 
            '<div class="no-data">לא צוין מזהה תלמידה</div>';
        return;
    }
    
    await loadListeningData();
    await loadStudentData();
}

init();
