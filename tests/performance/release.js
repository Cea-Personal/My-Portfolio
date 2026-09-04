import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 5,
  iterations: 25,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2500"],
    checks: ["rate>0.99"]
  }
};
export default function () {
  if (!__ENV.BASE_URL) throw new Error("BASE_URL is required for release performance validation");
  const baseUrl = __ENV.BASE_URL.replace(/\/$/, "");
  const responses = http.batch([
    ["GET", `${baseUrl}/`],
    ["GET", `${baseUrl}/api/v1/public/portfolio`],
    [
      "POST",
      `${baseUrl}/api/v1/public/chat`,
      JSON.stringify({ question: "What data systems has Basil built?" }),
      { headers: { "content-type": "application/json" } }
    ]
  ]);
  check(responses[0], { "portfolio responds": (response) => response.status === 200 });
  check(responses[1], { "projection responds": (response) => response.status === 200 });
  check(responses[2], {
    "public AI remains bounded": (response) => response.status === 200 || response.status === 429
  });
}
