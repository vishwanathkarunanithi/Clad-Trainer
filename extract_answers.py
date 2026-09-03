import fitz
import sys

def extract_text(pdf_path, out_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Extracted to {out_path}")

if __name__ == "__main__":
    pdf = r"c:\Users\vishwanath\Desktop\Labview\answer key.pdf"
    out = "extracted_answers.txt"
    extract_text(pdf, out)
