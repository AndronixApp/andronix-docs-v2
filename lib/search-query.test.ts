import { test } from "node:test";
import assert from "node:assert/strict";
import { HIDDEN, searchQueryForAnalytics as q } from "./search-query.ts";

test("ordinary queries pass, lower-cased and cut to 40 characters", () => {
  assert.equal(q("  VNC  Server "), "vnc server");
  assert.equal(q("signal 9"), "signal 9");
  assert.equal(q("ubuntu 22.04 xfce"), "ubuntu 22.04 xfce");
  assert.equal(q("android 14"), "android 14");
  assert.equal(q("kernel 5.10.157"), "kernel 5.10.157");
  assert.equal(q("a".repeat(30) + " " + "b".repeat(30)), "a".repeat(30) + " " + "b".repeat(9));
  assert.equal(q("x"), null);
  assert.equal(q("   "), null);
});

test("emails, phone numbers, long numbers and tokens are hidden", () => {
  for (const s of [
    "someone@gmail.com", "my mail is Some.One@example.co.uk", "someone (at) gmail (dot) com", "user [at] mail [dot] org",
    "+49 151 23456789", "(555) 123-4567", "98765 43210", "order GPA.1234-5678-9012-34567", "1234567",
    "uid ABCdef0123456789ghijKLMN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  ]) assert.equal(q(s), HIDDEN, s);
});
