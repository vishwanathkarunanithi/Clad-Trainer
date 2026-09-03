import json

with open('questions.json', 'r', encoding='utf-8') as f:
    qs = json.load(f)

print("=== Searching for 'Which of the following statement is TRUE' ===")
for i, q in enumerate(qs):
    t = q.get('text', '').lower()
    if 'which of the following statement is true' in t or ('multiply' in t and 'dbl' in t) or 'broken run arrow' in t:
        print(f"\nQ{i+1} (ID={q['id']}): correctAnswer={q['correctAnswer']}")
        print(f"  TEXT: {q['text'][:150]}")
        for j, opt in enumerate(q.get('options', [])):
            marker = " <-- CORRECT" if j == q['correctAnswer'] else ""
            print(f"  {['A','B','C','D','E'][j]}: {str(opt)[:100]}{marker}")
        print(f"  EXPLANATION: {q.get('explanation','')[:120]}")

print("\n\n=== Searching for 'numeric and numeric 2' / 'a) c)' ===")
for i, q in enumerate(qs):
    t = q.get('text', '')
    if 'numeric 2' in t.lower() and ('a) c)' in t.lower() or 'a) b)' in t.lower() or 'a) d)' in t.lower()):
        print(f"\nQ{i+1} (ID={q['id']}): correctAnswer={q['correctAnswer']}")
        print(f"  TEXT: {t[:200]}")
        for j, opt in enumerate(q.get('options', [])):
            marker = " <-- CORRECT" if j == q['correctAnswer'] else ""
            print(f"  {['A','B','C','D','E'][j]}: {str(opt)[:100]}{marker}")
        print(f"  EXPLANATION: {q.get('explanation','')[:120]}")
