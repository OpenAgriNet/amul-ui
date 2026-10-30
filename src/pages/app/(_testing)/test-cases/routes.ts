import { createFileRoute, redirect } from "@tanstack/react-router";
import { environment } from "@/lib/config/environment";
import TestCasesPage from ".";

export const Route = createFileRoute("/_public-chat/test-cases")({
	// Off on production builds; the path is also blocked at the proxy there.
	beforeLoad: () => {
		if (!environment.testCaseEntryEnabled) {
			throw redirect({ to: "/chat" });
		}
	},
	component: TestCasesPage
});
