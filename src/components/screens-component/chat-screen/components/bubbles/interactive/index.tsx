import { useMemo } from "react";
import { useChatStore } from "@/hooks/store/chat";
import { componentsForMessage } from "@/lib/agui/state";
export { onlyRepeatsControlTitle } from "@/lib/agui/state";
import type { UIComponent } from "@/lib/agui/types";
import { BookingConfirm } from "./booking-confirm";
import { ChoiceControl } from "./choice";
import { ListingCollection } from "./listing-collection";
import { ListingDetail } from "./listing-detail";
import { MilkChart } from "./milk-chart";
import { MilkDateRange } from "./milk-date-range";
import { AttachedToBubble } from "./shared";

/** The controls the backend attached to one assistant message (#593, #636, #639). */
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
						return <ChoiceControl key={component.id} component={component} />;
					case "date_range":
						return <MilkDateRange key={component.id} component={component} />;
					case "chart":
						return <MilkChart key={component.id} component={component} />;
					case "confirm":
						return <BookingConfirm key={component.id} component={component} />;
					case "listing_collection":
						return <ListingCollection key={component.id} component={component} />;
					case "listing_detail":
						return <ListingDetail key={component.id} component={component} />;
					default:
						// A kind this build doesn't know yet: the message text still shows.
						return null;
				}
			})}
		</AttachedToBubble.Provider>
	);
}
