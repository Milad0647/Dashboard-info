export async function register() {
  // Node-only: Edge build must not trace the backup scheduler module graph.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
