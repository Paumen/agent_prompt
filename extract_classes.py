import os
import re
import subprocess
import tempfile
from pathlib import Path

CLASS_REGEX = re.compile(r'\.([a-zA-Z0-9_-]+)')

def extract_classes_from_text(text):
    classes = set()

    # class="foo bar"
    for attr in re.findall(r'class(?:Name)?=["\']([^"\']+)["\']', text):
        for cls in attr.split():
            classes.add(cls)

    # .class selectors
    for cls in re.findall(r'\.([a-zA-Z0-9_-]+)', text):
        classes.add(cls)

    return classes

def extract_classes(repo_url):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["git", "clone", "--depth", "1", repo_url, tmp], check=True)

        classes = set()
        exts = (".html", ".css", ".js", ".jsx", ".ts", ".tsx")

        for root, _, files in os.walk(tmp):
            for file in files:
                if file.endswith(exts):
                    path = Path(root) / file
                    try:
                        text = path.read_text(errors="ignore")
                        classes |= extract_classes_from_text(text)
                    except:
                        pass

        return sorted(classes)

if __name__ == "__main__":
    repo = input("GitHub repo URL: ")
    result = extract_classes(repo)
    print("\nExtracted CSS classes:")
    for c in result:
        print(c)
