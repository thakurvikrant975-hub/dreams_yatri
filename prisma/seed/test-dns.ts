import dns from "dns/promises";
async function main() {
  const result = await dns.lookup("ep-restless-pond-aqfkrm9r-pooler.c-8.us-east-1.aws.neon.tech");
  console.log("lookup:", result);
}
main();
