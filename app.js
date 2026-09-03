// Global State
let allQuestions = [];
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let timerInterval;
let timeRemaining = 3600;
let studentInfo = {};
let activeTestConfig = {
    testId: "All",
    duration: 60,
    startTime: 0
};

const MARKS_PER_QUESTION = 2.5;
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzH6LhVuapl_6w602GozE1zzwrzx9ZDH_jO_OAcfOWJ3yQgtAzzjR94uuCkqAK4NkuT/exec';
const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC = 'ni_clad_exam_live_control_vishwanath_2026';

let mqttClient = null;
let emergencyCountdownInterval = null;

// Syllabus Weightage Definition (40 Questions total)
const syllabusWeightage = {
    "LabVIEW Programming Principles": 3,
    "LabVIEW Environment": 2,
    "Data Types": 2,
    "Arrays and Clusters": 4,
    "Error Handling": 2,
    "Documentation": 1,
    "Debugging": 2,
    "Loops": 4,
    "Case Structures": 1,
    "Sequence Structures": 1,
    "Event Structures": 2,
    "File I/O": 1,
    "Timing": 2,
    "VI Server": 2,
    "Synchronization and Communication": 2,
    "Design Patterns": 2,
    "Charts and Graphs": 2,
    "Mechanical Actions of Booleans": 1,
    "Property Nodes": 2,
    "Local Variables": 1,
    "Functional Global Variables": 1
};

// DOM Elements
const screens = {
    welcome: document.getElementById('welcome-screen'),
    adminLogin: document.getElementById('admin-login-screen'),
    adminDashboard: document.getElementById('admin-dashboard-screen'),
    studentEntry: document.getElementById('student-entry-screen'),
    test: document.getElementById('test-screen'),
    result: document.getElementById('result-screen')
};

const timerDisplay = document.getElementById('timer');
const qNumber = document.getElementById('q-number');
const qText = document.getElementById('q-text');
const qImageContainer = document.getElementById('q-image-container');
const qImage = document.getElementById('q-image');
const optionsContainer = document.getElementById('options');
const qProgressFooter = document.getElementById('q-progress-footer');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const headerExitBtn = document.getElementById('header-exit-btn');
const restartBtn = document.getElementById('restart-btn');
const emergencyBanner = document.getElementById('emergency-warning-banner');
const emergencyCountdownDisplay = document.getElementById('emergency-countdown-display');

