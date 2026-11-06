import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Library, MessagesSquare, PenLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast, type ToastType } from "@/components/screens-component/chat-screen/components/toast";
import { useLanguage } from "@/components/LanguageProvider";
import { useChatStore } from "@/hooks/store/chat";
import { useTestCaseStore, type TestCaseTab } from "@/hooks/store/test-cases";
import { turnsFromChat } from "@/lib/test-cases/draft";
import { useTestCaseOptions } from "@/hooks/store/test-cases/options";
import { BulkUpload } from "./bulk-upload";
import { DatasetView } from "./dataset-view";
import { DraftEditor } from "./draft-editor";
import { FieldSelect } from "./field-select";

// Four tabs don't fit a phone with their icons, so the icons show from tablet width up.
const TAB_TRIGGER_CLASS =
	"min-h-10 flex-1 gap-1.5 rounded-full px-1 text-sm data-[state=active]:bg-white data-[state=active]:text-[#C53030] data-[state=active]:shadow-sm max-sm:[&_svg]:hidden sm:px-2";

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
		chatDraftEdited,
		manualDraft,
		syncChat,
		loadChat,
		chatSubmitted,
		updateDraft,
		resetManualDraft
	} = useTestCaseStore();
	const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
	const closeToast = useCallback(() => setToast(null), []);

	const chatTurnCount = useMemo(() => turnsFromChat(messages).length, [messages]);
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
	// The chat draft follows the chat: new messages join it and keep the edits made.
	// A new draft takes the app language; an existing one keeps its own.
	const chatMeta = () => ({ sessionId, language, persona });
	useEffect(() => {
		syncChat(messages, { sessionId, language, persona });
	}, [messages, sessionId, language, persona, syncChat]);

	// A newer chat is open but the draft holds edits from the earlier one, so it wasn't
	// replaced. (An unedited draft is replaced right away and needs no notice.) The
	// button shows once the new chat has an answered question to load.
	const draftFromOtherChat =
		chatDraft !== null && chatDraftEdited && chatDraft.sessionId !== (sessionId ?? undefined);

	const onSubmitted = (kind: "chat" | "manual") => () => {
		if (kind === "chat") chatSubmitted(messages, chatMeta());
		else resetManualDraft();
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
							<TabsTrigger value="dataset" className={TAB_TRIGGER_CLASS}>
								<Library className="size-4" />
								Dataset
							</TabsTrigger>
						</TabsList>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto">
					{/* The dataset table uses the full width; the forms stay at reading width. */}
					<div className={cn("mx-auto px-4 pt-4", tab === "dataset" ? "max-w-none" : "max-w-3xl")}>
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
								{/* The dataset view only reads, so it needs no tester. */}
								{tab !== "dataset" && (
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
								)}
								<TabsContent value="chat">
									{draftFromOtherChat && (
										<div
											role="status"
											className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
										>
											<p className="min-w-0 flex-1">
												{chatTurnCount > 0
													? "You started a new chat. This draft is from the earlier one and has your edits."
													: "You started a new chat. This draft is still from the earlier one. Once the new chat has an answer, you can load it here."}
											</p>
											{chatTurnCount > 0 && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => loadChat(messages, chatMeta())}
													className="min-h-9 rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100 hover:text-amber-950"
												>
													Load the new chat
												</Button>
											)}
										</div>
									)}
									{chatDraft ? (
										<DraftEditor
											key={chatDraft.sessionId ?? "chat"}
											draft={chatDraft}
											submittedBy={testerId}
											onChange={(update) => updateDraft("chat", update)}
											onSubmitted={onSubmitted("chat")}
											onSubmitFailed={onSubmitFailed}
										/>
									) : (
										<div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
											<MessagesSquare className="size-10 text-[#F65151]" />
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
										options={options}
										onFinished={({ submitted, failed, notSent }) =>
											setToast(
												failed > 0
													? {
															message:
																notSent > 0
																	? `${submitted} submitted, ${failed} failed, ${notSent} not sent. Fix the problem, then submit again.`
																	: `${submitted} submitted, ${failed} failed. Try the failed ones again.`,
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

								<TabsContent value="dataset">
									<DatasetView options={options} />
								</TabsContent>
							</>
						)}
					</div>
				</div>
			</Tabs>
		</div>
	);
}
