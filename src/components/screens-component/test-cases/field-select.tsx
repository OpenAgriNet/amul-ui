import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* eslint-disable no-unused-vars */
type FieldSelectProps = {
	id: string;
	value: string | undefined;
	onValueChange: (value: string) => void;
	options: Array<{ value: string; label: string }>;
	placeholder?: string;
	className?: string;
};
/* eslint-enable no-unused-vars */

// The dropdown of the test-case forms, in the screen's red. The menu opens below the
// field at the field's width, so it never covers the tabs or the field itself.
export function FieldSelect({ id, value, onValueChange, options, placeholder, className }: FieldSelectProps) {
	return (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger
				id={id}
				className={cn(
					"w-full min-w-0 cursor-pointer rounded-xl border-gray-200 bg-white text-[15px] text-gray-900 shadow-none transition-colors hover:border-[#F65151]/60 focus-visible:border-[#F65151] focus-visible:ring-[#F65151]/20 data-[placeholder]:text-gray-400 data-[size=default]:h-11 data-[state=open]:border-[#F65151]",
					className
				)}
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent
				position="popper"
				collisionPadding={12}
				className="max-h-72 rounded-xl border-gray-200 bg-white shadow-lg"
			>
				{options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value}
						className="min-h-10 cursor-pointer rounded-lg px-3 text-[15px] text-gray-800 focus:bg-[#FFE2E2]/60 focus:text-gray-900 data-[state=checked]:font-medium data-[state=checked]:text-[#C53030] [&_svg]:!text-[#F65151]"
					>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
