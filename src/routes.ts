import { index, layout, rootRoute, route } from "@tanstack/virtual-file-routes";

const middleware = (file: string, children: any[]) => layout(`middlewares/${file}`, children);

export const routes = rootRoute("root.tsx", [
	// Landing/redirect logic
	index("index.tsx"),

	// Compact public surface for approved partner embeds.
	route("/embed/$hostId", "public/widget/routes.ts"),

	// Public auth-only pages guarded by redirect middleware
	middleware("restrict-login-signup.tsx", [
		route("/login", "auth/login/routes.ts"),
		route("/forgot-password", "auth/forgot-password/routes.ts"),
		route("/privacy-policy", "public/privacy-policy/routes.ts")
	]),
	// Public chat surface with its own layout
	middleware("public-chat.tsx", [
		layout("chat-layout", "app/(_chat)/layout.tsx", [
			route("/chat", "app/(_chat)/chat-screen/routes.ts"),
			route("/settings", "app/(_chat)/settings/routes.ts")
		]),
		// Test-case entry for the evaluation dataset, behind the test_case_entry flag from GET /api/ui-flags/.
		route("/test-cases", "app/(_testing)/test-cases/routes.ts")
	]),
	// Protected area behind authentication
	middleware("authenticate.tsx", [
		layout("app-layout", "app/(_authenticated)/layout.tsx", [
			route("/profile", "app/(_authenticated)/profile/routes.ts")
			// Admin-only surface
			//middleware("require-admin.tsx", [layout("admin-layout", "app/(admin)/layout.tsx", [])])
		])
	]),

	// Error surfaces
	route("/403", "error/403/routes.ts"),
	route("/404", "error/404/routes.ts"),
	route("/500", "error/500/routes.ts"),
	route("/error", "error/default-error/routes.ts")
]);