// Show Screen Helper
function showScreen(screenKey) {
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    if (screens[screenKey]) {
        screens[screenKey].classList.add('active');
    }
    // Toggle header timer visibility
    if (screenKey === 'test') {
        timerDisplay.style.display = 'block';
    } else {
        timerDisplay.style.display = 'none';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility: Shuffle Array
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Setup Real-Time MQTT Channel
function setupRealtimeChannel() {
    try {
        if (typeof mqtt !== 'undefined') {
            const clientId = 'clad_user_' + Math.random().toString(16).substr(2, 8);
            mqttClient = mqtt.connect(MQTT_BROKER, { clientId: clientId, keepalive: 60 });

            mqttClient.on('connect', () => {
                console.log("Connected to Real-Time Broadcast Network.");
                mqttClient.subscribe(MQTT_TOPIC);
            });

            mqttClient.on('message', (topic, message) => {
                try {
                    const data = JSON.parse(message.toString());
                    handleRealtimeBroadcast(data);
                } catch (e) {
                    console.error("MQTT Message Parse Error", e);
                }
            });
        }
    } catch (err) {
        console.warn("Real-time network connection skipped:", err);
    }
}

let isSessionTerminated = localStorage.getItem('isSessionTerminated') === 'true';

// Handle Broadcast Received by Students
function handleRealtimeBroadcast(data) {
    if (data.type === 'EMERGENCY_END_WARNING') {
        isSessionTerminated = true;
        localStorage.setItem('isSessionTerminated', 'true');
        
        // Show the 2-minute emergency banner on student screens
        if (emergencyBanner) emergencyBanner.style.display = 'block';

        let warningRemaining = data.durationSec || 120;

        // If taking test, synchronize remaining time to 2 minutes
        if (screens.test.classList.contains('active')) {
            timeRemaining = Math.min(timeRemaining, warningRemaining);
            updateTimerDisplay();
        } else if (screens.studentEntry.classList.contains('active')) {
            // If student is still on entry screen, lock them out!
            const banner = document.getElementById('test-status-banner');
            const regForm = document.getElementById('student-reg-form');
            if (banner) {
                banner.className = 'status-badge badge-locked';
                banner.innerHTML = '🛑 <strong>Session Ended by Instructor.</strong><br>This assessment session has been closed. No new entries permitted.';
                banner.style.display = 'block';
            }
            if (regForm) regForm.style.display = 'none';
        }

        // Update emergency countdown display
        clearInterval(emergencyCountdownInterval);
        emergencyCountdownInterval = setInterval(() => {
            warningRemaining--;
            const m = Math.floor(warningRemaining / 60).toString().padStart(2, '0');
            const s = (warningRemaining % 60).toString().padStart(2, '0');
            if (emergencyCountdownDisplay) emergencyCountdownDisplay.textContent = `${m}:${s}`;

            if (warningRemaining <= 0) {
                clearInterval(emergencyCountdownInterval);
                if (screens.test.classList.contains('active')) {
                    finishAssessment();
                }
            }
        }, 1000);
    } else if (data.type === 'SESSION_RESET') {
        isSessionTerminated = false;
        localStorage.removeItem('isSessionTerminated');
    }
}

// Broadcast End Test from Admin
function broadcastEndExam() {
    if (confirm("⚠️ Are you sure you want to end the examination session for ALL students?\n\nA 2-minute warning countdown will instantly appear on all student screens before auto-submitting, and no new students will be allowed to enter.")) {
        isSessionTerminated = true;
        localStorage.setItem('isSessionTerminated', 'true');
        const payload = JSON.stringify({
            type: 'EMERGENCY_END_WARNING',
            durationSec: 120,
            triggerTime: Date.now()
        });

        if (mqttClient && mqttClient.connected) {
            mqttClient.publish(MQTT_TOPIC, payload, { qos: 1, retain: true });
        } else {
            const client = mqtt.connect(MQTT_BROKER);
            client.on('connect', () => {
                client.publish(MQTT_TOPIC, payload, { qos: 1, retain: true }, () => {
                    client.end();
                });
            });
        }

        const btn = document.getElementById('admin-end-exam-btn');
        if (btn) {
            btn.textContent = "✅ Session Ended (2-Min Warning Broadcasted)";
            btn.disabled = true;
            btn.style.background = "#16a34a";
        }
    }
}

// Encode Test Config to Code
function encodeTestCode(config) {
    try {
        const payload = JSON.stringify({
            t: config.testId,
            d: parseInt(config.duration),
            s: config.startTime ? new Date(config.startTime).getTime() : 0
        });
        return btoa(payload).replace(/=/g, '');
    } catch (e) {
        return "";
    }
}

// Decode Test Code
function decodeTestCode(codeStr) {
    if (!codeStr) return null;
    try {
        let clean = codeStr.trim();
        while (clean.length % 4 !== 0) clean += '=';
        const parsed = JSON.parse(atob(clean));
        return {
            testId: parsed.t || "All",
            duration: parseInt(parsed.d) || 60,
            startTime: parsed.s || 0
        };
    } catch (e) {
        return {
            testId: codeStr.trim(),
            duration: 60,
            startTime: 0
        };
    }
}

// Question Selector: Enforces Syllabus Weightage, Max 10 Theory, Mixed Shuffling
function selectQuestions(allQs, testConfig) {
    if (testConfig.testId && (testConfig.testId.startsWith('Company Specific') || testConfig.testId.startsWith('Industry Specific'))) {
        return [...allQs].filter(q => q.topic === testConfig.testId);
    }
    let pool = shuffleArray([...allQs]);
    
    let groupedTheory = {};
    let groupedPractical = {};
    
    pool.forEach(q => {
        const topic = q.topic || "LabVIEW Programming Principles";
        const isTheory = !q.image || (Array.isArray(q.image) && q.image.length === 0);
        
        if (isTheory) {
            if (!groupedTheory[topic]) groupedTheory[topic] = [];
            groupedTheory[topic].push(q);
        } else {
            if (!groupedPractical[topic]) groupedPractical[topic] = [];
            groupedPractical[topic].push(q);
        }
    });

    let selected = [];
    let totalTheoryCount = 0;
    const MAX_THEORY = 10;

    for (const [topic, count] of Object.entries(syllabusWeightage)) {
        let topicSelected = [];
        let tPool = groupedTheory[topic] || [];
        let pPool = groupedPractical[topic] || [];
        
        let targetTheory = Math.floor(count * 0.25);
        if (targetTheory === 0 && Math.random() < 0.25) targetTheory = 1;
        
        let actualTheory = 0;
        while (actualTheory < targetTheory && tPool.length > 0 && totalTheoryCount < MAX_THEORY) {
            topicSelected.push(tPool.shift());
            actualTheory++;
            totalTheoryCount++;
        }
        
        let remainingForTopic = count - actualTheory;
        while (remainingForTopic > 0 && pPool.length > 0) {
            topicSelected.push(pPool.shift());
            remainingForTopic--;
        }
        
        while (remainingForTopic > 0 && tPool.length > 0 && totalTheoryCount < MAX_THEORY) {
            topicSelected.push(tPool.shift());
            totalTheoryCount++;
            remainingForTopic--;
        }
        
        while (remainingForTopic > 0 && tPool.length > 0) {
            topicSelected.push(tPool.shift());
            totalTheoryCount++;
            remainingForTopic--;
        }
        
        selected = selected.concat(topicSelected);
    }

    let missing = 40 - selected.length;
    if (missing > 0) {
        let remainingP = Object.values(groupedPractical).flat().filter(q => !selected.includes(q));
        let remainingT = Object.values(groupedTheory).flat().filter(q => !selected.includes(q));
        
        while (missing > 0 && remainingP.length > 0) {
            selected.push(remainingP.shift());
            missing--;
        }
        while (missing > 0 && remainingT.length > 0 && totalTheoryCount < MAX_THEORY) {
            selected.push(remainingT.shift());
            totalTheoryCount++;
            missing--;
        }
        while (missing > 0 && remainingT.length > 0) {
            selected.push(remainingT.shift());
            missing--;
        }
    }

    return shuffleArray(selected).slice(0, 40);
}

// App Initialization
async function initApp() {
    try {
        const response = await fetch('questions.json');
        allQuestions = await response.json();
    } catch (err) {
        console.error("Could not load questions.json", err);
    }

    setupRealtimeChannel();

    // Setup Admin Test Selector options (Mock Test 1 to 25)
    const adminTestSelect = document.getElementById('admin-test-select');
    if (adminTestSelect) {
        for (let i = 1; i <= 25; i++) {
            const opt = document.createElement('option');
            opt.value = `Mock Test ${i}`;
            opt.textContent = `Mock Test ${i}`;
            adminTestSelect.appendChild(opt);
        }
        
        // Add specific tests dynamically
        if (allQuestions && allQuestions.length > 0) {
            const specificTopics = [...new Set(allQuestions.map(q => q.topic))].filter(t => t && (t.startsWith('Company Specific') || t.startsWith('Industry Specific')));
            specificTopics.forEach(topic => {
                const opt = document.createElement('option');
                opt.value = topic;
                opt.textContent = topic;
                adminTestSelect.appendChild(opt);
            });
        }
    }

    // Setup Default Start Time in Admin to now
    const adminStartTimeInput = document.getElementById('admin-start-time');
    if (adminStartTimeInput) {
        const now = new Date();
        const isoString = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        adminStartTimeInput.value = isoString;
    }

    // Load saved sheet URL
    const savedSheet = localStorage.getItem('clad_sheet_url');
    if (savedSheet && document.getElementById('admin-sheet-url')) {
        document.getElementById('admin-sheet-url').value = savedSheet;
    }

    setupEventListeners();
    checkUrlParameters();
}

// URL Parameter Handling
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    const adminParam = urlParams.get('admin');

    if (adminParam === 'true') {
        showScreen('adminLogin');
    } else if (codeParam) {
        showScreen('studentEntry');
        document.getElementById('student-test-code').value = codeParam;
        validateAndApplyTestCode(codeParam);
    } else {
        showScreen('welcome');
    }
}

// Event Listeners
function setupEventListeners() {
    // Welcome Screen Buttons
    document.getElementById('btn-goto-student').addEventListener('click', () => {
        showScreen('studentEntry');
        const codeInput = document.getElementById('student-test-code');
        if (!codeInput.value.trim()) {
            const defaultCode = encodeTestCode({ testId: "All", duration: 60, startTime: 0 });
            codeInput.value = defaultCode;
            validateAndApplyTestCode(defaultCode);
        }
    });

    document.getElementById('btn-goto-admin').addEventListener('click', () => {
        showScreen('adminLogin');
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-login-error').style.display = 'none';
        document.getElementById('admin-password').focus();
    });

    // Admin Login
    document.getElementById('admin-login-back').addEventListener('click', () => showScreen('welcome'));
    
    const handleAdminLogin = () => {
        const pwd = document.getElementById('admin-password').value.trim();
        if (pwd === 'Vishwa12@..') {
            document.getElementById('admin-login-error').style.display = 'none';
            showScreen('adminDashboard');
        } else {
            document.getElementById('admin-login-error').style.display = 'block';
        }
    };

    document.getElementById('admin-login-submit').addEventListener('click', handleAdminLogin);
    document.getElementById('admin-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAdminLogin();
    });

    document.getElementById('admin-logout-btn').addEventListener('click', () => showScreen('welcome'));

    // Admin Real-Time End Exam Broadcast
    const endExamBtn = document.getElementById('admin-end-exam-btn');
    if (endExamBtn) {
        endExamBtn.addEventListener('click', broadcastEndExam);
    }

    // Admin Code Generation
    document.getElementById('admin-generate-code-btn').addEventListener('click', () => {
        // --- NEW: Reset Session Termination ---
        isSessionTerminated = false;
        localStorage.removeItem('isSessionTerminated');
        const endBtn = document.getElementById('admin-end-exam-btn');
        if (endBtn) {
            endBtn.textContent = "🛑 End Exam Now (2-Min Warning)";
            endBtn.disabled = false;
            endBtn.style.background = "#e11d48";
        }
        
        // Broadcast SESSION_RESET to clear retained MQTT emergency warnings
        const resetPayload = JSON.stringify({ type: 'SESSION_RESET', triggerTime: Date.now() });
        if (mqttClient && mqttClient.connected) {
            mqttClient.publish(MQTT_TOPIC, resetPayload, { qos: 1, retain: true });
        } else {
            const client = mqtt.connect(MQTT_BROKER);
            client.on('connect', () => {
                client.publish(MQTT_TOPIC, resetPayload, { qos: 1, retain: true }, () => client.end());
            });
        }
        // ----------------------------------------

        const testId = document.getElementById('admin-test-select').value;
        const duration = document.getElementById('admin-test-duration').value;
        const startTimeVal = document.getElementById('admin-start-time').value;

        const config = {
            testId: testId,
            duration: duration,
            startTime: startTimeVal
        };

        const code = encodeTestCode(config);
        const baseUrl = window.location.origin + window.location.pathname;
        const fullLink = `${baseUrl}?code=${code}`;

        document.getElementById('output-test-code').value = code;
        document.getElementById('output-test-link').value = fullLink;
        document.getElementById('generated-code-box').style.display = 'block';
    });

    // Copy Code & Link
    document.getElementById('btn-copy-code').addEventListener('click', () => {
        const input = document.getElementById('output-test-code');
        input.select();
        navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('btn-copy-code');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    document.getElementById('btn-copy-link').addEventListener('click', () => {
        const input = document.getElementById('output-test-link');
        input.select();
        navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('btn-copy-link');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });

    // Open Live Sheet
    document.getElementById('admin-open-sheet-btn').addEventListener('click', () => {
        const url = document.getElementById('admin-sheet-url').value.trim();
        if (url) {
            localStorage.setItem('clad_sheet_url', url);
            window.open(url, '_blank');
        } else {
            alert('Please paste your Google Sheet link first.');
        }
    });

    // Student Screen
    document.getElementById('student-back-btn').addEventListener('click', () => showScreen('welcome'));
    
    document.getElementById('btn-validate-code').addEventListener('click', () => {
        const code = document.getElementById('student-test-code').value.trim();
        validateAndApplyTestCode(code);
    });

    // Start Assessment Button
    document.getElementById('student-start-btn').addEventListener('click', startAssessment);

    // Test Screen Buttons
    prevBtn.addEventListener('click', () => navigateQuestion(-1));
    nextBtn.addEventListener('click', () => navigateQuestion(1));
    submitBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to finish and submit your test?")) {
            finishAssessment();
        }
    });
    headerExitBtn.addEventListener('click', () => {
        if (confirm("Warning: Exiting will submit your current answers. Proceed?")) {
            finishAssessment();
        }
    });

    // Result Screen Buttons
    restartBtn.addEventListener('click', () => showScreen('welcome'));
    document.getElementById('download-cert-btn').addEventListener('click', downloadCertificate);
    
    const qpBtn = document.getElementById('download-qp-btn');
    if (qpBtn) {
        qpBtn.addEventListener('click', downloadQuestionPaper);
    }
}

