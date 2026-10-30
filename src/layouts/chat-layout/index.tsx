import { ClipboardCheck, List, MessagesSquare } from "lucide-react";
import { ChatHeader } from "@/components/screens-component/layouts/chat-header";
import { Button } from "@/components/ui/button";
import { ChatInput, type ChatInputPayload } from "@/components/screens-component/chat-screen/components/chat-input";
import { CHAT_ASSISTANT, CHAT_USER, type FAQCategoryId } from "@/components/screens-component/chat-screen/config";
import { useChatStore } from "@/hooks/store/chat";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useLanguage } from "@/components/LanguageProvider";
import { useCallback, useState, useEffect } from "react";
import { Toast } from "@/components/screens-component/chat-screen/components/toast";
import { SettingsDrawer } from "@/components/screens-component/chat-screen/components/settings-drawer";
import { ProfileDialog } from "@/components/screens-component/profile/profile-dialog";
import { FarmerAlert } from "@/components/screens-component/chat-screen/components/farmer-alert";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/apis/profile";
import { environment } from "@/lib/config/environment";

const OPEN_FAQ_PANEL_EVENT = "open-faq-panel";

function ChatLayout() {
	const sessionId = useChatStore((s) => s.sessionId);
	const clearChat = useChatStore((s) => s.clearChat);
	const draft = useChatStore((s) => s.draft);
	const setDraft = useChatStore((s) => s.setDraft);
	const sendText = useChatStore((s) => s.sendText);
	const sendAudio = useChatStore((s) => s.sendAudio);
	const isListening = useChatStore((s) => s.isListening);
	const isTranscribing = useChatStore((s) => s.isTranscribing);
	const isAssistantTyping = useChatStore((s) => s.isAssistantTyping);
	const startListening = useChatStore((s) => s.startListening);
	const stopListening = useChatStore((s) => s.stopListening);
	const suggestions = useChatStore((s) => s.suggestions);
	const messages = useChatStore((s) => s.messages);
	const toastData = useChatStore((s) => s.toast);
	const setToast = useChatStore((s) => s.setToast);
	const fetchLocation = useChatStore((s) => s.fetchLocation);
	const persona = useChatStore((s) => s.persona);
	const setPersona = useChatStore((s) => s.setPersona);
	const showQuestionList = useChatStore((s) => s.showQuestionList);
	const openQuestionList = useChatStore((s) => s.openQuestionList);
	const closeQuestionList = useChatStore((s) => s.closeQuestionList);
	const navigate = useNavigate();

	const { language, t } = useLanguage();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [faqExpandCategory, setFaqExpandCategory] = useState<FAQCategoryId | undefined>();
	const [profileOpen, setProfileOpen] = useState(false);

	const { user } = useAuth();
	const { data: profileData } = useUserProfile();

	const isAnonymous = !user || user.is_guest_user || !user.mobile;
	const farmerName = profileData?.farmer?.farmers?.[0]?.farmerName;
	const displayName = isAnonymous ? "" : farmerName || user?.username || "Profile";

	// AMUL-78: once a farmer has a conversation, the header back button and the
	// pill above the input switch between it and the welcome question list
	// without clearing it. The doctor persona has no question list.
	const hasConversation = messages.length > 0 && persona !== "doctor";
	const isOnQuestionList = hasConversation && showQuestionList;
	const openTestCases = () => navigate({ to: "/test-cases" });
	// Test-case entry (dev only): the test-cases screen imports this chat on arrival.
	const showSaveAsTestCase = environment.testCaseEntryEnabled && messages.length > 0 && !showQuestionList;
	const questionListToggle = hasConversation || showSaveAsTestCase ? (
		<div className="mb-2 flex flex-wrap justify-center gap-2">
			{hasConversation && <Button
				type="button"
				variant="outline"
				disabled={isAssistantTyping}
				onClick={isOnQuestionList ? closeQuestionList : openQuestionList}
				className="min-h-[44px] gap-2 rounded-full border-[#F65151] bg-white px-5 text-sm font-semibold text-[#F65151] cursor-pointer hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
			>
				{isOnQuestionList ? <MessagesSquare className="size-5" /> : <List className="size-5" />}
				{(isOnQuestionList ? t("backToConversation") : t("seeMoreQuestions")) as string}
			</Button>}
			{showSaveAsTestCase && (
				<Button
					type="button"
					variant="outline"
					disabled={isAssistantTyping}
					onClick={openTestCases}
					className="min-h-[44px] gap-2 rounded-full border-[#019444] bg-white px-5 text-sm font-semibold text-[#017A38] cursor-pointer hover:bg-[#EEFFF4] hover:text-[#017A38]"
				>
					<ClipboardCheck className="size-5" />
					Save as test case
				</Button>
			)}
		</div>
	) : null;

	// Determine alert state
	const showWarningAlert =
		persona === "farmer" &&
		!isAnonymous &&
		profileData &&
		(profileData.status === "error" || profileData.status === "not_found");

	useEffect(() => {
		fetchLocation(t);
	}, [fetchLocation, t]);

	useEffect(() => {
		const openFaqPanel = (event: Event) => {
			const expandCategory = (event as CustomEvent<{ expandCategory?: FAQCategoryId }>).detail
				?.expandCategory;
			setFaqExpandCategory(expandCategory);
			setSettingsOpen(true);
		};
		window.addEventListener(OPEN_FAQ_PANEL_EVENT, openFaqPanel);
		return () => window.removeEventListener(OPEN_FAQ_PANEL_EVENT, openFaqPanel);
	}, []);

	const handleSettingsOpenChange = (open: boolean) => {
		setSettingsOpen(open);
		if (!open) setFaqExpandCategory(undefined);
	};

	const handleCloseToast = useCallback(() => {
		setToast(null);
	}, [setToast]);

	return (
		<div className="flex h-svh w-full flex-col overflow-hidden layout-gradient text-foreground relative">
			{toastData && (
				<Toast
					message={toastData.message}
					type={toastData.type}
					onClose={handleCloseToast}
				/>
			)}
			<ChatHeader
				title={persona === "doctor" ? "Amul Veterinary Assistant" : CHAT_ASSISTANT.name}
				subtitle="Government assistance and agriculture insights"
				leftAvatarUrl={CHAT_ASSISTANT.avatar}
				rightAvatarUrl={CHAT_USER.avatar}
				rightLabel={displayName}
				onClearChat={clearChat}
				onOpenProfile={() => setProfileOpen(true)}
				onOpenSettings={() => {
					setFaqExpandCategory(undefined);
					setSettingsOpen(true);
				}}
				onBack={hasConversation && !showQuestionList ? openQuestionList : undefined}
				backDisabled={isAssistantTyping}
				showPersonaSelector={environment.doctorPersonaSelectorEnabled}
				persona={persona}
				onPersonaChange={setPersona}
				onOpenTestCases={environment.testCaseEntryEnabled ? openTestCases : undefined}
			/>

			{/* Alert cards */}
			{showWarningAlert && (
				<FarmerAlert
					variant="warning"
					message={
						profileData.status === "not_found"
							? (t("farmerAlert.notFound") as string)
							: (t("farmerAlert.error") as string)
					}
				/>
			)}

			{/* Only this area can scroll (via ChatShell/MessageList) */}
			<main className="min-h-0 flex-1 bg-transparent">
				<Outlet />
			</main>
			<div className="relative z-20">
				<ChatInput
					placeholder={t("inputPlaceholder") as string}
					value={draft}
					onValueChange={setDraft}
					onSend={async (payload: ChatInputPayload) => {
						const { text, voice } = payload;
						if (text.trim()) {
							sendText(text, language);
						} else if (voice) {
							try {
								await sendAudio(voice, sessionId || '', language);
							} catch (error) {
								console.error(error);
							}
						}
					}}
					onVoiceStart={startListening}
					onVoiceStop={stopListening}
					isListening={isListening}
					isTranscribing={isTranscribing}
					isAssistantTyping={isAssistantTyping}
					suggestions={isOnQuestionList ? [] : suggestions}
					onSuggestionClick={(text: string) => sendText(text, language)}
					topAction={questionListToggle}
					micHint={messages.length > 0 ? undefined : (t("chatMicHint") as string)}
					footerNote={t("disclaimerText") as string}
				/>
			</div>

			<SettingsDrawer
				open={settingsOpen}
				onOpenChange={handleSettingsOpenChange}
				faqExpandCategory={faqExpandCategory}
			/>

			<ProfileDialog
				open={profileOpen}
				onOpenChange={setProfileOpen}
			/>
		</div>
	);
}

export default ChatLayout;
