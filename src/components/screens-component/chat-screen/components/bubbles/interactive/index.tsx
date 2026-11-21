import { useMemo } from "react";
import { useChatStore } from "@/hooks/store/chat";
import { componentsForMessage } from "@/lib/agui/state";
import { AccountChoice } from "./account-choice";
import { MilkChart } from "./milk-chart";
import { MilkDateRange } from "./milk-date-range";

/** The controls the backend attached to one assistant message (#593). */
export function InteractiveControls({ messageId }: { readonly messageId: string }) {
	const amulUi = useChatStore((s) => s.amulUi);
	const components = useMemo(() => componentsForMessage(amulUi, messageId), [amulUi, messageId]);
	if (components.length === 0) return null;

	return (
		<>
			{components.map((component) => {
				switch (component.kind) {
					case "choice":
						return <AccountChoice key={component.id} component={component} />;
					case "date_range":
						return <MilkDateRange key={component.id} component={component} />;
					case "chart":
						return <MilkChart key={component.id} component={component} />;
					default:
						// "confirm" has no workflow yet; the backend rejects it in v1.
						return null;
				}
			})}
		</>
	);
}
