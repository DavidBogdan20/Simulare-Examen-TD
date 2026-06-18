from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "Intrebari tehnica dentara"
OUT_DIR = Path(r"D:\tmp\ppf-course-text")

COURSES = {
    "ppf-curs-5": "PPF-Curs-5.pdf",
    "ppf-curs-6": "PPF-Curs 6- PPF Acrilica2026-descarcare.pdf",
    "ppf-curs-7": "Curs PPF- 7.pdf",
    "ppf-curs-8": "PPF Curs 8.pdf",
    "ppf-curs-9": "PPF- Curs 9.pdf",
    "ppf-curs-10": "PPF Curs 10.pdf",
    "ppf-curs-11": "PPF Curs 11.pdf",
    "ppf-curs-12": "PPF Curs 12.pdf",
}


def extract_pdf(pdf_path):
    reader = PdfReader(str(pdf_path))
    chunks = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        chunks.append(f"\n\n--- PAGE {index} ---\n{text.strip()}\n")
    return "".join(chunks)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, filename in COURSES.items():
        text = extract_pdf(PDF_DIR / filename)
        out_path = OUT_DIR / f"{slug}.txt"
        out_path.write_text(text, encoding="utf-8")
        print(f"{slug}: {len(text)} chars -> {out_path}")


if __name__ == "__main__":
    main()