// Download / Print Question Paper (Questions & Options ONLY - No Answers)
function downloadQuestionPaper() {
    const candidateName = studentInfo.name || 'Candidate';
    const regNo = studentInfo.reg || 'N/A';
    const classSec = `${studentInfo.cls || 'N/A'} - ${studentInfo.sec || 'N/A'}`;
    const testTitle = studentInfo.testId || 'CLAD Assessment';
    const examDate = new Date().toLocaleDateString();

    let questionsHtml = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    questions.forEach((q, idx) => {
        let imageHtml = '';
        if (q.image && Array.isArray(q.image) && q.image.length > 0) {
            imageHtml = `<div style="text-align: center; margin: 15px 0;">`;
            q.image.forEach(imgSrc => {
                imageHtml += `<img src="${imgSrc}" style="max-width: 90%; max-height: 280px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; margin: 4px;">`;
            });
            imageHtml += `</div>`;
        }

        let optionsHtml = '<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">';
        q.options.forEach((opt, optIdx) => {
            let optText = opt;
            if (typeof opt === 'string' && opt.startsWith('IMAGE: ')) {
                const imgSrc = opt.replace('IMAGE: ', '');
                optText = `<img src="${imgSrc}" style="max-height: 80px; vertical-align: middle;">`;
            }
            optionsHtml += `
                <div style="display: flex; align-items: flex-start; gap: 10px; font-size: 14px;">
                    <span style="display: inline-block; width: 22px; height: 22px; border: 1px solid #94a3b8; border-radius: 50%; text-align: center; line-height: 20px; font-weight: 700; font-size: 12px; color: #334155; flex-shrink: 0;">${letters[optIdx]}</span>
                    <span style="color: #1e293b;">${optText}</span>
                </div>
            `;
        });
        optionsHtml += '</div>';

        questionsHtml += `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 20px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #0077c8; font-size: 14px;">QUESTION ${idx + 1} OF ${questions.length}</span>
                    <span style="font-size: 12px; color: #64748b;">${q.topic || 'General'}</span>
                </div>
                <div style="font-size: 15px; font-weight: 600; color: #0f172a; line-height: 1.5; white-space: pre-line;">${q.text}</div>
                ${imageHtml}
                ${optionsHtml}
            </div>
        `;
    });

    const qpHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Question Paper - ${candidateName} - ${testTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
        <style>
            @page {
                size: A4 portrait;
                margin: 12mm 15mm;
            }
            * { box-sizing: border-box; }
            html, body {
                font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                color: #0f172a;
                background: #ffffff;
                margin: 0;
                padding: 0;
                line-height: 1.55;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .paper-container {
                max-width: 820px;
                margin: 0 auto;
                padding: 10px 0;
            }
            .header-box {
                border: 2px solid #0077c8;
                border-radius: 8px;
                padding: 18px 22px;
                margin-bottom: 22px;
                text-align: center;
                background: #ffffff;
                page-break-inside: avoid;
            }
            .brand-title {
                font-size: 22px;
                font-weight: 800;
                color: #0077c8;
                margin: 0 0 2px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .exam-title {
                font-size: 16px;
                font-weight: 700;
                color: #1e293b;
                margin: 0 0 14px 0;
            }
            .candidate-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px 16px;
                text-align: left;
                font-size: 13px;
                background: #f0f7fc;
                padding: 10px 14px;
                border-radius: 6px;
                border: 1px solid #bae6fd;
            }
            .paper-meta-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                color: #475569;
                font-weight: 600;
                margin-bottom: 20px;
                padding-bottom: 8px;
                border-bottom: 1.5px solid #e2e8f0;
            }
            .paper-footer {
                text-align: center;
                font-size: 12px;
                color: #64748b;
                margin-top: 35px;
                padding-top: 15px;
                border-top: 1px solid #e2e8f0;
                page-break-inside: avoid;
            }
            @media print {
                body { padding: 0; background: #ffffff; }
                .paper-container { max-width: 100%; width: 100%; }
            }
        </style>
    </head>
    <body>
        <div class="paper-container">
            <div class="header-box">
                <div class="brand-title">National Instruments</div>
                <div class="exam-title">Certified LabVIEW Associate Developer (CLAD) — Question Paper</div>
                <div class="candidate-grid">
                    <div><strong>Candidate:</strong> ${candidateName}</div>
                    <div><strong>Register Number:</strong> ${regNo}</div>
                    <div><strong>Class & Section:</strong> ${classSec}</div>
                    <div><strong>Assessment Date:</strong> ${examDate}</div>
                </div>
            </div>

            <div class="paper-meta-bar">
                <span>Total Questions: <strong>${questions.length}</strong></span>
                <span>Session: <strong>${testTitle}</strong></span>
                <span>Official Assessment Booklet</span>
            </div>

            ${questionsHtml}

            <div class="paper-footer">
                National Instruments CLAD Assessment System • End of Examination Booklet
            </div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 300);
            };
        </script>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(qpHtml);
        printWin.document.close();

        // Mark as downloaded and clear local question memory as requested
        const qpBtn = document.getElementById('download-qp-btn');
        if (qpBtn) {
            qpBtn.textContent = '✅ Question Paper Downloaded';
            qpBtn.style.background = '#16a34a';
            qpBtn.disabled = true;
        }
    } else {
        alert("Pop-up blocked. Please allow popups to save your Question Paper PDF.");
    }
}

