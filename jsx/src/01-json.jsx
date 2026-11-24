/* ------------------------------------------------------------------ JSON -- */

function inflect_quote(s) {
    s = String(s);
    var out = '"';
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), code = s.charCodeAt(i);
        if (c === '"') out += '\\"';
        else if (c === '\\') out += '\\\\';
        else if (c === '\n') out += '\\n';
        else if (c === '\r') out += '\\r';
        else if (c === '\t') out += '\\t';
        else if (code < 32) out += '\\u' + ('0000' + code.toString(16)).slice(-4);
        else out += c;
    }
    return out + '"';
}

function inflect_stringify(v) {
    if (v === null || v === undefined) return 'null';
    var t = typeof v;
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'string') return inflect_quote(v);
    if (v instanceof Array) {
        var a = [];
        for (var i = 0; i < v.length; i++) a.push(inflect_stringify(v[i]));
        return '[' + a.join(',') + ']';
    }
    var parts = [];
    for (var k in v) {
        if (v.hasOwnProperty(k) && typeof v[k] !== 'function') {
            parts.push(inflect_quote(k) + ':' + inflect_stringify(v[k]));
        }
    }
    return '{' + parts.join(',') + '}';
}

function inflect_parse(s) {
    // Input proveniente solo dal nostro pannello o dai nostri file.
    if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(s);
    return eval('(' + s + ')');
}


