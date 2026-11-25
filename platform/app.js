// Staff portal: who is signed in comes from oauth2-proxy's /oauth2/userinfo, the tiles from apps.json.
// oauth2-proxy's keycloak-oidc provider lists every Keycloak role of the access token in `groups`:
// realm roles as "role:<role>", client roles as "role:<client>:<role>".
// A tile's "access" is "any" or { client, roles }: shown to users holding any of those client roles,
// with the first one they hold (roles are listed highest first) as its badge.
// Hiding a tile is convenience only: each app checks access itself.

function heldRole(access, groups) {
	if (access === "any") return "";
	const role = access.roles.find((r) => groups.includes("role:" + access.client + ":" + r));
	return role === undefined ? null : role;
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

function tile(app, role) {
	const li = el("li", "tile");

	const shot = el("a", "shot");
	shot.href = app.url;
	shot.tabIndex = -1;
	shot.setAttribute("aria-hidden", "true");
	if (app.thumbnail) {
		const img = el("img");
		img.src = app.thumbnail;
		img.alt = "";
		img.loading = "lazy";
		shot.append(img);
	}

	const body = el("div", "tile-body");
	const head = el("div", "tile-head");
	head.append(el("h2", "tile-name", app.name));
	if (role) head.append(el("span", "badge", role.charAt(0).toUpperCase() + role.slice(1)));
	const open = el("a", "open", "Open " + app.name);
	open.href = app.url;
	body.append(head, el("p", "tile-desc", app.description), open);

	li.append(shot, body);
	return li;
}

async function main() {
	const status = document.getElementById("status");
	try {
		const [me, apps] = await Promise.all([
			fetch("/oauth2/userinfo", { credentials: "same-origin" }),
			fetch("apps.json", { cache: "no-cache" })
		]);
		if (me.status === 401) {
			// Session ended while the page was open: sign in again and come back here.
			location.assign("/oauth2/start?rd=%2F");
			return;
		}
		if (!me.ok || !apps.ok) throw new Error("userinfo " + me.status + ", apps " + apps.status);
		const user = await me.json();
		const list = await apps.json();
		const groups = Array.isArray(user.groups) ? user.groups : [];

		const name = (user.additionalClaims && user.additionalClaims.name) || user.preferredUsername || user.email || "";
		document.getElementById("who-name").textContent = name;
		document.getElementById("who").hidden = false;
		const first = name.trim().split(/\s+/)[0];
		if (first && !first.includes("@")) document.getElementById("greeting").textContent = "Hello, " + first;

		const visible = list
			.map((app) => ({ app, role: heldRole(app.access, groups) }))
			.filter((t) => t.role !== null);
		const tiles = document.getElementById("tiles");
		tiles.dataset.count = String(visible.length);
		tiles.append(...visible.map((t) => tile(t.app, t.role)));
		if (visible.length) {
			status.remove();
		} else {
			status.textContent = "No tools are open to your account yet. Ask an Amul AI administrator for the access you need.";
			status.classList.add("empty");
		}
	} catch (err) {
		status.textContent = "The portal could not load your tools. Reload the page; if it keeps failing, tell the Amul AI team.";
		status.classList.add("empty");
		console.error(err);
	}
}

main();
