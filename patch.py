import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Add URL parsing and override duration logic
js = js.replace("let durationMins = parseInt(durationInput);", """const urlParams = new URLSearchParams(window.location.search);
            const scheduledTime = urlParams.get('time');
            let durationMins = scheduledTime ? parseInt(scheduledTime) : parseInt(durationInput);""")

# 2. Replace selectQuestions
new_select_questions = """function selectQuestions(allQuestions, testId) {
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
}"""

old_select_questions = re.search(r'function selectQuestions\(allQuestions, testId\) \{.*?\n\}', js, re.DOTALL)
if old_select_questions:
    js = js.replace(old_select_questions.group(0), new_select_questions)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("app.js patched successfully.")