// Validate Test Code & Check Time-Lock
function validateAndApplyTestCode(codeStr) {
    const banner = document.getElementById('test-status-banner');
    const regForm = document.getElementById('student-reg-form');
    
    if (isSessionTerminated) {
        banner.className = 'status-badge badge-locked';
        banner.innerHTML = '🛑 <strong>No Active Test Session.</strong><br>The instructor has ended this examination session. No further attempts are permitted.';
        banner.style.display = 'block';
        regForm.style.display = 'none';
        return;
    }

    const config = decodeTestCode(codeStr);
    if (!config) {
        banner.className = 'status-badge badge-locked';
        banner.innerHTML = '❌ <strong>Invalid Test Code.</strong> Please verify with your instructor.';
        banner.style.display = 'block';
        regForm.style.display = 'none';
        return;
    }

    activeTestConfig = config;
    const now = Date.now();
    const scheduledTime = config.startTime;

    // Check if activation time has not arrived yet
    if (scheduledTime && now < scheduledTime) {
        const unlockDate = new Date(scheduledTime);
        const formattedTime = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = unlockDate.toLocaleDateString();

        banner.className = 'status-badge badge-locked';
        banner.innerHTML = `🔒 <strong>Assessment Locked!</strong><br>This session opens on <strong>${formattedDate} at ${formattedTime}</strong>.<br><small>Please return at or after that time to begin.</small>`;
        banner.style.display = 'block';
        regForm.style.display = 'none';
        return;
    }

    // Unlocked & Active!
    banner.className = 'status-badge badge-active';
    banner.innerHTML = `✅ <strong>Assessment Active: ${config.testId}</strong><br>Duration: <strong>${config.duration} Minutes</strong>. Fill your details below to start.`;
    banner.style.display = 'block';
    regForm.style.display = 'block';
}

