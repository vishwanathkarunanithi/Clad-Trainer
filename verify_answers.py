"""
Map the flat answer list from the PDF (378 answers across sections)
to sequential question IDs in questions.json (226 questions from Combined PDF).

The answer key covers the Combined PDF pages 1-298. 
The answer key section boundaries tell us how many questions per source PDF section.

Section 1: Q1-Q40 = 40 answers (Pages 1-15)
Section 2: Q1-Q20 = 20 answers (Pages 16-23)  
Section 3: Q1-Q34 = 34 answers (Pages 24-43) -- the PDF has 40 total split across subsections
Section 4: Q1-Q40 = 40 answers (Pages 44-65)
Section 5: Q1-Q40 = 40 answers (Pages 66-79)
Section 6: Q1-Q40 = 40 answers (Pages 80-173)
Section 7: Q1-Q48 = 48 answers (Pages 174-191)
Section 8: Q1-Q35 = 35 answers (Pages 192-222)
Section 9: Q1-Q35 = 35 answers (Pages 223-247)
Section 10: Q1-Q40 = 40 answers (Pages 248-280)
Section 11: Pages 281-298 -- advanced (page-based IDs, skip)

The answer key file has 378 parsed answers total.
The questions.json has 226 questions total (IDs 1-226).

Let's parse all Q# answers in sequential order and map them 1:1 with questions.json.
"""

import json
import re

# Parse all answers from text file in order
with open('extracted_answers.txt', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')

# Collect all Q#:answer pairs in document order (not resetting per section)
# But we need to track section boundaries to handle Q numbering resets

# Strategy: parse ALL Q<number> + answer pairs, tracking their section
# then accumulate them into a flat sequential list matching questions.json

def letter_to_index(letter):
    """Convert A->0, B->1, C->2, D->3, E->4"""
    mapping = {'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5}
    return mapping.get(letter.upper(), -1)

# Parse per-section answers
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
    
    if re.match(r'^Q\d+$', line):
        q_num = int(line[1:])
        # Look ahead for the option
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines):
            opt = lines[j].strip().upper()
            if re.match(r'^[A-F](,\s*[A-F])*$', opt):
                # Valid single or multi answer
                first_letter = opt.split(',')[0].strip()
                idx = letter_to_index(first_letter)
                if current_section > 0:
                    section_answers[current_section].append((q_num, first_letter, idx))
    i += 1

print("=== ANSWER KEY SECTION BREAKDOWN ===")
for sec, answers in section_answers.items():
    if answers:
        q_nums = [a[0] for a in answers]
        print(f"Section {sec}: {len(answers)} answers, Q{min(q_nums)} to Q{max(q_nums)}")

# Build flat sequential answer list
# Based on the extracted sections:
# Sections 1-11 from the answer key correspond to source PDFs in the Combined PDF
# The questions in questions.json are ordered by their source PDF (CLAD1, CLAD2, ... CLAD14)
# For each section, we add answers in Q-number order

flat_answers = []
for sec in sorted(section_answers.keys()):
    if sec == 11:  # Advanced section has page-based IDs, skip
        print(f"  Skipping Section 11 (Advanced page-based questions)")
        continue
    answers = sorted(section_answers[sec], key=lambda x: x[0])  # sort by Q number
    flat_answers.extend(answers)
    
print(f"\nTotal flat answers (excluding Section 11): {len(flat_answers)}")

# Load questions.json
with open('questions.json', 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f"Total questions in questions.json: {len(questions)}")

# Compare - show mismatches
mismatches = []
matches = 0
for i, (q_entry, (q_num, letter, pdf_answer_idx)) in enumerate(zip(questions, flat_answers)):
    current_answer = q_entry.get('correctAnswer', -1)
    if current_answer != pdf_answer_idx:
        mismatches.append({
            'seq': i+1,
            'q_id': q_entry.get('id'),
            'q_num_in_section': q_num,
            'current': current_answer,
            'current_letter': ['A','B','C','D','E','F'][current_answer] if 0 <= current_answer < 6 else '?',
            'pdf_answer': pdf_answer_idx,
            'pdf_letter': letter,
            'text': q_entry.get('text','')[:80]
        })
    else:
        matches += 1

print(f"\n=== VERIFICATION RESULTS ===")
print(f"Questions compared: {min(len(questions), len(flat_answers))}")
print(f"Matches: {matches}")
print(f"Mismatches: {len(mismatches)}")

if mismatches:
    print(f"\nFirst 20 mismatches:")
    for m in mismatches[:20]:
        print(f"  Q{m['seq']} (ID={m['q_id']}): current={m['current_letter']}({m['current']}), PDF={m['pdf_letter']}({m['pdf_answer']}) | {m['text']}")
