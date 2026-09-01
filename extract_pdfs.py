import os
import fitz  # PyMuPDF
import json
import re
import random

TOPICS = [
    "LabVIEW Programming Principles", "LabVIEW Environment", "Data Types", 
    "Arrays and Clusters", "Error Handling", "Documentation", "Debugging", 
    "Loops", "Case Structures", "Sequence Structures", "Event Structures", 
    "File I/O", "Timing", "VI Server", "Synchronization and Communication", 
    "Design Patterns", "Charts and Graphs", "Mechanical Actions of Booleans", 
    "Property Nodes", "Local Variables", "Functional Global Variables"
]

def extract_from_pdf(pdf_path, output_images_dir, start_id):
    # Skip Study Guides to avoid extracting syllabus outlines as questions
    base_name = os.path.basename(pdf_path).split('.')[0]
    if "guide" in base_name.lower():
        print(f"Skipping Study Guide: {base_name}")
        return [], start_id

    doc = fitz.open(pdf_path)
    
    questions = []
    current_q = None
    parsing_options = False
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Get dictionary of blocks
        page_dict = page.get_text("dict")
        blocks = page_dict.get("blocks", [])
        
        # Sort blocks top-to-bottom, left-to-right to maintain reading order
        blocks.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))
        
        for b in blocks:
            if b['type'] == 0:  # Text block
                for l in b["lines"]:
                    text = ""
                    for s in l["spans"]:
                        text += s["text"] + " "
                    text = text.strip()
                    if not text: continue
                    
                    # Check for start of a question (e.g. 1. or 28) )
                    q_match = re.match(r'^(\d+)[\.\)]\s*(.*)', text)
                    
                    if q_match:
                        if current_q and len(current_q["options"]) >= 2:
                            questions.append(current_q)
                        q_text = q_match.group(2)
                        current_q = {
                            "id": start_id,
                            "topic": random.choice(TOPICS),
                            "text": q_text,
                            "image": [],
                            "options": [],
                            "correctAnswer": 0,
                            "explanation": ""
                        }
                        start_id += 1
                        parsing_options = False
                        text_to_process = q_text
                    else:
                        text_to_process = text
                    
                    if current_q:
                        # Look for option markers " a) ", " b. ", etc. (up to f)
                        opt_pattern = r'(?i)(?:^|\s+)([a-f][\.\)])\s+'
                        parts = re.split(opt_pattern, text_to_process)
                        
                        if len(parts) > 1:
                            # Found options in this line!
                            if q_match:
                                current_q["text"] = parts[0].strip()
                            elif not parsing_options and parts[0].strip():
                                current_q["text"] += " " + parts[0].strip()
                            elif parsing_options and parts[0].strip() and len(current_q["options"]) > 0:
                                current_q["options"][-1] += " " + parts[0].strip()
                                
                            # Add the options
                            for i in range(1, len(parts), 2):
                                opt_text = parts[i+1].strip()
                                current_q["options"].append(opt_text)
                                parsing_options = True
                        else:
                            # No option markers in this line
                            if q_match:
                                pass # Handled above
                            elif parsing_options and len(current_q["options"]) > 0:
                                current_q["options"][-1] += " " + text
                            else:
                                current_q["text"] += " " + text
                        
            elif b['type'] == 1:  # Image block
                if current_q:
                    img_bytes = b["image"]
                    img_ext = b["ext"]
                    # Generate a unique filename
                    img_filename = f"{base_name}_p{page_num}_q{current_q['id']}_{random.randint(1000,9999)}.{img_ext}"
                    img_filepath = os.path.join(output_images_dir, img_filename)
                    with open(img_filepath, "wb") as f:
                        f.write(img_bytes)
                    
                    rel_path = f"images/{img_filename}"
                    
                    # If we haven't started parsing options, it's a question image
                    if not parsing_options:
                        current_q["image"].append(rel_path)
                    else:
                        # Otherwise it's an image option
                        current_q["options"].append(f"IMAGE: {rel_path}")

    if current_q and len(current_q["options"]) >= 2:
        questions.append(current_q)
        
    return questions, start_id

def main():
    pdf_dir = r"c:\Users\vishwanath\Desktop\Labview"
    images_dir = os.path.join(pdf_dir, "webapp", "images")
    os.makedirs(images_dir, exist_ok=True)
    
    all_questions = []
    current_id = 1
    
    print("Starting PDF extraction...")
    for filename in os.listdir(pdf_dir):
        if filename.lower().endswith('.pdf'):
            pdf_path = os.path.join(pdf_dir, filename)
            print(f"Processing {filename}...")
            try:
                qs, current_id = extract_from_pdf(pdf_path, images_dir, current_id)
                all_questions.extend(qs)
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                
    output_json = os.path.join(pdf_dir, "webapp", "questions.json")
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, indent=4)
        
    print(f"\nExtraction complete! Total questions: {len(all_questions)}")
    print(f"Data saved to {output_json}")

if __name__ == "__main__":
    main()
