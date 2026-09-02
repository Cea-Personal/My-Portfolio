from __future__ import annotations

import argparse

from career_worker.health import serve_health
from career_worker.workflows.serve import serve_inngest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="career-worker")
    subparsers = parser.add_subparsers(dest="command", required=True)
    serve = subparsers.add_parser("serve", help="Serve workflow and health endpoints")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8080)
    inngest = subparsers.add_parser("inngest", help="Serve the signed workflow endpoint")
    inngest.add_argument("--host", default="127.0.0.1")
    inngest.add_argument("--port", type=int, default=8288)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "serve":
        serve_health(host=args.host, port=args.port)
    elif args.command == "inngest":
        import os

        serve_inngest(
            host=args.host,
            port=args.port,
            signing_key=os.getenv("INNGEST_SIGNING_KEY"),
            parser_secret=os.getenv("CAREER_WORKER_SHARED_SECRET"),
        )


if __name__ == "__main__":
    main()
