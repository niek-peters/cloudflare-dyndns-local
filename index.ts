import { $ } from "bun";

const DOMAINS = process.env.DOMAINS!.split(",");
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MINUTE_INTERVAL = parseInt(process.env.MINUTE_INTERVAL!);

run();
setInterval(run, 1000 * 60 * MINUTE_INTERVAL);

async function run() {
  const now = new Date();
  console.log(
    `\n--- RERUNNING (${now.getDate()}/${
      now.getMonth() + 1
    }/${now.getFullYear()} | ${prependZero(
      now.getHours().toString()
    )}:${prependZero(now.getMinutes().toString())}:${prependZero(
      now.getSeconds().toString()
    )}) ---`
  );

  try {
    const ip = await getIP();

    const zones = await getZones();
    for (const zone of zones) {
      let records;
      try {
        records = await getRecords(zone.name, zone.id);
      } catch (e) {
        console.error(`ERROR: ${(e as Error).message}`);
      }
      for (const record of records) {
        if (DOMAINS.includes(record.name) && record.type === "A") {
          if (record.content === ip)
            console.log(
              `SUCCESS: A-record for '${record.name}' was already set to '${ip}'`
            );
          else
            try {
              await updateRecord(record.name, zone.id, record.id, ip);
            } catch (e) {
              console.error(`ERROR: ${(e as Error).message}`);
            }
        }
      }
    }
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
  } finally {
    console.log(`--- FINISHED (will rerun in ${MINUTE_INTERVAL} minutes) ---`);
  }
}

async function getIP() {
  const res = await $`hostname -I`;
  const text = res.text();
  return text.split(" ")[0];
}

async function getZones() {
  const res = await fetch("https://api.cloudflare.com/client/v4/zones", {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (!res.ok) throw new Error(`Could not get zones | ${await res.text()}`);

  return (await res.json()).result;
}

async function getRecords(zoneName: string, zoneId: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  if (!res.ok)
    throw new Error(
      `Could not get records for zone '${zoneId}' (${zoneName}) | ${await res.text()}`
    );

  return (await res.json()).result;
}

async function updateRecord(
  domain: string,
  zoneId: string,
  recordId: string,
  ip: string
) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        content: ip,
      }),
    }
  );

  if (!res.ok)
    throw new Error(
      `Could not update A-record for '${domain}' to '${ip}' | ${await res.text()}`
    );

  console.log(`SUCCESS: Updated A-record for '${domain}' to '${ip}'`);
}

function prependZero(num: string) {
  return num.length === 1 ? `0${num}` : num;
}
