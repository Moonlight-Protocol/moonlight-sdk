export async function sha256Buffer(data: Uint8Array): Promise<ArrayBuffer> {
  // Compute the SHA-256 digest (returns an ArrayBuffer)
  return await crypto.subtle.digest("SHA-256", data);
}
