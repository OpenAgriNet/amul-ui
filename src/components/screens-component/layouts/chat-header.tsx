import { ChevronDown, ChevronLeft, ClipboardCheck, MessageCircleQuestionMark, User } from "lucide-react";
import langIcon from "@/assets/langIcon.svg";
import amulText from "@/assets/amulText.svg";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/components/LanguageProvider";
import { LANGUAGES } from "@/components/screens-component/chat-screen/config";
import { LanguageSelectionDropdown } from "@/components/screens-component/chat-screen/components/language-selection-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChatPersona } from "@/lib/chat-persona";

/* eslint-disable no-unused-vars */
export type ChatHeaderProps = {
	title: string;
	subtitle?: string;
	leftAvatarUrl?: string;
	rightAvatarUrl?: string;
	rightLabel?: string;
	onBack?: () => void;
	backDisabled?: boolean;
	onOpenProfile?: () => void;
	onClearChat?: () => void;
	onOpenSettings?: () => void;
	showPersonaSelector?: boolean;
	persona?: ChatPersona;
	onPersonaChange?: (persona: ChatPersona) => void;
	// Only passed when the test-case entry flag is on.
	onOpenTestCases?: () => void;
};

function PersonaSelector({
	persona,
	onPersonaChange,
	className,
}: {
	persona: ChatPersona;
	onPersonaChange?: (persona: ChatPersona) => void;
	className?: string;
}) {
	return (
		<Select value={persona} onValueChange={(value) => onPersonaChange?.(value as ChatPersona)}>
			<SelectTrigger size="sm" aria-label="Chat persona" className={className}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent position="popper" align="end">
				<SelectItem value="farmer">Farmer (Sarlaben)</SelectItem>
				<SelectItem value="doctor">Doctor</SelectItem>
			</SelectContent>
		</Select>
	);
}
/* eslint-enable no-unused-vars */

export function ChatHeader(props: ChatHeaderProps) {
	const {
		title,
		leftAvatarUrl,
		rightLabel,
		onOpenProfile,
		onOpenSettings,
		showPersonaSelector = false,
		persona = "farmer",
		onPersonaChange,
		onBack,
		backDisabled = false,
		onOpenTestCases,
	} = props;

	const { language, t } = useLanguage();
	const currentLanguage = (LANGUAGES as any)[language] || LANGUAGES.en;

	const showProfile = rightLabel && rightLabel !== "Anonymous User" && rightLabel !== "";
	// AMUL-72: the pulsating logo and the "Amul AI" wordmark used to sit above
	// the welcome text; they live here now so the welcome screen can lead with
	// the question list. The doctor persona keeps its own plain-text title.
	const isDoctor = persona === "doctor";

	return (
		<header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-950 border-b border-[#E3E3E3] dark:border-gray-800 transition-colors duration-300">
			<div className="mx-auto max-w-3xl">
			<div className="flex h-16 items-center justify-between px-4">
				{/* Left: Back (AMUL-78) + Logo & Title */}
				<div className="flex items-center gap-2 min-w-0">
					{/* AMUL-78: only passed while a conversation is on screen; returns to
					    the welcome question list without clearing the chat. size-[44px]
					    rather than size-11 because the root font size is 90%. */}
					{onBack && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={t("backToQuestions") as string}
							disabled={backDisabled}
							onClick={onBack}
							className="size-[44px] shrink-0 rounded-full border border-[#F65151]/50 bg-[#FFE2E2]/60 text-[#F65151] cursor-pointer hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
						>
							<ChevronLeft className="size-6" strokeWidth={2.25} />
						</Button>
					)}
					<div className="relative shrink-0 animate-smart-pulsate">
						<Avatar className="h-9 w-9 shrink-0 shadow-none">
							<AvatarImage src={leftAvatarUrl} alt={title} className="object-contain" />
							<AvatarFallback className="bg-transparent font-bold text-[#F65151]">
								{title.slice(0, 1).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					</div>
					{isDoctor ? (
						<span className="text-xl sm:text-lg font-bold text-foreground truncate">{title}</span>
					) : (
						<img src={amulText} alt={title} className="h-6 w-auto shrink-0 object-contain sm:h-7" />
					)}
				</div>

				{/* Right: User Profile + Language + Settings */}
				<div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
					{showPersonaSelector && (
						<PersonaSelector
							persona={persona}
							onPersonaChange={onPersonaChange}
							className="hidden w-[148px] rounded-full sm:flex"
						/>
					)}
					{/* User Profile Button */}
					{showProfile && (
						<button
							onClick={onOpenProfile}
							className="flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-[#EEFFF4] transition-colors cursor-pointer"
						>
							<div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
								<User className="h-4 w-4 text-green-700" />
							</div>
							<span className="text-sm font-medium text-foreground truncate max-w-[100px] hidden sm:inline">
								{rightLabel}
							</span>
						</button>
					)}

					{/* Language Dropdown */}
					<LanguageSelectionDropdown>
						{/* Desktop Language Button */}
						<Button
							variant="outline"
							className="hidden h-9 w-auto gap-2 rounded-full bg-transparent border-transparent px-3 font-normal text-foreground sm:flex cursor-pointer border-[#CBCBCB] hover:bg-[#FFE2E2] hover:border-[#F65151]"
						>
							<img src={langIcon} alt="Language" className="h-5 w-5" />
							<span className="font-medium text-xs">{currentLanguage.name}</span>
							<ChevronDown className="ml-1 h-4 w-4 opacity-50" />
						</Button>
					</LanguageSelectionDropdown>

					{/* Mobile Language Button */}
					<LanguageSelectionDropdown>
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 sm:hidden cursor-pointer hover:bg-[#EEFFF4] hover:border-[#019444] border border-transparent"
						>
							<img src={langIcon} alt="Language" className="h-6 w-6" />
						</Button>
					</LanguageSelectionDropdown>

					{onOpenTestCases && (
						<Button
							variant="ghost"
							size="icon"
							aria-label="Add test cases"
							title="Add test cases"
							className="h-10 w-10 text-[#F65151] cursor-pointer hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
							onClick={onOpenTestCases}
						>
							<ClipboardCheck className="h-6 w-6" strokeWidth={2} />
						</Button>
					)}

					{/* FAQ: the drawer behind this button is the suggested-question
					    list, so it carries a chat bubble with a question mark rather
					    than a generic help icon, in Amul red. */}
					<Button
						variant="ghost"
						size="icon"
						aria-label="FAQ"
						className="h-10 w-10 text-[#F65151] cursor-pointer hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
						onClick={onOpenSettings}
					>
						<MessageCircleQuestionMark className="h-7 w-7" strokeWidth={2} />
					</Button>
				</div>
			</div>
			{showPersonaSelector && (
				<div className="flex justify-end px-4 pb-2 sm:hidden">
					<PersonaSelector
						persona={persona}
						onPersonaChange={onPersonaChange}
						className="w-full"
					/>
				</div>
			)}
			</div>
		</header>
	);
}
