import logging
import os
from re import compile

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, request
from requests import get
from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler

flight_code_pattern = compile(
    r'(?P<ICAO>\b[A-Z]{3}\d{1,4}\b)|'
    r'(?P<IATA>\b[A-Z\d]{2}\d{1,4}\b)|'
    r'(?P<number>\b\d{1,4}\b)'
)

load_dotenv()

logging.basicConfig(level=logging.INFO)

flask_app = Flask(__name__)

app = App(
    token=os.environ.get("SLACK_BOT_TOKEN"),
    signing_secret=os.environ.get("SLACK_SIGNING_SECRET")
)

auth_test_result = app.client.auth_test()
bot_id = auth_test_result["user_id"]


def get_flight_data(text):
    """
    Finds flight numbers in the text and returns flight tracking data.
    :param text: The text to search for flight numbers.
    :return: Flight tracking data relevant to the flight numbers found in the text.
    """
    results = []

    for match in flight_code_pattern.finditer(text):
        params = {
            "access_key": os.environ.get("AVIATION_STACK_TOKEN"),
        }
        code_type = match.lastgroup
        code_value = match.group(code_type)
        if code_type == "ICAO":
            params["flight_icao"] = code_value
        elif code_type == "IATA":
            params["flight_iata"] = code_value
        elif code_type == "number":
            params["flight_number"] = code_value
        else:
            logging.warning(f"Unexpected flight code type: {code_type}")
            continue

        response = get("https://api.aviationstack.com/v1/flights", params=params)
        data = response.json().get("data", [])

        if response.status_code == 200:
            if data:
                flight_info = data[0]
                iata_number = flight_info["flight"]["iata"]
                airline = flight_info["airline"]["name"]
                depart_from_iata = flight_info["departure"]["iata"]
                depart_from_airport = flight_info["departure"]["airport"]
                arrive_at_iata = flight_info["arrival"]["iata"]
                arrive_at_airport = flight_info["arrival"]["airport"]
                results.append(
                    f"✈ `{iata_number}` ({airline}) __{depart_from_airport}__ (`{depart_from_iata}`) ⮕ __{arrive_at_airport}__ (`{arrive_at_iata}`)"
                )
            else:
                logging.info(f"No flight data found for {code_type}: {code_value}")
        else:
            logging.error(
                f"Error fetching flight data for {code_type}: {code_value} - {response.status_code} {response.text}")
    else:
        logging.info("No flight codes found in the text:", text)

    results = list(set(results))

    if results:
        return f"**⬆ FLIGHT INFO ⬆** {', '.join(results)}"
    return None


def parse_lines(lines):
    """
    Takes a list of lines from a canvas file, parses each, and adds flight tracking data if applicable.
    :param lines: List of lines to parse.
    :return: List of tuples (text, line_id) for each successfully parsed line.
    """
    # Ensure the bot is mentioned somewhere in the text
    if not any(f"@{bot_id}" in line for line in lines):
        logging.info("Bot not mentioned in the text.")
        return []
    results = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            if next_line.count("⬆") == 2:  # TODO: Better way to check if lines have already been processed
                i += 2
                continue
        soup = BeautifulSoup(line, "html.parser")
        p_line = soup.find("p", class_="line")
        if not p_line:
            i += 1
            continue
        text = ' '.join(p_line.stripped_strings)
        if not text:
            i += 1
            continue
        line_id = p_line.get("id", None)
        flight_data = get_flight_data(text)
        if flight_data:
            results.append((flight_data, line_id))
        i += 1
    return results


@app.event("file_change")
def handle_file_change(event, say):
    """
    Handle file change events.
    """
    file_id = event.get("file_id")
    if not file_id:
        logging.warning("No file_id found in the event.")
        return

    file_info = app.client.files_info(file=file_id)

    if file_info["file"]["mimetype"] == "application/vnd.slack-docs":  # This file is a Canvas
        file_url = file_info["file"]["url_private_download"]
        headers = {"Authorization": f"Bearer {os.environ.get('SLACK_BOT_TOKEN')}"}
        response = get(file_url, headers=headers)

        if response.status_code == 200:
            content = response.text
            with open("canvas_file.html", "w", encoding="utf-8") as f:
                f.write(content)
            lines = content.replace("\n\n", "\n").splitlines()

            results = parse_lines(lines)
            if results:
                for text, line_id in results:
                    app.client.canvases_edit(
                        canvas_id=file_info["file"]["id"],
                        changes=[
                            {
                                "operation": "insert_after",
                                "section_id": line_id,
                                "document_content": {
                                    "type": "markdown",
                                    "markdown": text
                                }
                            }
                        ]
                    )
        else:
            logging.error(f"Failed to download file: {response.status_code} {response.text}")
    else:
        logging.info("File is not a Canvas, skipping processing.")


@flask_app.route("/slack/events", methods=["POST"])
def slack_events():
    return SlackRequestHandler(app).handle(request)


if __name__ == "__main__":
    flask_app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
