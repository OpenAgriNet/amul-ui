import { AudioBubble } from "./audio-bubble";
import { CardBubble } from "./card-bubble";
import { ChatMessage } from "./chat-types";
import { SystemBubble } from "./system-bubble";
import { TextBubble } from "./text-bubble";
import { MessageChrome } from "../message-chrome";
import { InteractiveControls, onlyRepeatsControlTitle, useMessageComponents } from "./interactive";

/* eslint-disable no-unused-vars */
type BubbleProps = { message: ChatMessage; onQuickReply?: (payload: string) => void };
/* eslint-enable no-unused-vars */

export function Bubble({ message }: BubbleProps) {
	const components = useMessageComponents(message.id);

	switch (message.type) {
		case "text":
			return (
				<MessageChrome role={message.role}>
					<TextBubble message={message} />
				</MessageChrome>
			);
		case "card": {
			// A message that only names its control shows the control alone.
			const controlOnly = onlyRepeatsControlTitle(message.body, components);
			return (
				<MessageChrome role={message.role}>
					{controlOnly ? null : <CardBubble message={message} />}
					<InteractiveControls components={components} attached={!controlOnly} />
				</MessageChrome>
			);
		}
		// case "quick_replies":
		// 	return (
		// 		<MessageChrome role={message.role} showLabel={false}>
		// 			<QuickRepliesBubble message={message} onQuickReply={onQuickReply} />
		// 		</MessageChrome>
		// 	);
		case "system":
			return <SystemBubble message={message} />;
		case "audio":
			return (
				<MessageChrome role={message.role}>
					{/** @ts-ignore - isMine missing in MessageChrome context implicitly, but Bubble component allows passing logic if needed or MessageChrome handles alignment. 
                         Actually AudioBubble needs `isMine`. 
                         Currently MessageChrome handles alignment based on role. 
                         Let's assume role="user" is mine.
                         Checking MessageList usage, it passes messages. 
                         Let's derive isMine from role.
                     */}
					<AudioBubble message={message} isMine={message.role === "user"} />
				</MessageChrome>
			);
		default:
			return null;
	}
}
