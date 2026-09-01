export const performanceProfiles = {
  publicMobile: {
    vus: 25,
    duration: "1m",
    thresholds: { http_req_duration: ["p(95)<2500"] }
  },
  aiNormalLoad: {
    vus: 10,
    duration: "1m",
    thresholds: { http_req_waiting: ["p(95)<3000"] }
  }
};
