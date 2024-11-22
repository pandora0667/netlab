// vite.config.ts
import { defineConfig } from "file:///Users/mzc01-seongwon/Development/netlab/node_modules/vite/dist/node/index.js";
import react from "file:///Users/mzc01-seongwon/Development/netlab/node_modules/@vitejs/plugin-react/dist/index.mjs";
import themePlugin from "file:///Users/mzc01-seongwon/Development/netlab/node_modules/@replit/vite-plugin-shadcn-theme-json/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "/Users/mzc01-seongwon/Development/netlab";
var vite_config_default = defineConfig({
  plugins: [react(), themePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "client", "src")
    }
  },
  root: path.resolve(__vite_injected_original_dirname, "client"),
  build: {
    outDir: path.resolve(__vite_injected_original_dirname, "dist/public"),
    emptyOutDir: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbXpjMDEtc2Vvbmd3b24vRGV2ZWxvcG1lbnQvbmV0bGFiXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvbXpjMDEtc2Vvbmd3b24vRGV2ZWxvcG1lbnQvbmV0bGFiL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9temMwMS1zZW9uZ3dvbi9EZXZlbG9wbWVudC9uZXRsYWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHRoZW1lUGx1Z2luIGZyb20gXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLXNoYWRjbi10aGVtZS1qc29uXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGhlbWVQbHVnaW4oKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiY2xpZW50XCIsIFwic3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIHJvb3Q6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiY2xpZW50XCIpLFxuICBidWlsZDoge1xuICAgIG91dERpcjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJkaXN0L3B1YmxpY1wiKSxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwUyxTQUFTLG9CQUFvQjtBQUN2VSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDaEMsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsVUFBVSxLQUFLO0FBQUEsSUFDOUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNLEtBQUssUUFBUSxrQ0FBVyxRQUFRO0FBQUEsRUFDdEMsT0FBTztBQUFBLElBQ0wsUUFBUSxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLElBQzdDLGFBQWE7QUFBQSxFQUNmO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
