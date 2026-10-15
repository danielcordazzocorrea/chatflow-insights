const DEMO_SESSION_KEY = "whats-ops-demo-session";

export function hasDemoSession() {
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "active";
}

export function startDemoSession() {
  sessionStorage.setItem(DEMO_SESSION_KEY, "active");
}

export function endDemoSession() {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}
