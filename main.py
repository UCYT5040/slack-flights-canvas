import logging
import os
from json import loads as json_loads, JSONDecodeError
from re import compile

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, request
from requests import get
from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler

VERSION = "v1"

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


def scrape_flightaware(flight_number):
    omnisearch_url = "https://www.flightaware.com/ajax/ignoreall/omnisearch/flight.rvt"
    omnisearch_params = {
        "v": "50",
        "locale": "en_US",
        "searchterm": flight_number,
        "q": flight_number
    }
    headers = {
        "Host": "www.flightaware.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"
    }
    resp = get(omnisearch_url, params=omnisearch_params, headers=headers)
    if resp.status_code != 200:
        logging.error(f"Failed to fetch ident from omnisearch for {flight_number}: {resp.status_code}")
        return None

    data = resp.json()
    if not data.get("data") or not len(data["data"]):
        logging.info(f"No ident found for {flight_number} via omnisearch.")
        return None
    ident = data["data"][0]["ident"]

    url = f"https://www.flightaware.com/live/flight/{ident}"
    flight_page = get(url, headers=headers)
    if flight_page.status_code == 200:
        soup = BeautifulSoup(flight_page.text, "html.parser")
        script = soup.find("script", string=lambda text: text and "var trackpollGlobals" in text)
        if script:
            script_content = script.string.replace("var trackpollGlobals = ", "", 1)
            script_content = script_content[::-1].replace(";", "", 1).strip()[::-1]
            trackpoll_globals = json_loads(script_content)
            data_url = f"https://www.flightaware.com/ajax/trackpoll.rvt"
            params = {
                "token": trackpoll_globals["TOKEN"],
                "locale": "en_US",
                "summary": 1
            }
            data_response = get(data_url, params=params, headers=headers)
            if data_response.status_code == 200:
                data = data_response.json()
                flight_data = list(data.get("flights", {}).values())[0]
                if not flight_data:
                    logging.info(f"No flight data found for {flight_number}. Response: {data_response.text}")
                    return None
                return {
                    "airline": (flight_data.get("airline", {}) or {}).get("shortName", "Unknown Airline"),
                    "identifier": flight_data.get("codeShare", {}).get("ident", ident),
                    "link": url,
                    "origin": {
                        "airport": flight_data.get("origin", {}).get("friendlyName", "Unknown Origin"),
                        "iata": flight_data.get("origin", {}).get("iata", "???")
                    },
                    "destination": {
                        "airport": flight_data.get("destination", {}).get("friendlyName", "Unknown Destination"),
                        "iata": flight_data.get("destination", {}).get("iata", "???")
                    }
                }
    logging.error(f"Failed to fetch flight data from FlightAware for {flight_number}: {flight_page.status_code}")
    return None


def get_flight_data(text):
    """
    Finds flight numbers in the text and returns flight tracking data.
    :param text: The text to search for flight numbers.
    :return: Flight tracking data relevant to the flight numbers found in the text.
    """
    results = []

    for match in flight_code_pattern.finditer(text):
        code_type = match.lastgroup  # Code type does not matter to FlightAware (this is leftover from previous API)
        code_value = match.group(code_type)

        data = scrape_flightaware(code_value)
        if not data:
            logging.info(f"No flight data found for {code_value}.")
            continue
        results.append(
            f"✈ [{data['identifier']}]({data['link']}) ({data['airline']}) __{data['origin']['airport']}__ "
            f"(`{data['origin']['iata']}`) ⮕ __{data['destination']['airport']}__ (`{data['destination']['iata']}`)"
        )

    results = list(set(results))

    if results:
        return f"**⬆ FLIGHT INFO ({VERSION}) ⬆** {',\t'.join(results)}"
    return None


def parse_lines(lines):
    """
    Takes a list of lines from a canvas file, parses each, and adds flight tracking data if applicable.
    :param lines: List of lines to parse.
    :return: List of tuples (text, line_id) for each successfully parsed line.
    """
    # Ensure the bot is mentioned somewhere in the text
    canvas_config = None
    for line in lines:
        if f"@{bot_id}" in line:
            canvas_config = {}
            soup = BeautifulSoup(line, "html.parser")
            p_line = soup.find("p", class_="line")
            text = ' '.join(p_line.stripped_strings)
            if text:
                text = text.replace(f"@{bot_id}", "").strip()
                try:
                    canvas_config = json_loads(text)
                except JSONDecodeError:
                    pass
            break
    if canvas_config is None:
        logging.info("No mention of the bot found in the canvas file.")
        return []
    results = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if "FLIGHT INFO" in line:
            i += 1
            continue
        soup = BeautifulSoup(line, "html.parser")
        p_line = soup.find("p", class_="line")
        if not p_line:
            i += 1
            continue
        line_id = p_line.get("id", None)
        replace = False
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            if f"FLIGHT INFO ({VERSION})" in next_line:
                i += 2
                continue
            elif f"FLIGHT INFO" in next_line:
                replace = True
                next_p_line = BeautifulSoup(next_line, "html.parser").find("p", class_="line")
                line_id = next_p_line.get("id", None)
                i += 2
        text = ' '.join(p_line.stripped_strings)
        if not text:
            i += 1
            continue
        flight_data = get_flight_data(text)
        if flight_data:
            results.append((flight_data, line_id, replace))
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
                for text, line_id, replace in results:
                    app.client.canvases_edit(
                        canvas_id=file_info["file"]["id"],
                        changes=[
                            {
                                "operation": "replace" if replace else "insert_after",
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
