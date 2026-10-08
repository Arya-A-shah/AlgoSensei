import { BASE_URL } from "./constants";

export async function getGeminiHint({ code, prompt, title, description, slug, apiKey, userToken }) {
  try {
    const res = await fetch(`${BASE_URL}/hint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // Lets the server count the hint toward this problem's progress.
        ...(userToken ? { "X-User-Token": userToken } : {}),
      },
      body: JSON.stringify({ code, prompt, title, description, slug }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Server error ${res.status}: ${error}`);
    }

    const data = await res.json();
    return data.hint || "No hint generated.";
  } catch (error) {
    console.error("Fetch Failed:", error);
    return error.message;
  }
}

export function getSession() {
  return browser.runtime.sendMessage({ type: "DMM_SESSION" }).catch(() => null);
}
