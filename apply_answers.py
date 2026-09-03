"""
Apply corrected answers from the answer key PDF to questions.json.
The mapping is sequential: the Nth answer in the flat list = the Nth question in questions.json.

The answer key covers the Combined PDF in order, and questions.json was scraped from the same Combined PDF.
We update correctAnswer and also update explanation where available.
"""

import json
import re

# Parse all answers + explanations from text file in document order
with open('extracted_answers.txt', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')

def letter_to_index(letter):
    mapping = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5}
    return mapping.get(letter.upper(), -1)

# Parse per-section answers with explanations
section_answers = {}
current_section = 0
i = 0
while i < len(lines):
    line = lines[i].strip()
    if re.match(r'^SECTION \d+:', line):
        current_section += 1
        section_answers[current_section] = []
        i += 1
        continue
    
    if re.match(r'^Q\d+$', line) and current_section > 0:
        q_num = int(line[1:])
        # Look ahead for the option (skip blank lines)
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines):
            opt = lines[j].strip().upper()
            if re.match(r'^[A-F](,\s*[A-F])*$', opt):
                first_letter = opt.split(',')[0].strip()
                idx = letter_to_index(first_letter)
                # Collect explanation (lines after option until next Q or section)
                exp_lines = []
                k = j + 1
                while k < len(lines):
                    exp_line = lines[k].strip()
                    if re.match(r'^Q\d+$', exp_line) or re.match(r'^SECTION \d+:', exp_line) or re.match(r'^Q#$', exp_line) or re.match(r'^OPTION$', exp_line):
                        break
                    if exp_line and not exp_line.startswith('LabVIEW CLAD Master') and not re.match(r'^Page \d+ of \d+$', exp_line):
                        exp_lines.append(exp_line)
                    k += 1
                explanation = ' '.join(exp_lines).strip()
                section_answers[current_section].append((q_num, first_letter, idx, explanation))
    i += 1

# Build flat sequential list (excluding section 11 - page-based)
flat_answers = []
for sec in sorted(section_answers.keys()):
    if sec == 11:
        continue
    answers = sorted(section_answers[sec], key=lambda x: x[0])
    flat_answers.extend(answers)

print(f"Total flat answers to apply: {len(flat_answers)}")

# Load questions.json
with open('questions.json', 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f"Total questions: {len(questions)}")

# Apply corrections
updated = 0
for i, q in enumerate(questions):
    if i < len(flat_answers):
        q_num, letter, answer_idx, explanation = flat_answers[i]
        old_answer = q.get('correctAnswer', -1)
        if answer_idx >= 0:
            q['correctAnswer'] = answer_idx
            if explanation:
                q['explanation'] = explanation
            if old_answer != answer_idx:
                updated += 1

print(f"Updated {updated} questions with corrected answers")
print(f"Questions not covered by answer key: {max(0, len(questions) - len(flat_answers))}")

# Save updated questions.json
with open('questions.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print("questions.json saved successfully!")

# Show sample of updated questions
print("\nSample of updated answers (first 10):")
for i, q in enumerate(questions[:10]):
    ans = q.get('correctAnswer', -1)
    letter = ['A','B','C','D','E','F'][ans] if 0 <= ans < 6 else '?'
    print(f"  Q{i+1}: correct={letter} | {q.get('text','')[:70]}")
