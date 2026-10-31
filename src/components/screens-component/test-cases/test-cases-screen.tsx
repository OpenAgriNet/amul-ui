import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessagesSquare, PenLine, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast, type ToastType } from "@/components/screens-component/chat-screen/components/toast";
import { useLanguage } from "@/components/LanguageProvider";
import { useChatStore } from "@/hooks/store/chat";
import { useTestCaseStore, type TestCaseTab } from "@/hooks/store/test-cases";
import { turnsFromChat } from "@/lib/test-cases/draft";
import { useTestCaseOptions } from "@/hooks/store/test-cases/options";
import { BulkUpload } from "./bulk-upload";
import { DraftEditor } from "./draft-editor";
import { FieldSelect } from "./field-select";

const TAB_TRIGGER_CLASS =
	"min-h-10 flex-1 gap-1.5 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:text-[#C53030] data-[state=active]:shadow-sm";

export function TestCasesScreen() {
	const navigate = useNavigate();
	const { language } = useLanguage();
	const messages = useChatStore((s) => s.messages);
	const sessionId = useChatStore((s) => s.sessionId);
	const persona = useChatStore((s) => s.persona);
	const {
		tab,
		setTab,
		submittedBy,
		setSubmittedBy,
		chatDraft,
		manualDraft,
		importChat,
		updateDraft,
		resetDraft
	} = useTestCaseStore();
	const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
	const closeToast = useCallback(() => setToast(null), []);

	const chatTurnCount = turnsFromChat(messages).length;
	const optionsStatus = useTestCaseOptions((s) => s.status);
	const options = useTestCaseOptions((s) => s.options);
	const optionsError = useTestCaseOptions((s) => s.error);
	const loadOptions = useTestCaseOptions((s) => s.load);
	useEffect(() => {
		void loadOptions();
	}, [loadOptions]);
	// The Write tab starts in the app language and the chat's persona; the tester can change both.
	const writeDraft = useMemo(
		() => ({
			...manualDraft,
			language: manualDraft.language ?? language,
			persona: manualDraft.persona ?? persona
		}),
		[manualDraft, language, persona]
	);
	const testers = options?.testers ?? [];
	// A saved tester who is no longer on the list has to choose again.
	const testerId = testers.some((tester) => tester.id === submittedBy) ? submittedBy : "";
	const importCurrentChat = () => importChat(messages, { sessionId, language, persona });

	// Coming from the clipboard icon in the chat: import that chat unless this
	// session's draft is already here (it may hold edits).
	useEffect(() => {
		const { chatDraft: draft } = useTestCaseStore.getState();
		if (chatTurnCount > 0 && (!draft || draft.sessionId !== (sessionId ?? undefined))) {
			importChat(useChatStore.getState().messages, { sessionId, language, persona });
		}
		// Only on arrival; later chat changes are offered through "Re-import".
	}, []);

	const chatHasNewTurns =
		chatDraft !== null &&
		chatDraft.sessionId === (sessionId ?? undefined) &&
		chatTurnCount > chatDraft.turns.length;

	const reimport = () => {
		if (window.confirm("Replace this draft with the current chat? Your edits here will be lost."))
			importCurrentChat();
	};

	const onSubmitted = (kind: "chat" | "manual") => () => {
		resetDraft(kind);
		setToast({ message: "Test case submitted. Thank you!", type: "success" });
	};
	const onSubmitFailed = (message: string) => setToast({ message, type: "error" });

	return (
		<div className="layout-gradient flex h-svh w-full flex-col overflow-hidden text-foreground">
			{toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

			<header className="z-10 w-full border-b border-[#E3E3E3] bg-white">
				<div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Back to chat"
						onClick={() => navigate({ to: "/chat" })}
						className="size-[44px] shrink-0 rounded-full border border-[#F65151]/50 bg-[#FFE2E2]/60 text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
					>
						<ArrowLeft className="size-5" />
					</Button>
					<div className="min-w-0">
						<h1 className="truncate text-lg font-bold text-gray-900">Add test cases</h1>
						<p className="truncate text-xs text-gray-500">For the Amul AI testing dataset</p>
					</div>
					<span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
						Dev only
					</span>
				</div>
			</header>

			<Tabs
				value={tab}
				onValueChange={(value) => setTab(value as TestCaseTab)}
				className="min-h-0 flex-1 gap-0"
			>
				<div className="border-b border-[#E3E3E3] bg-white/70">
					<div className="mx-auto max-w-3xl px-4 py-2">
						<TabsList className="h-auto w-full rounded-full bg-gray-100 p-1">
							<TabsTrigger value="chat" className={TAB_TRIGGER_CLASS}>
								<MessagesSquare className="size-4" />
								From chat
							</TabsTrigger>
							<TabsTrigger value="manual" className={TAB_TRIGGER_CLASS}>
								<PenLine className="size-4" />
								Write
							</TabsTrigger>
							<TabsTrigger value="bulk" className={TAB_TRIGGER_CLASS}>
								<Upload className="size-4" />
								Bulk upload
							</TabsTrigger>
						</TabsList>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto max-w-3xl px-4 pt-4">
						{!options ? (
							<div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
								{optionsStatus === "error" ? (
									<>
										<p className="text-base font-semibold text-gray-900">
											Couldn't load the tester and test type lists
										</p>
										<p className="max-w-md text-sm text-gray-600">
											{optionsError ?? "Check your connection and sign-in, then try again."}
										</p>
										<Button
											type="button"
											onClick={() => void loadOptions()}
											className="min-h-11 rounded-full bg-[#F65151] px-6 text-white hover:bg-[#D93B3B]"
										>
											Try again
										</Button>
									</>
								) : (
									<p className="text-sm text-gray-600">Loading the lists…</p>
								)}
							</div>
						) : (
							<>
								<div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
									<Label
										htmlFor="test-case-tester"
										className="shrink-0 text-sm font-semibold text-gray-900"
									>
										Tester <span className="text-[#F65151]">*</span>
									</Label>
									<FieldSelect
										id="test-case-tester"
										value={testerId}
										onValueChange={setSubmittedBy}
										options={testers.map((tester) => ({ value: tester.id, label: tester.label }))}
										placeholder="Choose your name"
										className="flex-1"
									/>
								</div>
								<TabsContent value="chat">
									{chatDraft && chatDraft.turns.length > 0 ? (
										<DraftEditor
											key={chatDraft.sessionId ?? "chat"}
											draft={chatDraft}
											submittedBy={testerId}
											onChange={(update) => updateDraft("chat", update)}
											onSubmitted={onSubmitted("chat")}
											onSubmitFailed={onSubmitFailed}
											conversationActions={
												chatHasNewTurns || chatDraft.sessionId !== (sessionId ?? undefined) ? (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={reimport}
														className="text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
													>
														<RefreshCw className="size-4" />
														{chatHasNewTurns
															? "Chat has new messages: re-import"
															: "Import current chat"}
													</Button>
												) : null
											}
										/>
									) : (
										<div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
											<MessagesSquare className="size-10 text-[#F65151]" />
											{chatTurnCount > 0 ? (
												<>
													<p className="text-base font-semibold text-gray-900">
														Turn your current chat into a test case
													</p>
													<p className="max-w-md text-sm text-gray-600">
														Review every message, fix wrong answers, remove what doesn't matter,
														then describe what it tests.
													</p>
													<Button
														type="button"
														onClick={importCurrentChat}
														className="min-h-11 rounded-full bg-[#F65151] px-6 text-white hover:bg-[#D93B3B]"
													>
														Use current chat ({chatTurnCount} messages)
													</Button>
												</>
											) : (
												<>
													<p className="text-base font-semibold text-gray-900">No chat yet</p>
													<p className="max-w-md text-sm text-gray-600">
														Chat with Amul AI first, then open this screen again from the clipboard
														icon at the top of the chat. Or write the conversation by hand.
													</p>
													<div className="flex flex-wrap justify-center gap-2">
														<Button
															type="button"
															onClick={() => navigate({ to: "/chat" })}
															className="min-h-11 rounded-full bg-[#F65151] px-6 text-white hover:bg-[#D93B3B]"
														>
															Go to chat
														</Button>
														<Button
															type="button"
															variant="outline"
															onClick={() => setTab("manual")}
															className="min-h-11 rounded-full border-[#F65151] bg-white px-6 text-[#F65151] hover:bg-[#FFE2E2] hover:text-[#D93B3B]"
														>
															Write by hand
														</Button>
													</div>
												</>
											)}
										</div>
									)}
								</TabsContent>

								<TabsContent value="manual">
									<DraftEditor
										draft={writeDraft}
										submittedBy={testerId}
										onChange={(update) => updateDraft("manual", update)}
										onSubmitted={onSubmitted("manual")}
										onSubmitFailed={onSubmitFailed}
									/>
								</TabsContent>

								<TabsContent value="bulk" className="pb-4">
									<BulkUpload
										submittedBy={testerId}
										onFinished={({ submitted, failed }) =>
											setToast(
												failed > 0
													? {
															message: `${submitted} submitted, ${failed} failed. Try the failed ones again.`,
															type: "error"
														}
													: {
															message: `${submitted} test case${submitted === 1 ? "" : "s"} submitted. Thank you!`,
															type: "success"
														}
											)
										}
									/>
								</TabsContent>
							</>
						)}
					</div>
				</div>
			</Tabs>
		</div>
	);
}
