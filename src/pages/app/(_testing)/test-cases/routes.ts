import { createFileRoute, redirect } from "@tanstack/react-router";
import { loadUiFlags } from "@/lib/ui-flags";
import TestCasesPage from ".";

export const Route = createFileRoute("/_public-chat/test-cases")({
	// Off unless the backend turns it on; the path is also blocked at the proxy on production.
	beforeLoad: async () => {
		const flags = await loadUiFlags();
		if (!flags.testCaseEntry) {
			throw redirect({ to: "/chat" });
		}
	},
	component: TestCasesPage
});
