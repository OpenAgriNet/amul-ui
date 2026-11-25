// Staff portal: who is signed in comes from oauth2-proxy's /oauth2/userinfo, the tiles from apps.json.
// oauth2-proxy's keycloak-oidc provider lists every Keycloak role of the access token in `groups`:
// realm roles as "role:<role>", client roles as "role:<client>:<role>".
// A tile's "role" is "any", "<client>:<role>", or "<client>:*" (any role of that client).
// Hiding a tile is convenience only: each app checks access itself.

function allowed(role, groups) {
	if (role === "any") return true;
	if (role.endsWith(":*")) {
		const prefix = "role:" + role.slice(0, -1);
		return groups.some((g) => g.startsWith(prefix));
	}
	return groups.includes("role:" + role);
}

function tile(app) {
	const li = document.createElement("li");
	const a = document.createElement("a");
	a.className = "tile";
	a.href = app.url;
	const name = document.createElement("strong");
	name.textContent = app.name;
	const desc = document.createElement("span");
	desc.textContent = app.description;
	a.append(name, desc);
	li.append(a);
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

		const name = (user.additionalClaims && user.additionalClaims.name) || user.preferredUsername || user.email;
		document.getElementById("who-name").textContent = name;
		document.getElementById("who").hidden = false;

		const visible = list.filter((app) => allowed(app.role, groups));
		document.getElementById("tiles").append(...visible.map(tile));
		status.textContent = visible.length
			? ""
			: "No tools are assigned to your account yet. Ask an administrator for access.";
	} catch (err) {
		status.textContent = "Could not load the portal. Reload the page to try again.";
		console.error(err);
	}
}

main();
