
let STATE = {}

async function go() {
	const el = document.querySelector("#workshop")

	el.innerHTML = await render_workshop()

	load_selected()

	setInterval(try_update_command, 10000)
}

function now_unix() {
	return Math.floor(new Date().getTime() / 1000)
}

function try_update_command() {
	let r = STATE.restrictions
	if (r && r.duration) {
		let updated = now_unix() + r.duration
		if (updated != r.time) {
			r.time = updated
			update_command(STATE.restrictions)
		}
	}
}

function get_rpcs() {
	return fetch("schemas.json").then(res => res.json())
}

function load_selected() {
	//const method = window.location.hash.substr(1) || "commando"

	//select_method(method)
}

function duration_scale_multiplier(v) {
	switch (v) {
		case "minutes": return 60
		case "hours":   return 60*60
		case "days":    return 60*60*24
		case "weeks":   return 60*60*24*7
		case "months":  return 60*60*24*30
		case "years":   return 60*60*24*365
	}

	return 0
}

function change_duration() {
	const value = document.querySelector("#duration-input").value
	const scale = document.querySelector("#duration-scale").value
	const mod = duration_scale_multiplier(scale)

	let r = STATE.restrictions = STATE.restrictions || {}

	if (value) {
		r.duration = mod * value
		r.time = (Math.floor(new Date().getTime() / 1000)) + r.duration
	} else {
		delete r.time
		delete r.duration
	}

	update_command(r)
}

function render_time_restriction()
{
	return `
	<span class="param-name">Duration</span>
	<input type="number" onkeyup="change_duration()" id="duration-input"></input>
	<select onchange="change_duration()" id="duration-scale">
	  <option value=minutes>Minutes</option>
	  <option value=hours>Hours</option>
	  <option value=days>Days</option>
	  <option value=weeks>Weeks</option>
	  <option value=months>Months</option>
	  <option value=years>Years</option>
	</select>
	`
}

function change_id(el)
{
	const r = STATE.restrictions = STATE.restrictions || {}

	r.id = el.value

	update_command(r)
}

function render_id_restriction()
{
	return `
	<span class="param-name">Node ID</span>
	<input style="width: 100%" type="text" onkeyup="change_id(this)" id="id-input"></input>
	`
}

function render_rate_restriction()
{
	return `
	<span class="param-name">Rate</span>
	<input type="number" onkeyup="change_rate(this)" id="rate-input"></input>
	Requests Per Minute
	`
}

function change_rate(el) {
	const r = STATE.restrictions = STATE.restrictions || {}

	r.rate = el.value

	update_command(r)
}

function render_generic_restrictions_section(rpcs)
{
	return `
	<h2>Restrictions</h2>
	<div>
		${render_id_restriction()}
	</div>
	<div>
		${render_time_restriction()}
	</div>
	<div>
		${render_rate_restriction()}
	</div>
	<div>
		<span class="param-name">Method</span>
		${render_method_selector(rpcs)}
	</div>
	`
}

async function render_workshop() {
	const rpcs = await get_rpcs()
	STATE.rpcs = rpcs

	return `
	${render_generic_restrictions_section(rpcs)}
	<div id="method">
	</div>
	`
}

function select_method(sel) {
	const method = sel.value
	const el = document.querySelector("#method")
	STATE.restrictions = STATE.restrictions || {}
	STATE.restrictions.params = {}

	if (method) {
		let rpc = STATE.rpcs[method]
		rpc.method = method
		update_restriction({method})
		el.innerHTML = render_rpc(rpc)
	} else {
		update_command(STATE.restrictions)
		el.innerHTML = ""
	}

}

function render_rpc(rpc) {
	const params = render_params(rpc)

	return `
	<h2>${rpc.method} parameters</h2>

	${params}
	
	<pre>${JSON.stringify(rpc,null,4)}</pre>
	`
}

function render_params(rpc) {
	const required = rpc.required.reduce((obj, param) => {
		obj[param] = true
		return obj
	}, {})

	const params = Object.keys(rpc.properties)

	return params.map(p => render_param(required, rpc, p)).join("\n")
}

function render_type(p)
{
	let type = p.type;
	if (p.type === "array" && p.items) {
		type = `[${p.items.type}]`
	}
	return `<span class="badge type-${p.type}">${type}</span>`
}

