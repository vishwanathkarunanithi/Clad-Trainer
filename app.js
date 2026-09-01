let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let timerInterval;
let timeRemaining = 3600; // 1 hour in seconds
const MARKS_PER_QUESTION = 2.5;
let studentInfo = {};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const restartBtn = document.getElementById('restart-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress');
const qNumber = document.getElementById('q-number');
const qText = document.getElementById('q-text');
const qImageContainer = document.getElementById('q-image-container');
const qImage = document.getElementById('q-image');
const optionsContainer = document.getElementById('options');
const qProgressFooter = document.getElementById('q-progress-footer');
const closeAssessmentBtn = document.getElementById('close-assessment-btn');

// Initialize App
async function init() {
    try {
        const response = await fetch('questions.json');
        const allQuestions = await response.json();
        
        // Populate test selector
        const testSelector = document.getElementById('test-selector');
        for (let i = 1; i <= 25; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Mock Test ${i}`;
            testSelector.appendChild(opt);
        }
        
        startBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('student-name').value.trim();
            const regInput = document.getElementById('register-number').value.trim();
            const classInput = document.getElementById('student-class').value.trim();
            const secInput = document.getElementById('student-section').value.trim();
            const durationInput = document.getElementById('test-duration').value;

            if (!nameInput || !regInput || !classInput || !secInput) {
                alert("Please fill out all registration fields before starting.");
                return;
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const scheduledTime = urlParams.get('time');
            let durationMins = scheduledTime ? parseInt(scheduledTime) : parseInt(durationInput);
            if (isNaN(durationMins) || durationMins < 5) durationMins = 60;

            studentInfo = {
                name: nameInput,
                reg: regInput,
                cls: classInput,
                sec: secInput,
                duration: durationMins * 60
            };
            
            // Set footer fields
            document.getElementById('footer-name').textContent = studentInfo.name;
            document.getElementById('footer-reg').textContent = studentInfo.reg;

            const testId = parseInt(testSelector.value);
            startTest(allQuestions, testId);
        });
        
        submitBtn.addEventListener('click', submitTest);
        if (closeAssessmentBtn) closeAssessmentBtn.addEventListener('click', submitTest);
        restartBtn.addEventListener('click', resetTest);
        prevBtn.addEventListener('click', () => navigate(-1));
        nextBtn.addEventListener('click', () => navigate(1));
    } catch (error) {
        console.error('Failed to load questions:', error);
        qText.textContent = "Error loading questions. Ensure questions.json exists.";
    }
}

// Utility: Shuffle Array
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

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

// Select questions based on weightage
function selectQuestions(allQuestions, testId) {
    let selected = [];
    let pool = shuffleArray([...allQuestions]);
    
    let groupedTheory = {};
    let groupedPractical = {};
    
    pool.forEach(q => {
        let t = q.topic || "General";
        let isTheory = !q.image || q.image.length === 0;
        if (isTheory) {
            if (!groupedTheory[t]) groupedTheory[t] = [];
            groupedTheory[t].push(q);
        } else {
            if (!groupedPractical[t]) groupedPractical[t] = [];
            groupedPractical[t].push(q);
        }
    });

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
        let remainingP = Object.values(groupedPractical).flat();
        let remainingT = Object.values(groupedTheory).flat();
        
        while (missing > 0 && remainingP.length > 0) {
            selected.push(remainingP.shift());
            missing--;
        }
        while (missing > 0 && remainingT.length > 0) {
            selected.push(remainingT.shift());
            missing--;
        }
    }
    
    return shuffleArray(selected).slice(0, 40);
}

// Start Test
function startTest(allQuestions, testId) {
    questions = selectQuestions(allQuestions, testId);
    userAnswers = new Array(questions.length).fill(null);
    currentQuestionIndex = 0;
    timeRemaining = studentInfo.duration || 3600;
    
    startScreen.classList.remove('active');
    testScreen.classList.add('active');
    
    startTimer();
    renderQuestion();
}

// Timer Logic
function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitTest();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const h = Math.floor(timeRemaining / 3600).toString().padStart(2, '0');
    const m = Math.floor((timeRemaining % 3600) / 60).toString().padStart(2, '0');
    const s = (timeRemaining % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${h}:${m}:${s}`;
    
    if (timeRemaining < 300) { // Less than 5 mins
        timerDisplay.style.color = 'var(--danger-color)';
        timerDisplay.style.background = 'rgba(239, 68, 68, 0.2)';
    }
}

// Navigation
function navigate(direction) {
    currentQuestionIndex += direction;
    renderQuestion();
}

// Render Current Question
function renderQuestion() {
    const q = questions[currentQuestionIndex];
    
    // Update Header & Progress
    qNumber.textContent = `Question #${currentQuestionIndex + 1}`;
    qProgressFooter.textContent = `${currentQuestionIndex + 1} / ${questions.length}`;
    
    // Update Content
    qText.textContent = q.text;
    
    qImageContainer.innerHTML = ''; // clear previous images
    if (q.image && Array.isArray(q.image) && q.image.length > 0) {
        q.image.forEach(imgSrc => {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = 'Question Image';
            img.style.maxWidth = '100%';
            img.style.borderRadius = '4px';
            img.style.marginBottom = '10px';
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
        if (opt.startsWith('IMAGE: ')) {
            const imgSrc = opt.replace('IMAGE: ', '');
            optContent = `<img src="${imgSrc}" alt="Option Image" style="max-height: 150px; border-radius: 4px;">`;
        }
        
        optionDiv.innerHTML = `
            <div class="option-letter">${letters[idx]}</div>
            <div class="option-text">${optContent}</div>
        `;
        optionDiv.addEventListener('click', () => selectOption(idx));
        optionsContainer.appendChild(optionDiv);
    });
    
    // Update Buttons
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questions.length - 1;
}

// Select Option
function selectOption(index) {
    userAnswers[currentQuestionIndex] = index;
    renderQuestion();
}

// Submit Test
function submitTest() {
    clearInterval(timerInterval);
    
    testScreen.classList.remove('active');
    resultScreen.classList.add('active');
    
    calculateAndRenderResults();
}

// Calculate Score and Render Answer Key
function calculateAndRenderResults() {
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
        
        // Generate Answer Key Item
        const item = document.createElement('div');
        item.className = `key-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        let optText = q.options[userAns];
        if (optText && optText.startsWith('IMAGE: ')) optText = "[Image Option]";
        let correctOptText = q.options[q.correctAnswer] || "[No Option]";
        if (correctOptText.startsWith('IMAGE: ')) correctOptText = "[Image Option]";

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
    
    const finalScore = correctCount * MARKS_PER_QUESTION;
    const maxScore = questions.length * MARKS_PER_QUESTION;
    const percentage = ((correctCount / questions.length) * 100).toFixed(1);
    
    // Set Student Details
    document.getElementById('res-name').textContent = studentInfo.name || "N/A";
    document.getElementById('res-reg').textContent = studentInfo.reg || "N/A";
    document.getElementById('res-class-sec').textContent = `${studentInfo.cls || "N/A"} - ${studentInfo.sec || "N/A"}`;
    
    document.getElementById('final-score').textContent = `${percentage}`;
    document.getElementById('attempted-count').textContent = attemptedCount;
    
    // Update Score Circle Percentage for visual effect
    document.querySelector('.score-circle').style.setProperty('--score-percent', percentage);
    
    // Setup Certificate Data
    document.getElementById('cert-name').textContent = studentInfo.name || "N/A";
    document.getElementById('cert-reg').textContent = studentInfo.reg || "N/A";
    document.getElementById('cert-class').textContent = `${studentInfo.cls || "N/A"} - ${studentInfo.sec || "N/A"}`;
    document.getElementById('cert-score').textContent = `${percentage}%`;
    document.getElementById('cert-attempted').textContent = attemptedCount;
    document.getElementById('cert-total').textContent = questions.length;
    
    const currentDate = new Date().toLocaleDateString();
    document.getElementById('cert-date').textContent = currentDate;
    
    // Send Data to Backend Excel Server
    const testId = document.getElementById('test-selector').value;
    const resultData = {
        testId: testId,
        date: currentDate,
        name: studentInfo.name || "N/A",
        reg: studentInfo.reg || "N/A",
        classSec: `${studentInfo.cls || "N/A"} - ${studentInfo.sec || "N/A"}`,
        score: percentage,
        attempted: attemptedCount,
        total: questions.length
    };
    
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzH6LhVuapl_6w602GozE1zzwrzx9ZDH_jO_OAcfOWJ3yQgtAzzjR94uuCkqAK4NkuT/exec';
    
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(resultData)
    }).then(res => {
        console.log("Successfully sent result to Google Sheets!");
    }).catch(err => {
        console.error("Could not reach Google Sheets to save data:", err);
    });
}

document.getElementById('download-cert-btn').addEventListener('click', () => {
    const element = document.getElementById('certificate-template');
    const originalText = document.getElementById('download-cert-btn').textContent;
    document.getElementById('download-cert-btn').textContent = "Downloading...";
    document.getElementById('download-cert-btn').disabled = true;
    
    const opt = {
        margin:       0,
        filename:     `${studentInfo.name || 'Student'}_CLAD_Mock_Certificate.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        document.getElementById('download-cert-btn').textContent = originalText;
        document.getElementById('download-cert-btn').disabled = false;
    }).catch(err => {
        console.error("Certificate generation failed: ", err);
        document.getElementById('download-cert-btn').textContent = "Download Failed";
        document.getElementById('download-cert-btn').disabled = false;
    });
});

// Reset Test
function resetTest() {
    timeRemaining = 3600;
    currentQuestionIndex = 0;
    questions = shuffleArray(questions);
    userAnswers = new Array(questions.length).fill(null);
    
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
    
    timerDisplay.style.color = '';
    timerDisplay.style.background = 'rgba(239, 68, 68, 0.1)';
    document.getElementById('timer').textContent = "01:00:00";
}

// Boot App
window.addEventListener('DOMContentLoaded', init);
