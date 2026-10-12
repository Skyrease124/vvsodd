"""Extract private textbook samples for regression tests; never copy PDFs into source control.
Usage: python scripts/prepare-knowledge-fixture.py /path/to/C++.pdf /private/path/passages.json
Requires pypdf in the test environment only. It is not a production dependency.
"""
import json
import sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
page_numbers = [15, 28, 30, 229, 230, 231, 251, 252, 253, 254, 326, 384, 592, 593]
rows = []
for page in page_numbers:
    if page > len(reader.pages):
        raise ValueError(f"Required fixture page {page} unavailable")
    text = reader.pages[page - 1].extract_text()
    if not text or not text.strip():
        raise ValueError(f"Required fixture page {page} has no readable text")
    rows.append({"page": page, "text": text})
with open(sys.argv[2], "w", encoding="utf-8") as output:
    json.dump(rows, output, ensure_ascii=False)
print(f"Extracted {len(rows)} sample pages. Full-document validity is not certified.")
