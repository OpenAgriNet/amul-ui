import { useMemo } from "react";
import { useChatStore } from "@/hooks/store/chat";
import { componentsForMessage } from "@/lib/agui/state";
export { onlyRepeatsControlTitle } from "@/lib/agui/state";
import type { UIComponent } from "@/lib/agui/types";
import { AccountChoice } from "./account-choice";
import { MilkChart } from "./milk-chart";
import { MilkDateRange } from "./milk-date-range";
import { AttachedToBubble } from "./shared";

/** The controls the backend attached to one assistant message (#593). */
export function useMessageComponents(messageId: string): UIComponent[] {
	const amulUi = useChatStore((s) => s.amulUi);
	return useMemo(() => componentsForMessage(amulUi, messageId), [amulUi, messageId]);
}

export function InteractiveControls({
	components,
	attached = true
}: {
	readonly components: UIComponent[];
	readonly attached?: boolean;
}) {
	if (components.length === 0) return null;

	return (
		<AttachedToBubble.Provider value={attached}>
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
		</AttachedToBubble.Provider>
	);
}
