from regex import compile
from typing import Optional

json_pattern = compile(r'\{(?:[^{}]|(?R))*\}')

json_url_pattern = compile(
    r'https?://[^\s/$.?#].[^\s]*\.json\b'
)

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

def find_json_url(text: str) -> Optional[str]:
    """
    Find the first URL to a JSON file in the given text.
    :param text: The text to search for a JSON URL.
    :return: The JSON URL as a string if found, otherwise None.
    """
    match = json_url_pattern.search(text)
    if match:
        return match.group(0)
    return None

