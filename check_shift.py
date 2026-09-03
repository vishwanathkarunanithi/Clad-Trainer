import json

with open('questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for q in data[16:20]:
    print("Q" + str(q["id"]) + ": " + q["text"][:60])
    print("EXP: " + q.get("explanation", "")[:80])
    print("-" * 40)
