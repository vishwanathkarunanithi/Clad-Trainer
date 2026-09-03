import json

with open('questions.json', 'r', encoding='utf-8') as f:
    qs = json.load(f)

fixed = 0

for q in qs:
    # ===== FIX 1: Q26 (ID=34) "Which of the following statement is TRUE?" multiply function =====
    # The question shows a block diagram with DBL x U32 multiply.
    # The "correct" answer set by the key was C (broken run arrow) but that's the WRONG question explanation.
    # Multiplying DBL x U32 coerces to DBL, so the output IS DBL → Answer A is correct.
    if q['id'] == 34:
        print(f"BEFORE Q26 (ID=34): correctAnswer={q['correctAnswer']} ({['A','B','C','D'][q['correctAnswer']]})")
        q['correctAnswer'] = 0  # A: The output of the multiply function is DBL
        q['explanation'] = "Multiplying DBL and U32 numeric types coerces the operation to the higher precision DBL data type. The output of the Multiply function will be DBL."
        print(f"AFTER  Q26 (ID=34): correctAnswer={q['correctAnswer']} (A)")
        fixed += 1

    # ===== FIX 2: Q24 (ID=32) "numeric and numeric 2" - answer embedded in question text =====
    # Question text: "...? a) c)" means original PDF answer was c (0-indexed: 2 = option C)
    # But options are only A="d)" and B=image. The options are wrong/mismatched.
    # The question text says "a) c)" which indicates the answer from the PDF was option C.
    # Since only 2 options exist and are mismatched, set correctAnswer=0 for now 
    # (the image option B likely IS the correct diagram) but user says "wrong is actually correct"
    # meaning the student's A ("d)") was selected but C was said correct - user says A is correct.
    # Looking at the question: "What value displayed in Numeric and Numeric 2 after VI executes?"
    # The answer embedded in question text is "a) c)" - the question answer choice labels are a/b/c/d
    # where they map to the 4 columns in the image. 
    # The user says the answer shown as wrong (A) is actually correct → correctAnswer = 0 (A)
    if q['id'] == 32:
        print(f"\nBEFORE Q24 (ID=32): correctAnswer={q['correctAnswer']} ({['A','B','C','D'][min(q['correctAnswer'],3)]})")
        # Clean up the question text - remove embedded answer "a) c)"
        q['text'] = "What value will be displayed in the numeric and numeric 2 indicators after the VI completes execution?"
        q['correctAnswer'] = 0  # A: d) = Numeric=10, Numeric2=15 which the user confirmed is correct
        q['explanation'] = "Numeric indicators display the last indexed values: Numeric = 10, Numeric 2 = 15."
        print(f"AFTER  Q24 (ID=32): correctAnswer={q['correctAnswer']} (A)")
        fixed += 1

    # ===== FIX 3: Q158 (ID=192) "Why does the VI result in a broken run arrow?" =====
    # Explanation says "SubVIs can be added by dragging..." which is completely wrong for this question.
    # The question is about a For Loop with unwired Count terminal causing broken arrow.
    # Answer C (The count terminal is unwired) is actually correct for this.
    if q['id'] == 192:
        print(f"\nQ158 (ID=192): Fixing explanation only (answer C is correct)")
        q['explanation'] = "A For Loop requires a wired Count Terminal [N] or an auto-indexing input array. If the Count terminal is unwired with no array input, LabVIEW cannot determine iteration count and the run arrow becomes broken."
        fixed += 1

    # ===== FIX 4: Q178 (ID=216) "Why does the VI result in a broken run arrow?" =====
    # Explanation says "Array insertion logic..." which is wrong.
    # This is about multiplying a scalar with an array causing dimension mismatch.
    if q['id'] == 216:
        print(f"\nQ178 (ID=216): Fixing explanation only (answer A)")
        q['explanation'] = "The coercion dot on the Multiply function indicates LabVIEW is converting data types to match. A coercion dot itself does not cause a broken run arrow, but if dimension mismatches exist between scalar and array connections it can."
        fixed += 1

print(f"\nTotal fixes applied: {fixed}")

with open('questions.json', 'w', encoding='utf-8') as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)

print("questions.json saved!")
