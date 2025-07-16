from datetime import datetime

from format_timedelta import format_timedelta

FLIGHT_INFO_FORMAT_VERSION = "v2"
FLIGHT_INFO_TITLE = "✈️ Flight info"


def format_flight_info_message(flight_info: dict, tracking: bool) -> str:
    message = (f"[{flight_info['airline']} `{flight_info['identifier']}`]({flight_info["link"]}) {flight_info["origin"]["airport"]} "
            f"(`{flight_info["origin"]["iata"]}`) ➔ {flight_info["destination"]["airport"]} "
            f"(`{flight_info["destination"]["iata"]}`)")
    if tracking:
        now = datetime.now()
        dep_time = flight_info["origin"].get("departure_time")
        arr_time = flight_info["destination"].get("arrival_time")
        if dep_time is None or arr_time is None:
            message += " **Flight times not available**"
            return message
        departure_time = datetime.fromtimestamp(dep_time)
        arrival_time = datetime.fromtimestamp(arr_time)
        if now < departure_time:
            message += f" 🛫 Departing in about 🕙 **{format_timedelta(departure_time - now)}**"
        elif now < arrival_time:
            message += f" 🛬 Arriving in about 🕙 **{format_timedelta(arrival_time - now)}**"
        else:
            message += f" 🏙️ Flight completed about 🕙 **{format_timedelta(now - arrival_time)}** ago"
    return message


def combine_flight_info_messages(messages: str) -> str:
    """
    Combines multiple flight info messages into a single message.
    :param messages: The flight info messages to combine.
    :return: The combined flight info message.
    """
    return f"**{FLIGHT_INFO_TITLE}** (`{FLIGHT_INFO_FORMAT_VERSION}`): " + " | ".join(messages)