// Start Assessment
function startAssessment() {
    const name = document.getElementById('student-name').value.trim();
    const reg = document.getElementById('student-reg').value.trim();
    const cls = document.getElementById('student-class').value.trim();
    const sec = document.getElementById('student-sec').value.trim();

    if (!name || !reg || !cls || !sec) {
        alert("Please fill in all registration fields.");
        return;
    }

    studentInfo = {
        name: name,
        reg: reg,
        cls: cls,
        sec: sec,
        duration: activeTestConfig.duration * 60,
        testId: activeTestConfig.testId
    };

    document.getElementById('footer-name').textContent = studentInfo.name;
    document.getElementById('footer-reg').textContent = studentInfo.reg;
    document.getElementById('test-active-title').textContent = `CLAD Assessment - ${studentInfo.testId}`;

    questions = selectQuestions(allQuestions, activeTestConfig);
    userAnswers = new Array(questions.length).fill(null);
    currentQuestionIndex = 0;
    timeRemaining = studentInfo.duration;

    showScreen('test');
    startTimer();
    renderQuestion();
}

// Timer Logic
function startTimer() {
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("⏰ Time is up! Submitting your assessment automatically.");
            finishAssessment();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const h = Math.floor(timeRemaining / 3600).toString().padStart(2, '0');
    const m = Math.floor((timeRemaining % 3600) / 60).toString().padStart(2, '0');
    const s = (timeRemaining % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${h}:${m}:${s}`;

    if (timeRemaining < 300) {
        timerDisplay.style.color = '#dc2626';
        timerDisplay.style.background = '#fee2e2';
    } else {
        timerDisplay.style.color = 'var(--danger)';
        timerDisplay.style.background = 'var(--danger-bg)';
    }
}

// Question Navigation & Rendering
function navigateQuestion(dir) {
    const newIdx = currentQuestionIndex + dir;
    if (newIdx >= 0 && newIdx < questions.length) {
        currentQuestionIndex = newIdx;
        renderQuestion();
    }
}

function renderQuestion() {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    qNumber.textContent = `Question #${currentQuestionIndex + 1}`;
    qProgressFooter.textContent = `${currentQuestionIndex + 1} / ${questions.length}`;
    qText.textContent = q.text;

    qImageContainer.innerHTML = '';
    if (q.image && Array.isArray(q.image) && q.image.length > 0) {
        q.image.forEach(imgSrc => {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = 'Question Diagram';
            qImageContainer.appendChild(img);
        });
        qImageContainer.style.display = 'block';
    } else {
        qImageContainer.style.display = 'none';
    }

    optionsContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    q.options.forEach((opt, idx) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = `option ${userAnswers[currentQuestionIndex] === idx ? 'selected' : ''}`;

        let optContent = opt;
        if (typeof opt === 'string' && opt.startsWith('IMAGE: ')) {
            const imgSrc = opt.replace('IMAGE: ', '');
            optContent = `<img src="${imgSrc}" alt="Option Image" style="max-height: 120px; border-radius: 4px;">`;
        }

        optionDiv.innerHTML = `
            <div class="option-letter">${letters[idx]}</div>
            <div class="option-text">${optContent}</div>
        `;

        optionDiv.addEventListener('click', () => {
            userAnswers[currentQuestionIndex] = idx;
            renderQuestion();
        });

        optionsContainer.appendChild(optionDiv);
    });

    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questions.length - 1;
}