function get_description(p)
{
	if (p.oneOf) {
		return p.oneOf.map(o => o.description).filter(d => d).join("<br/><br/>")
	}
	
	return p.description;
}

/*
 * 58	object
 * 54	string
 * 22	array
 * 21	u32
 * 18	pubkey
 * 15	msat
 * 13	u64
 * 11	hex
 * 11	boolean
 * 10	u16
 * 7	short_channel_id
 * 6	number
 * 6	hash
 * 6	feerate
 * 4	outpoint
 * 3	txid
 * 3	secret
 * 3	integer
 * 2	msat_or_all
 * 1	short_channel_id_dir
 * 1	outputdesc
 * 1	msat_or_any
 * 1	hexstr
 * 1	addresstype
 */
function get_type(p) {
	// TODO: oneOf stuff
	return p.type
}

function get_input_type(type) {
	switch (type) {
		case "u16":
		case "number":
		case "u32": 
		case "u64": return "number"

		case "string": return "text"
		default: return "text"
	}
}

function render_type_options(type)
{
	if (type === 'number') {
		return `
		<option value="=">Equals</option>
		<option value=">">Greater Than</option>
		<option value="<">Less Than</option>
		`
	}

	return `
	    <option value="=">Equals</option>
	    <option value="^">Starts With</option>
	`
}

function update_restriction(data)
{
	let r = STATE.restrictions = STATE.restrictions || {}
	r = r.params = r.params || {}

	let v = r[data.method] = r[data.method] || {}

	if (data.param_name) {
		const selkey = selector_key(data.method, data.param_name)
		const value = document.querySelector(`#${selkey}-input`).value
		const op = document.querySelector(`#${selkey}`).value
		v[data.param_name] = {value,op}
		if (value === "") {
			delete v[data.param_name]
		}
	}

	update_command(STATE.restrictions)
}

function update_command(r)
{
	const command_el = document.querySelector("#command")
	command_el.value = build_command(r)
}

function restriction(v, old=true) {
	if (old) {
		return v
	} else {
		return [v]
	}
}

function build_command(r)
{
	let rs = []
	if (r.params) {
		for (const method of Object.keys(r.params)) {
			rs.push(restriction(`method=${method}`))

			for (const pname of Object.keys(r.params[method])) {
				const {value, op} = r.params[method][pname]
				rs.push(restriction(`pname${pname}${op}${value}`))
			}
		}
	}

	if (r.rate) {
		rs.push(restriction(`rate=${r.rate}`))
	}

	if (r.time) {
		rs.push(restriction(`time<${r.time}`))
	}

	if (r.id) {
		rs.push(restriction(`id=${r.id}`))
	}

	const out = JSON.stringify(rs)

	return `lightning-cli commando-rune restrictions='${out}'`
}

function selector_key(method, param_name)
{
	return method + param_name
}

function render_restriction_tool(rpc, param_name, param)
{
	const type = get_type(param) || "string"
	const input_type = get_input_type(type)

	const method = rpc.method
	const json_p = JSON.stringify({ method, param_name, param })
	const selkey = selector_key(method, param_name)
	const updater = `update_restriction(${json_p})`

	return `
	<div class="restriction-tool">
	  <select onchange='${updater}' id="${selkey}">
		${render_type_options(input_type)}
	  </select>
	  <input id='${selkey}-input' onkeyup='${updater}' type="${input_type}"></input>
	</div>
	`
}

function render_param(required, rpc, param) {
	const p = rpc.properties[param]

	const is_req = !!required[param]
	const req = is_req ? "param-required" : ""
	const desc = get_description(p)
	const typ = get_type(p)

	return `
	<span class="param-name ${req}">${param}</span>
	${render_type(p)}
	<!--
		<span class="required">${is_req? "required" : ""}</span>
	-->
	<blockquote>
		${desc}
		${render_restriction_tool(rpc, param, p)}
	</blockquote>
	`
}

function render_method_selector(rpcs) {
	let methods = Object.keys(rpcs)
	methods.unshift("")
	
	const options = methods.map(method =>
		`<option id="${method}" value="${method}">${method}</option>`)
		.join("\n")

	return `
	<select id="method_selector" onchange="select_method(this)">
		${options}
	</select>
	`
}


go()
