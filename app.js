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
    startTime: 0 // 0 means immediately available
};

const MARKS_PER_QUESTION = 2.5;
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzH6LhVuapl_6w602GozE1zzwrzx9ZDH_jO_OAcfOWJ3yQgtAzzjR94uuCkqAK4NkuT/exec';

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
        // Add padding if missing
        while (clean.length % 4 !== 0) clean += '=';
        const parsed = JSON.parse(atob(clean));
        return {
            testId: parsed.t || "All",
            duration: parseInt(parsed.d) || 60,
            startTime: parsed.s || 0
        };
    } catch (e) {
        // Fallback for simple raw test name
        return {
            testId: codeStr.trim(),
            duration: 60,
            startTime: 0
        };
    }
}

// Question Selector: Enforces Syllabus Weightage, Max 10 Theory, Mixed Shuffling
function selectQuestions(allQs, testConfig) {
    let pool = shuffleArray([...allQs]);
    
    // Group all questions into Theory and Practical (Diagram)
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
    const MAX_THEORY = 10; // Rule: Maximum 10 theory questions in the test

    // Select according to syllabus weightage
    for (const [topic, count] of Object.entries(syllabusWeightage)) {
        let topicSelected = [];
        let tPool = groupedTheory[topic] || [];
        let pPool = groupedPractical[topic] || [];
        
        // Target max ~25% theory per topic
        let targetTheory = Math.floor(count * 0.25);
        if (targetTheory === 0 && Math.random() < 0.25) targetTheory = 1;
        
        let actualTheory = 0;
        while (actualTheory < targetTheory && tPool.length > 0 && totalTheoryCount < MAX_THEORY) {
            topicSelected.push(tPool.shift());
            actualTheory++;
            totalTheoryCount++;
        }
        
        // Fill remaining with practical
        let remainingForTopic = count - actualTheory;
        while (remainingForTopic > 0 && pPool.length > 0) {
            topicSelected.push(pPool.shift());
            remainingForTopic--;
        }
        
        // Backfill with theory if practical runs short
        while (remainingForTopic > 0 && tPool.length > 0 && totalTheoryCount < MAX_THEORY) {
            topicSelected.push(tPool.shift());
            totalTheoryCount++;
            remainingForTopic--;
        }
        
        // Absolute fallback to complete topic quota
        while (remainingForTopic > 0 && tPool.length > 0) {
            topicSelected.push(tPool.shift());
            totalTheoryCount++;
            remainingForTopic--;
        }
        
        selected = selected.concat(topicSelected);
    }

    // If total selected < 40, backfill with remaining
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

    // Final Thorough Global Shuffle so theory and topics are seamlessly mixed
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

    // Setup Admin Test Selector options (Mock Test 1 to 25)
    const adminTestSelect = document.getElementById('admin-test-select');
    if (adminTestSelect) {
        for (let i = 1; i <= 25; i++) {
            const opt = document.createElement('option');
            opt.value = `Mock Test ${i}`;
            opt.textContent = `Mock Test ${i}`;
            adminTestSelect.appendChild(opt);
        }
    }

    // Setup Default Start Time in Admin to now + 5 minutes
    const adminStartTimeInput = document.getElementById('admin-start-time');
    if (adminStartTimeInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        now.setSeconds(0);
        now.setMilliseconds(0);
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
        // If code field is empty, provide default practice code
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

    // Admin Code Generation
    document.getElementById('admin-generate-code-btn').addEventListener('click', () => {
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
}

// Validate Test Code & Check Time-Lock
function validateAndApplyTestCode(codeStr) {
    const banner = document.getElementById('test-status-banner');
    const regForm = document.getElementById('student-reg-form');
    
    const config = decodeTestCode(codeStr);
    if (!config) {
        banner.className = 'status-badge badge-locked';
        banner.innerHTML = '❌ Invalid Test Code. Please verify with your instructor.';
        banner.style.display = 'block';
        regForm.style.display = 'none';
        return;
    }

    activeTestConfig = config;
    const now = Date.now();
    const scheduledTime = config.startTime;

    // Time-Lock Check: Has activation time arrived?
    if (scheduledTime && now < scheduledTime) {
        const unlockDate = new Date(scheduledTime);
        const formattedTime = unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedDate = unlockDate.toLocaleDateString();

        banner.className = 'status-badge badge-locked';
        banner.innerHTML = `🔒 <strong>Test Locked!</strong><br>This assessment is scheduled to open on <strong>${formattedDate} at ${formattedTime}</strong>.<br><small>Please return at or after that time to begin.</small>`;
        banner.style.display = 'block';
        regForm.style.display = 'none';
    } else {
        // Unlocked & Active!
        banner.className = 'status-badge badge-active';
        banner.innerHTML = `✅ <strong>Assessment Unlocked: ${config.testId}</strong><br>Duration: <strong>${config.duration} Minutes</strong>. Fill your details below to start.`;
        banner.style.display = 'block';
        regForm.style.display = 'block';
    }
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

    // Populate footer candidate info
    document.getElementById('footer-name').textContent = studentInfo.name;
    document.getElementById('footer-reg').textContent = studentInfo.reg;
    document.getElementById('test-active-title').textContent = `CLAD Assessment - ${studentInfo.testId}`;

    // Select questions
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
        timerDisplay.style.color = 'var(--danger-color)';
        timerDisplay.style.background = '#fef2f2';
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

    // Handle Diagrams
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

    // Render Options
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

    // Navigation buttons state
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questions.length - 1;
}

// Finish & Evaluate Assessment
function finishAssessment() {
    clearInterval(timerInterval);
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

    // Populate Results View
    document.getElementById('res-name').textContent = studentInfo.name;
    document.getElementById('res-reg').textContent = studentInfo.reg;
    document.getElementById('res-class-sec').textContent = `${studentInfo.cls} - ${studentInfo.sec}`;
    document.getElementById('res-date').textContent = currentDate;
    document.getElementById('final-score').textContent = percentage;
    document.getElementById('attempted-count').textContent = attemptedCount;
    document.getElementById('total-questions-count').textContent = questions.length;

    // Visual circular progress
    document.querySelector('.score-circle').style.setProperty('--score-percent', percentage);

    // Populate Hidden Certificate Template
    document.getElementById('cert-name').textContent = studentInfo.name;
    document.getElementById('cert-reg').textContent = studentInfo.reg;
    document.getElementById('cert-class').textContent = `${studentInfo.cls} - ${studentInfo.sec}`;
    document.getElementById('cert-score').textContent = `${percentage}%`;
    document.getElementById('cert-date').textContent = currentDate;

    // Submit to Google Sheets
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

// Download Certificate PDF
function downloadCertificate() {
    const element = document.getElementById('certificate-template');
    const btn = document.getElementById('download-cert-btn');
    const originalText = btn.textContent;
    btn.textContent = "Generating PDF...";
    btn.disabled = true;

    const opt = {
        margin: 0,
        filename: `${studentInfo.name || 'Candidate'}_CLAD_Certificate.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    if (window.html2pdf) {
        html2pdf().set(opt).from(element).save().then(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }).catch(err => {
            console.error("Certificate error:", err);
            btn.textContent = "Download Failed";
            btn.disabled = false;
        });
    } else {
        alert("PDF generator is still loading. Please try again in a few seconds.");
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Start
window.addEventListener('DOMContentLoaded', initApp);
