export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { thread_id, messages } = req.body;
    const threadId = thread_id || "default-user";

    const lastUserMessage = (messages || [])
      .filter((m) => m.role === "user")
      .pop();

    let voiceflowRequest;
    if (!lastUserMessage || !lastUserMessage.content) {
      voiceflowRequest = { type: "launch" };
    } else {
      voiceflowRequest = {
        type: "text",
        payload: lastUserMessage.content,
      };
    }

    const vfResponse = await fetch(
      `https://general-runtime.voiceflow.com/state/user/${encodeURIComponent(threadId)}/interact`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.VOICEFLOW_API_KEY,
          versionID: "production",
        },
        body: JSON.stringify({ request: voiceflowRequest }),
      }
    );

    if (!vfResponse.ok) {
      const errorText = await vfResponse.text();
      return res.status(502).json({ error: "Voiceflow error", detail: errorText });
    }

    const traces = await vfResponse.json();
    const textMessages = traces
      .filter((t) => t.type === "text" && t.payload?.message)
      .map((t) => t.payload.message);

    return res.status(200).json({
      id: `vf-${Date.now()}`,
      object: "chat.completion",
      choices: [{
        index: 0,
        message: { role: "assistant", content: textMessages.join("\n\n") || "No response" },
        finish_reason: "stop",
      }],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
