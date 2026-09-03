/**
 * The rule that decides whether two enquiries are the same person.
 *
 * Every case here is a spelling production actually holds — the pairs that
 * slipped past the duplicate guards and reached two different sales
 * executives.
 */
import { phoneKey, phoneDigits, normalizePhone } from "../app/lib/phone";

let failures = 0;
function same(a: string, b: string) {
  const ok = phoneKey(a) === phoneKey(b);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} "${a}" is the same person as "${b}"`);
}
function different(a: string, b: string) {
  const ok = phoneKey(a) !== phoneKey(b);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} "${a}" is NOT "${b}"`);
}
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

console.log("the pair that reached two executives:");
same("+919007884998", "9007884998");

console.log("\nthe spellings production stores:");
same("+91 76783 29708", "+91  76783 29708");
same("+91  6291 814 680", "+91 6291814680");
same("+91 7974990535 ", "+917974990535");
same("+91-98765-43210", "(+91) 98765 43210");
same("919876543210", "9876543210");

console.log("\ndifferent people stay different:");
different("9876543210", "9876543211");
different("+919876543210", "+918876543210");
// A short/mistyped number matches itself, not everything.
different("12345", "9876543210");
same("12345", "1 2 3 4 5");

console.log("\nthe pieces:");
check("digits only", phoneDigits("+91 (98765)-43210"), "919876543210");
check("key is the last ten", phoneKey("+91 98765 43210"), "9876543210");
check("short numbers keep their digits", phoneKey("12345"), "12345");
check("stored profile form is unchanged", normalizePhone("+91 98765-43210"), "919876543210");

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
