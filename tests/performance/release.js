import http from "k6/http";
import { check } from "k6";

export const options = { vus: 1, iterations: 1 };
export default function () {
  const response = http.get(__ENV.BASE_URL || "http://localhost:3000/");
  check(response, { "public page responds": (res) => res.status < 500 });
}
