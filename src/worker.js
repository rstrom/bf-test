export default {
  async fetch(request, env) {
    // Serve static files from the assets directory
    return env.ASSETS.fetch(request);
  }
};
