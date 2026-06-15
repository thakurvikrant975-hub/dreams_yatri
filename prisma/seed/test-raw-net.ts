import net from "net";
import dns from "dns/promises";

const host = "ep-restless-pond-aqfkrm9r-pooler.c-8.us-east-1.aws.neon.tech";

// Test 1: connect with family:4 to bypass Happy Eyeballs IPv6 issues
const t = Date.now();
const s = net.connect({ host, port: 5432, family: 4 });
s.setTimeout(10000);
s.on("connect", () => { console.log(`✅ TCP connected (family:4) in ${Date.now()-t}ms`); s.destroy(); });
s.on("timeout", () => { console.log(`⏱ timeout (family:4) after ${Date.now()-t}ms`); s.destroy(); });
s.on("error", (e: NodeJS.ErrnoException) => { console.log(`❌ (family:4) ${Date.now()-t}ms: ${e.code} ${e.message}`); });
