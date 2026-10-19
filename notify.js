import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const chatIdClient = process.env.TELEGRAM_CHAT_ID_CLIENT;

  if (!token || !chatId) {
    return res.status(500).json({
      error: "Telegram configuration missing"
    });
  }

  try {
    // Notification counter
    let notificationCount = 0;

    try {
      notificationCount = await redis.incr("notification_count");
    } catch (error) {
      console.error("Redis counter error:", error);
    }

    // Request information
    const userAgent = req.headers["user-agent"] || "Unknown";

    const ip =
      req.headers["x-real-ip"] ||
      req.headers["x-vercel-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "Unknown";

    // Vercel IP-based geolocation
    const country =
      req.headers["x-vercel-ip-country"] || "Unknown";

    const region =
      req.headers["x-vercel-ip-country-region"] || "Unknown";

    let city =
      req.headers["x-vercel-ip-city"] || "Unknown";

    // Vercel encodes some city names
    try {
      city = decodeURIComponent(city);
    } catch {
      // Keep original value if decoding fails
    }

    const latitude =
      req.headers["x-vercel-ip-latitude"] || "Unknown";

    const longitude =
      req.headers["x-vercel-ip-longitude"] || "Unknown";

    const timezone =
      req.headers["x-vercel-ip-timezone"] || "Unknown";

    // Device
    let device = "Unknown";

    if (/android/i.test(userAgent)) {
      device = "Android";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      device = "iOS";
    } else if (/windows/i.test(userAgent)) {
      device = "Windows";
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      device = "macOS";
    } else if (/linux/i.test(userAgent)) {
      device = "Linux";
    }

    // Browser
    let browser = "Unknown";

    if (/edg/i.test(userAgent)) {
      browser = "Edge";
    } else if (
      /chrome|crios/i.test(userAgent) &&
      !/edg/i.test(userAgent)
    ) {
      browser = "Chrome";
    } else if (/firefox|fxios/i.test(userAgent)) {
      browser = "Firefox";
    } else if (
      /safari/i.test(userAgent) &&
      !/chrome|crios/i.test(userAgent)
    ) {
      browser = "Safari";
    } else if (/opera|opr/i.test(userAgent)) {
      browser = "Opera";
    }

    // UTC time
    const time = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short"
    });

    const text = `Website Activity
Notification count: ${notificationCount}
Device: ${device}
Browser: ${browser}
Country: ${country}
Region: ${region}
City: ${city}
IP: ${ip}
Latitude: ${latitude}
Longitude: ${longitude}
Timezone: ${timezone}
Time: ${time}`;

    // Send to both Telegram recipients
    const recipients = [chatId];

    if (chatIdClient) {
      recipients.push(chatIdClient);
    }

    const results = await Promise.all(
      recipients.map((id) =>
        fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: id,
              text
            })
          }
        ).then((response) => response.json())
      )
    );

    const failed = results.some((data) => !data.ok);

    if (failed) {
      console.error("Telegram API error:", results);

      return res.status(502).json({
        error: "Telegram request failed"
      });
    }

    return res.status(200).json({
      ok: true,
      notificationCount
    });

  } catch (error) {
    console.error("Notification error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}