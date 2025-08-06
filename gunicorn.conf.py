workers = 4

bind = "0.0.0.0:8000"

worker_class = "gthread"
threads = 4

timeout = 480 # High timeout as flight data takes a while to process

def post_fork(server, worker):
    from scrape_api import start_worker_threads
    start_worker_threads()