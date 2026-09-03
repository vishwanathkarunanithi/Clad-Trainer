"""
Comprehensive analysis: how many questions in questions.json have the correct answer set
vs what we can derive from the answer key.

The answer key has 378 answer entries for sections 1-11 covering the Combined PDF.
The questions.json has 226 questions scraped from the PDFs.

We'll map answers from the PDF sections to questions in questions.json.
The answer key sections are:
  Section 1:  Q1-Q40  (Pages 1-15,  CLAD Practice Set 1)
  Section 2:  Q1-Q20  (Pages 16-23, CLAD Core Fundamentals) -- continues as Q21-Q40 in Section 1
  Section 3:  Q1-Q20  (Pages 24-43, CLAD Mock Test) + Q1-Q34 (continues)
  etc.

The sections reset Q numbering, so we need to count per-section.
Let's just count what the answer key covers per section and compare to questions.json.
"""
import json

with open('extracted_answers.txt', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Extract per-section analysis
sections = re.split(r'SECTION \d+:', text)
print(f"Number of sections in answer key: {len(sections)-1}")

# Count Q per section
for i, sec in enumerate(sections[1:], 1):
    header_line = sec.split('\n')[0].strip()
    qs = re.findall(r'^Q(\d+)\s*$', sec, re.MULTILINE)
    print(f"Section {i} ({header_line[:60]}...): {len(qs)} answers, max Q = {max(int(q) for q in qs) if qs else 0}")

# Load questions.json
with open('questions.json', 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f"\n--- questions.json stats ---")
print(f"Total: {len(questions)}")

# Check how many currently have correctAnswer set (non-null)
with_answer = [q for q in questions if q.get('correctAnswer') is not None and q.get('correctAnswer') >= 0]
without_answer = [q for q in questions if q.get('correctAnswer') is None or q.get('correctAnswer') < 0]
print(f"With valid correctAnswer: {len(with_answer)}")
print(f"Without correctAnswer: {len(without_answer)}")
