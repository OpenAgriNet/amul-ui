import { defineConfig, loadEnv, PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import topLevelAwait from "vite-plugin-top-level-await";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const virtualRouteFileChangeReloadPlugin: PluginOption = {
	name: "watch-config-restart",
	configureServer(server) {
		server.watcher.add("./src/routes.ts");
		server.watcher.on("change", (path) => {
			if (path.endsWith("src/routes.ts")) {
				console.log("Virtual route changed");
				server.restart();
			}
		});
	}
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const devProxyTarget = env.VITE_DEV_PROXY_TARGET;
	const proxy = {
		"/shc-assets": {
			target: "https://soilhealth.dac.gov.in",
			changeOrigin: true,
			secure: true,
			rewrite: (requestPath: string) => {
				const match = requestPath.match(
					/^\/shc-assets\/(SHCLogo|green|yellow|orange|red|grey)\.png$/
				);
				return match ? `/files/report/${match[1]}.png` : "/__not_allowed__";
			}
		},
		...(devProxyTarget
			? {
					"/api": {
						target: devProxyTarget,
						changeOrigin: true,
						secure: true
					},
					"/observability-service": {
						target: devProxyTarget,
						changeOrigin: true,
						secure: true
					}
				}
			: {})
	};

	return {
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src"),
				"~": path.resolve(__dirname)
			}
		},
		plugins: [
			tsconfigPaths(),
			nodePolyfills({ globals: { Buffer: true } }),
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
				routesDirectory: path.resolve(__dirname, "src/pages"),
				virtualRouteConfig: "./src/routes.ts",
				generatedRouteTree: "./src/routeTree.gen.ts"
			}),
			topLevelAwait(),
			react(),
			virtualRouteFileChangeReloadPlugin
		],
		test: {
			// Without an explicit include, vitest walks above the project root and collects
			// unrelated specs from sibling directories, which fail on missing dependencies.
			include: ["src/**/*.{test,spec}.{ts,tsx}"]
		},
		server: {
			port: 3000,
			// In dev, proxy /api to the real API so you avoid CORS without hardcoding domains.
			// Leave VITE_API_BASE_URL empty and set VITE_DEV_PROXY_TARGET in .env (see .env.example).
			proxy
		}
	};
});
