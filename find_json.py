from regex import compile
from typing import Optional

json_pattern = compile(r'\{(?:[^{}]|(?R))*\}')

def find_json(text: str) -> Optional[str]:
    """
    Find the first JSON object in the given text.
    :param text: The text to search for a JSON object.
    :return: The JSON object as a string if found, otherwise None.
    """
    match = json_pattern.search(text)
    if match:
        return match.group(0)
    return None