// Finish & Evaluate Assessment
function finishAssessment() {
    clearInterval(timerInterval);
    clearInterval(emergencyCountdownInterval);
    if (emergencyBanner) emergencyBanner.style.display = 'none';
    
    showScreen('result');

    let correctCount = 0;
    let attemptedCount = 0;
    const answerKeyContainer = document.getElementById('answer-key-container');
    answerKeyContainer.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    questions.forEach((q, i) => {
        const userAns = userAnswers[i];
        if (userAns !== null) attemptedCount++;
        const isCorrect = userAns === q.correctAnswer;
        if (isCorrect) correctCount++;

        const item = document.createElement('div');
        item.className = `key-item ${isCorrect ? 'correct' : 'incorrect'}`;

        let optText = q.options[userAns] || "Not Answered";
        let correctOptText = q.options[q.correctAnswer] || "N/A";

        if (typeof optText === 'string' && optText.startsWith('IMAGE: ')) optText = "[Image Option]";
        if (typeof correctOptText === 'string' && correctOptText.startsWith('IMAGE: ')) correctOptText = "[Image Option]";

        let userAnsText = userAns !== null ? `${letters[userAns]}) ${optText}` : 'Not Answered';
        let correctAnsText = `${letters[q.correctAnswer]}) ${correctOptText}`;

        item.innerHTML = `
            <div class="key-question">Q${i + 1}: ${q.text}</div>
            <div class="key-answers">
                <div class="user-ans ${!isCorrect ? 'wrong' : ''}">
                    <strong>Your Answer:</strong> ${userAnsText}
                </div>
                ${!isCorrect ? `<div class="correct-ans"><strong>Correct Answer:</strong> ${correctAnsText}</div>` : ''}
            </div>
            ${q.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
        `;

        answerKeyContainer.appendChild(item);
    });

    const percentage = ((correctCount / questions.length) * 100).toFixed(1);
    const currentDate = new Date().toLocaleDateString();

    document.getElementById('res-name').textContent = studentInfo.name;
    document.getElementById('res-reg').textContent = studentInfo.reg;
    document.getElementById('res-class-sec').textContent = `${studentInfo.cls} - ${studentInfo.sec}`;
    document.getElementById('res-date').textContent = currentDate;
    document.getElementById('final-score').textContent = percentage;
    document.getElementById('attempted-count').textContent = attemptedCount;
    document.getElementById('total-questions-count').textContent = questions.length;

    document.querySelector('.score-circle').style.setProperty('--score-percent', percentage);

    document.getElementById('cert-name').textContent = studentInfo.name;
    document.getElementById('cert-reg').textContent = studentInfo.reg;
    document.getElementById('cert-class').textContent = `${studentInfo.cls} - ${studentInfo.sec}`;
    document.getElementById('cert-score').textContent = `${percentage}%`;
    document.getElementById('cert-date').textContent = currentDate;

    const payload = {
        testId: studentInfo.testId,
        date: currentDate,
        name: studentInfo.name,
        reg: studentInfo.reg,
        classSec: `${studentInfo.cls} - ${studentInfo.sec}`,
        score: percentage,
        attempted: attemptedCount,
        total: questions.length
    };

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("Result saved to Google Sheets successfully.");
    }).catch(err => {
        console.error("Could not reach Google Sheets:", err);
    });
}

