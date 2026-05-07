"""Production entry point — serves Flask API + React frontend via Waitress."""

from waitress import serve
from app import create_app

app = create_app()

if __name__ == "__main__":
    print("Employee Tech Documentation running on http://0.0.0.0:5065")
    serve(app, host="0.0.0.0", port=5065)
