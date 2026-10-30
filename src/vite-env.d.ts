/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ENABLE_DOCTOR_PERSONA_SELECTOR?: string;
	readonly VITE_ENABLE_TEST_CASE_ENTRY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module 'uuid';