// Download / Print Certificate (Native High-Quality PDF / Print)
function downloadCertificate() {
    const candidateName = studentInfo.name || 'Candidate';
    const regNo = studentInfo.reg || 'N/A';
    const classSec = `${studentInfo.cls || 'N/A'} - ${studentInfo.sec || 'N/A'}`;
    const scoreVal = document.getElementById('final-score').textContent || '0';
    const certDate = new Date().toLocaleDateString();

    const certHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>CLAD Certificate - ${candidateName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            @page {
                size: A4 landscape;
                margin: 8mm 10mm;
            }
            * { box-sizing: border-box; }
            html, body {
                margin: 0;
                padding: 15px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #ffffff;
                font-family: 'Plus Jakarta Sans', Arial, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .cert-container {
                width: 100%;
                max-width: 950px;
                background: #ffffff;
                border: 10px solid #0077c8;
                padding: 30px 35px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                margin: auto;
            }
            .cert-inner {
                border: 2px solid #bae6fd;
                padding: 25px 20px;
            }
            .brand-title {
                font-size: 34px;
                color: #0077c8;
                font-weight: 800;
                margin: 0 0 3px 0;
                letter-spacing: 1px;
                text-transform: uppercase;
            }
            .cert-subtitle {
                font-size: 19px;
                color: #1e293b;
                font-weight: 700;
                margin: 0 0 20px 0;
            }
            .presented-text {
                font-size: 14.5px;
                color: #64748b;
                margin: 0 0 5px 0;
            }
            .candidate-name {
                font-size: 32px;
                color: #0f172a;
                font-weight: 800;
                margin: 0 0 6px 0;
                border-bottom: 2px solid #e2e8f0;
                display: inline-block;
                padding-bottom: 3px;
            }
            .candidate-meta {
                font-size: 14px;
                color: #475569;
                margin: 0 0 16px 0;
            }
            .completion-text {
                font-size: 14.5px;
                color: #334155;
                margin: 0 0 14px 0;
                max-width: 650px;
                margin-left: auto;
                margin-right: auto;
            }
            .score-box {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 8px 30px;
                display: inline-block;
                margin-bottom: 16px;
            }
            .score-val {
                font-size: 42px;
                font-weight: 800;
                color: #0077c8;
                margin: 0;
                line-height: 1;
            }
            .cert-footer {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                padding-top: 12px;
                border-top: 1px solid #e2e8f0;
            }
            .footer-left { text-align: left; }
            .footer-right { text-align: right; }
            .footer-title {
                font-weight: 700;
                color: #0077c8;
                font-size: 13px;
                margin: 0 0 2px 0;
            }
            .footer-sub {
                margin: 0;
                font-size: 12px;
                color: #64748b;
            }
            @media print {
                html, body { height: 100%; width: 100%; padding: 0; background: #ffffff; }
                .cert-container { box-shadow: none; border-width: 8px; width: 100%; max-width: 100%; }
            }
        </style>
    </head>
    <body>
        <div class="cert-container">
            <div class="cert-inner">
                <div class="brand-title">National Instruments</div>
                <div class="cert-subtitle">Certificate of Assessment Completion</div>
                <div class="presented-text">This is proudly presented to</div>
                <div class="candidate-name">${candidateName}</div>
                <div class="candidate-meta">Register Number: <strong>${regNo}</strong> | Class: <strong>${classSec}</strong></div>
                <div class="completion-text">for successfully completing the <strong>Certified LabVIEW Associate Developer (CLAD)</strong> Examination with a proficiency score of:</div>
                <div class="score-box">
                    <div class="score-val">${scoreVal}%</div>
                </div>
                <div class="cert-footer">
                    <div class="footer-left">
                        <div class="footer-title">Assessment Date</div>
                        <div class="footer-sub">${certDate}</div>
                    </div>
                    <div class="footer-right">
                        <div class="footer-title">National Instruments</div>
                        <div class="footer-sub" style="font-style: italic;">CLAD Certification Engine</div>
                    </div>
                </div>
            </div>
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 300);
            };
        </script>
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(certHtml);
        printWindow.document.close();
    } else {
        window.print();
    }
}

// Start
window.addEventListener('DOMContentLoaded', initApp);
