/** Readable alphabet without ambiguous characters (0/O, 1/I/l). */
const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a random access-code password suitable for sharing verbally or via chat.
 */
export function generateAccessCodePassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ACCESS_CODE_ALPHABET[bytes[i]! % ACCESS_CODE_ALPHABET.length];
  }
  return result;
}
