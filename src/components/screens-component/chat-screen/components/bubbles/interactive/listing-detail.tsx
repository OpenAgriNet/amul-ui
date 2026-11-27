import { useMemo } from "react";
import { ExternalLink, Phone, SearchX, ShieldAlert, User } from "lucide-react";
import { factMap } from "@/lib/agui/listings";
import type { ListingDetailComponent } from "@/lib/agui/types";
import { SourceNotice } from "./listing-collection";
import { detailRows, formatWhen, headlinePrice, listingTitle } from "./listing-format";
import { AnsweredRow, ControlCard, useLabel } from "./shared";

/**
 * #641: one listing, rechecked at the source when it was opened. Seller
 * contact shows only when the source shares it. A newer search expires it.
 */
export function ListingDetail({ component }: { readonly component: ListingDetailComponent }) {
	const labels = useLabel();
	const { label, language } = labels;
	const facts = useMemo(() => factMap(component.facts), [component.facts]);

	if (component.status === "expired") {
		return <AnsweredRow label={label("listing.details")} value={label("expired")} expired />;
	}

	if (component.source_status !== "ok") {
		const gone = component.source_status === "not_found";
		return (
			<ControlCard>
				<div role="status" className="flex items-start gap-3">
					<SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<p className="text-sm text-foreground">{gone ? label("listing.gone") : label("listing.detailUnavailable")}</p>
				</div>
				<SourceNotice stale={component.stale} notice={component.notice} />
			</ControlCard>
		);
	}

	const listingNumber = facts.get("listing_number");
	const price = headlinePrice(component.purpose, facts, language);
	const rows = detailRows(component.purpose, facts, labels);
	const seller = component.seller;
	const mobile = seller?.mobile?.replace(/\s+/g, "") || null;

	return (
		<ControlCard>
			<p className="text-xs font-medium text-muted-foreground">{label("listing.details")}</p>
			<div className="flex items-start justify-between gap-2">
				<h4 className="min-w-0 wrap-break-word text-sm font-semibold capitalize text-foreground">
					{listingTitle(component.purpose, component.title, facts, labels)}
				</h4>
				{listingNumber !== undefined ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">#{String(listingNumber)}</span> : null}
			</div>
			{price ? <p className="text-base font-bold text-primary tabular-nums">{price}</p> : null}
			<SourceNotice stale={component.stale} notice={component.notice} />

			{rows.length > 0 ? (
				<dl className="mt-2 flex flex-col divide-y divide-primary/15 rounded-xl border border-primary/20 bg-background px-3">
					{rows.map((row) => (
						<div key={row.key} className="flex items-start justify-between gap-3 py-1.5 text-sm">
							<dt className="shrink-0 text-muted-foreground">{row.label}</dt>
							<dd className="min-w-0 wrap-break-word text-right font-medium text-foreground">
								{row.href ? (
									<a href={row.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
										{row.value}
										<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
									</a>
								) : (
									row.value
								)}
							</dd>
						</div>
					))}
				</dl>
			) : null}

			<div className="mt-2 rounded-xl bg-primary/5 px-3 py-2">
				<p className="text-xs font-medium text-muted-foreground">{label("listing.seller")}</p>
				{seller?.name || mobile ? (
					<div className="mt-1 flex flex-wrap items-center justify-between gap-2">
						{seller?.name ? (
							<span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
								<User className="h-4 w-4 shrink-0" aria-hidden="true" />
								<span className="wrap-break-word">{seller.name}</span>
							</span>
						) : null}
						{mobile ? (
							<a
								href={`tel:${mobile}`}
								className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground tabular-nums"
							>
								<Phone className="h-4 w-4" aria-hidden="true" />
								{seller?.mobile}
							</a>
						) : null}
					</div>
				) : (
					<p className="mt-0.5 text-sm text-foreground">{label("listing.noContact")}</p>
				)}
			</div>

			<p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
				<ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				<span>
					{label("listing.confirmBeforePaying")}
					{component.fetched_at !== null ? ` ${label("listing.checked", { date: formatWhen(component.fetched_at, language) })}` : ""}
				</span>
			</p>
		</ControlCard>
	);
}
