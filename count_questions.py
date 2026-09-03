import json

# Count questions in questions.json
with open('questions.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total questions in questions.json: {len(data)}")

# Show first 3 to understand structure
for q in data[:3]:
    print(f"  ID: {q.get('id','?')} | Correct: {q.get('correctAnswer','?')} | Topic: {q.get('topic','?')[:50]}")

# Count unique sections/sources
sources = {}
for q in data:
    src = q.get('source', q.get('set', 'unknown'))
    sources[src] = sources.get(src, 0) + 1

print("\nQuestion sources/sets:")
for k, v in sources.items():
    print(f"  {k}: {v} questions")
