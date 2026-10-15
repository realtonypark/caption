import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
const keyBytes = (key) => {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32)
    throw new Error("Provider encryption is not configured.");
  return bytes;
};
export const sealCredential = (value, key, owner) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(Buffer.from(owner));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
};
export const openCredential = (value, key, owner) => {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(key),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(owner));
  const tag = Buffer.from(value.tag, "base64");
  if (tag.length !== 16) throw new Error("Invalid provider credential.");
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
};
