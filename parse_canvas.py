from bs4 import BeautifulSoup, PageElement


# TODO: Add documentation

class CanvasLine:
    def __init__(self, element: PageElement):
        self.element = element
        self.text = element.get_text(separator=" ", strip=True)
        self.id = element.get('id', None)

    def __contains__(self, item):
        return item in self.text

    def __eq__(self, other):
        if isinstance(other, CanvasLine):
            return self.text == other.text and self.id == other.id
        return False


def parse_canvas(content: str) -> list[CanvasLine]:
    soup = BeautifulSoup(content, 'html.parser')
    # Find all paragraphs with the `line` class
    lines = soup.find_all('p', class_='line')
    canvas_lines = []
    for line in lines:
        canvas_line = CanvasLine(line)
        if canvas_line.text:  # Only add non-empty lines
            canvas_lines.append(canvas_line)
    return canvas_lines
