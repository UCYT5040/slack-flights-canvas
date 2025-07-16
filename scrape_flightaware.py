import logging

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
                        "iata": flight_data.get("origin", {}).get("iata", "???"),
                        "departure_time": flight_data.get("takeoffTimes", {}).get("scheduled")
                    },
                    "destination": {
                        "airport": flight_data.get("destination", {}).get("friendlyName", "Unknown Destination"),
                        "iata": flight_data.get("destination", {}).get("iata", "???"),
                        "arrival_time": flight_data.get("landingTimes", {}).get("scheduled")
                    }
                }
    logging.error(f"Failed to fetch flight data from FlightAware for {flight_number}: {flight_page.status_code}")
    return None
