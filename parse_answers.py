import json
import re

def parse_answers():
    with open('extracted_answers.txt', 'r', encoding='utf-8') as f:
        text = f.read()

    # Find all occurrences of Q<number> followed by a newline and then a single letter a/b/c/d/e
    # Sometimes it's Q#, then OPTION, then TECHNICAL EXPLANATION.
    
    lines = text.split('\n')
    answers = []
    
    for i in range(len(lines)):
        line = lines[i].strip()
        if re.match(r'^Q\d+$', line):
            # The next non-empty line should be the option
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                opt = lines[j].strip().upper()
                # Check if it's a valid option (A, B, C, D, E, or multiple like 'A, B' or 'A, C')
                if re.match(r'^[A-F](,\s*[A-F])*$', opt) or re.match(r'^[A-F]$', opt):
                    answers.append((line, opt))
                elif opt == "OPTION" or "TECHNICAL" in opt:
                    # sometimes the header gets repeated
                    k = j + 1
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if k < len(lines):
                        opt2 = lines[k].strip().upper()
                        if re.match(r'^[A-F](,\s*[A-F])*$', opt2) or re.match(r'^[A-F]$', opt2):
                            answers.append((line, opt2))
    
    print(f"Found {len(answers)} answers.")
    print("First 20:", answers[:20])
    print("Last 20:", answers[-20:])

if __name__ == "__main__":
    parse_answers()
