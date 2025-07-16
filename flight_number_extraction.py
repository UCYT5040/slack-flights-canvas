from re import compile

flight_number_pattern = compile(
    r"\b[A-Za-z]{2,3}[\s-]?\d{1,4}\b|\b\d{3,4}\b"
)


def extract_flight_numbers(text: str) -> list[str]:
    """
    Extracts flight numbers from the given text.
    :param text: The text to extract flight numbers from.
    :return: A list of flight numbers found in the text.
    """
    return flight_number_pattern.findall(text)
