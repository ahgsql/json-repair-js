const { JsonContext, ContextValues } = require('./JsonContext');

const WHITESPACE = new Set([0x20, 0x09, 0x0A, 0x0D, 0xA0, 0xFEFF]); // space, tab, newline, return, NBSP, BOM
const DECIMAL_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

// Quote characters. Besides the ASCII ones, LLMs and word processors produce
// typographic ("smart") quotes, which are accepted as string delimiters too.
const DOUBLE_SMART_QUOTES = new Set(["\u201C", "\u201D", "\u201E", "\u201F"]); // “ ” „ ‟
const SINGLE_SMART_QUOTES = new Set(["\u2018", "\u2019", "\u201A", "\u201B"]); // ‘ ’ ‚ ‛
const CLOSERS_FOR_DOUBLE_SMART = new Set(["\u201C", "\u201D", '"']);
const CLOSERS_FOR_SINGLE_SMART = new Set(["\u2018", "\u2019", "'"]);

function isQuoteChar(char) {
    return char === '"' || char === "'" || DOUBLE_SMART_QUOTES.has(char) || SINGLE_SMART_QUOTES.has(char);
}

/** The characters that may close a string opened with `open`. */
function closingQuotes(open) {
    if (open === '"') return DOUBLE_QUOTE_ONLY;
    if (open === "'") return SINGLE_QUOTE_ONLY;
    return DOUBLE_SMART_QUOTES.has(open) ? CLOSERS_FOR_DOUBLE_SMART : CLOSERS_FOR_SINGLE_SMART;
}
const DOUBLE_QUOTE_ONLY = new Set(['"']);
const SINGLE_QUOTE_ONLY = new Set(["'"]);

const SIMPLE_ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "/": "/", "\\": "\\" };

// Sticky patterns used to peek at what follows a quote (see isClosingQuote)
const OBJECT_KEY_AHEAD = /[A-Za-z_$][\w$-]*\s*(?::|$)/y; // an unquoted key, or the input ends
const ARRAY_ELEMENT_AHEAD = /(?:-?\d|[A-Za-z_]+\s*(?:[,\])]|$))/y; // a number or a bare word
const NUMBER_TOKEN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
const NUMBER_END = /[\s,\]})\/:]/;

/** Assigns an own property, also for keys like "__proto__" (as JSON.parse does). */
function setOwn(obj, key, value) {
    Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

class JsonParser {
    constructor (jsonStr = "", logging = false) {
        this.jsonStr = jsonStr;
        this.index = 0;
        this.context = new JsonContext();
        this.logging = logging;
        this.logger = [];
        // Stack of the containers being parsed: '{', '[' or '(' (Python tuple)
        this.containers = [];
    }

    log(text) {
        if (!this.logging) return;
        const window = 10;
        const start = Math.max(this.index - window, 0);
        const end = Math.min(this.index + window, this.jsonStr.length);
        const context = this.jsonStr.slice(start, end);
        this.logger.push({ text, context });
    }

    parse() {
        // Find the first { or [ in the string
        let inBackticks = false;
        let foundJson = false;

        while (this.index < this.jsonStr.length) {
            const char = this.peek();

            // Handle code blocks in markdown/text
            if (char === '`') {
                if (this.jsonStr.slice(this.index, this.index + 3) === '```') {
                    inBackticks = !inBackticks;
                    this.index += 3;
                    continue;
                }
            }

            // Look for JSON start
            if (char === '{' || char === '[') {
                foundJson = true;
                break;
            }

            this.index++;
        }

        if (!foundJson) {
            return "";
        }

        const result = this.parseValue();
        return this.logging ? [result, this.logger] : result;
    }

    parseValue() {
        this.skipWhitespace();
        const char = this.peek();

        if (!char) return "";

        if (char === "{") return this.parseObject();
        if (char === "[") return this.parseArray();
        if (char === "(") return this.parseArray(")"); // Python tuple -> array
        if (isQuoteChar(char)) return this.parseString();
        // "-Infinity" and similar: a minus sign followed by a letter is a word, not a number
        if (char === "-" && /[a-zA-Z]/.test(this.jsonStr[this.index + 1] || "")) return this.parseUnquotedString();
        if (/[-0-9]/.test(char)) return this.parseNumber();
        if (/[a-zA-Z]/.test(char)) return this.parseUnquotedString();

        this.index++;
        return "";
    }

    parseObject() {
        const obj = {};
        this.index++; // skip {
        this.containers.push("{");

        while (this.index < this.jsonStr.length) {
            this.skipWhitespace();

            // Stray commas, e.g. {"a": 1,, "b": 2}
            while (this.peek() === ",") {
                this.index++;
                this.skipWhitespace();
            }

            if (this.index >= this.jsonStr.length) break;

            if (this.peek() === "}") {
                this.index++;
                break;
            }

            // Parse key
            this.context.set(ContextValues.OBJECT_KEY);
            const keyStart = this.index;
            const key = this.parseString(true) || this.parseUnquotedString(false);
            // Nothing could be read as a key (an empty quoted key "" is fine)
            if (key === "" && this.index === keyStart) break;

            this.skipWhitespace();

            // Handle missing colon
            if (this.peek() !== ":") {
                this.log("Missing colon after key, adding it");
            } else {
                this.index++; // skip :
            }

            this.skipWhitespace();

            // Parse value
            this.context.reset();
            this.context.set(ContextValues.OBJECT_VALUE);
            const value = this.parseValue();
            this.context.reset();

            setOwn(obj, key, value);

            this.skipWhitespace();

            // Handle comma
            if (this.peek() === ",") {
                this.index++;
            }
        }

        this.containers.pop();
        return obj;
    }

    parseArray(closer = "]") {
        const arr = [];
        this.index++; // skip [ (or ( for tuples)
        this.containers.push(closer === ")" ? "(" : "[");
        this.context.set(ContextValues.ARRAY);

        while (this.index < this.jsonStr.length) {
            this.skipWhitespace();

            // Nothing left (e.g. trailing comma or comment at the end of the input)
            if (this.index >= this.jsonStr.length) break;

            // The expected closer, or a mismatched one such as "}" in "[1, 2}"
            if (this.peek() === closer || this.peek() === "]" || this.peek() === "}" || this.peek() === ")") {
                this.index++;
                break;
            }

            const value = this.parseValue();
            if (value !== undefined) {
                arr.push(value);
            }

            this.skipWhitespace();

            // Handle comma
            if (this.peek() === ",") {
                this.index++;
            }
        }

        this.context.reset();
        this.containers.pop();
        return arr;
    }

    parseString(isKey = false) {
        this.skipWhitespace();
        let char = this.peek();
        const isQuoted = isQuoteChar(char);
        let stringAcc = "";

        if (isQuoted) {
            const closers = closingQuotes(char);
            this.index++; // skip opening quote

            while (this.index < this.jsonStr.length) {
                char = this.peek();

                if (char === "\\") {
                    stringAcc += this.readEscape();
                    continue;
                }

                if (closers.has(char) && this.isClosingQuote(this.index, isKey)) {
                    this.index++; // skip closing quote
                    break;
                }

                stringAcc += char;
                this.index++;
            }

            return stringAcc;
        }

        // For unquoted strings, collect until delimiter
        while (this.index < this.jsonStr.length) {
            char = this.peek();

            if ([",", "}", "]", ":"].includes(char)) {
                break;
            } else if (/\s/.test(char)) {
                // Skip whitespace between words
                if (stringAcc && this.index < this.jsonStr.length - 1) {
                    const nextChar = this.jsonStr[this.index + 1];
                    if (!/[,}\]:]/.test(nextChar)) {
                        stringAcc += " ";
                    }
                }
            } else {
                stringAcc += char;
            }

            this.index++;
        }

        // Convert value types for object values and array elements
        if (this.context.current === ContextValues.OBJECT_VALUE || this.context.current === ContextValues.ARRAY) {
            return this.convertStringToType(stringAcc.trim());
        }

        return stringAcc.trim();
    }

    /**
     * Decodes the escape sequence at the current index (which points at the
     * backslash), moves past it and returns the text it stands for.
     */
    readEscape() {
        const str = this.jsonStr;
        const next = str[this.index + 1];

        // A lone backslash at the very end of the input
        if (next === undefined) {
            this.index = str.length;
            return "";
        }

        if (next === "u") {
            const hex = str.slice(this.index + 2, this.index + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                this.index += 6;
                return String.fromCharCode(parseInt(hex, 16));
            }
            // \uXX cut off by the end of the input: drop the unfinished escape
            if (hex.length < 4 && /^[0-9a-fA-F]*$/.test(hex)) {
                this.index = str.length;
                return "";
            }
            this.index += 2;
            return "\\u";
        }

        this.index += 2;
        if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, next)) return SIMPLE_ESCAPES[next];
        if (isQuoteChar(next)) return next; // \" \' and escaped smart quotes
        return "\\" + next; // unknown escape such as \d or \U: keep it as written
    }

    /**
     * Decides whether the quote at `quotePos` ends the string or is an
     * unescaped quote that is part of its text, e.g. {"a": "say "hi" now"}.
     * It looks at what follows the quote: a closing bracket, the end of the
     * input, or a comma / whitespace followed by something that looks like the
     * next key or value means the string ends here.
     */
    isClosingQuote(quotePos, isKey) {
        if (isKey) return true;

        const str = this.jsonStr;
        const next = this.skipWhitespaceFrom(quotePos + 1);
        const sawSpace = next > quotePos + 1;

        if (next >= str.length) return true;

        const char = str[next];
        if (char === "}" || char === "]" || char === ")") return true;
        if (char === ",") return this.startsNewElement(this.skipWhitespaceFrom(next + 1));
        if (char === ":") return false;
        // Another string right after: `"a" "b"` is a missing comma, `"a""b"` is not
        if (isQuoteChar(char)) return sawSpace;

        return sawSpace && this.looksLikeElement(next);
    }

    /** Whether a new key (in an object) or element (in an array) starts at `pos`. */
    startsNewElement(pos) {
        if (pos >= this.jsonStr.length) return true;
        const char = this.jsonStr[pos];
        if (isQuoteChar(char) || "{[}]()".includes(char)) return true;
        return this.looksLikeElement(pos);
    }

    looksLikeElement(pos) {
        const pattern = this.containers[this.containers.length - 1] === "{" ? OBJECT_KEY_AHEAD : ARRAY_ELEMENT_AHEAD;
        pattern.lastIndex = pos;
        return pattern.test(this.jsonStr);
    }

    parseNumber() {
        NUMBER_TOKEN.lastIndex = this.index;
        const match = NUMBER_TOKEN.exec(this.jsonStr);
        if (!match) return this.parseUnquotedString();

        const end = this.index + match[0].length;
        const after = this.jsonStr[end];
        // Things like 1.2.3, 0x10 or 12px are words, not numbers
        if (after !== undefined && !NUMBER_END.test(after)) return this.parseUnquotedString();

        const num = Number(match[0]);
        if (!Number.isFinite(num)) return this.parseUnquotedString(); // 1e999
        this.index = end;
        return num;
    }

    parseUnquotedString(convert = true) {
        let str = "";

        while (this.index < this.jsonStr.length) {
            const char = this.peek();
            if ([",", "}", "]", ":"].includes(char) || /\s/.test(char)) break;
            if (char === ")" && this.containers[this.containers.length - 1] === "(") break;
            str += char;
            this.index++;
        }

        // Convert value types for unquoted strings
        return convert ? this.convertStringToType(str.trim()) : str.trim();
    }

    /**
     * convert string to number, boolean, null
     * @param {string} str - the string to convert
     * @returns {*} the converted value; empty input and "null" give null,
     *              anything that is not a plain JSON-style number, boolean
     *              or null is returned unchanged as a string
     */
    convertStringToType(str) {
        if (!str || str === "") return null;

        // Try number. Only plain decimal notation is accepted: Number() would
        // also turn "Infinity", "0x10" or "0b1" into numbers, and Infinity
        // cannot be represented in JSON (JSON.stringify turns it into null).
        if (DECIMAL_NUMBER.test(str)) {
            const num = Number(str);
            if (Number.isFinite(num)) return num;
        }

        // Try boolean/null
        const lower = str.toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
        if (lower === "null" || lower === "none") return null; // "None" is the Python spelling

        return str; // cannot convert
    }

    skipWhitespace() {
        this.index = this.skipWhitespaceFrom(this.index);
    }

    /**
     * Returns the first index at or after `pos` that is neither whitespace nor
     * part of a comment. Supports `// line` and `/* block *\/` comments, which
     * LLMs like to add to the JSON they produce.
     */
    skipWhitespaceFrom(pos) {
        const str = this.jsonStr;
        while (pos < str.length) {
            const code = str.charCodeAt(pos);
            if (WHITESPACE.has(code)) {
                pos++;
            } else if (code === 0x2F && str.charCodeAt(pos + 1) === 0x2F) {
                // line comment: up to the end of the line
                pos += 2;
                while (pos < str.length && str[pos] !== "\n" && str[pos] !== "\r") pos++;
            } else if (code === 0x2F && str.charCodeAt(pos + 1) === 0x2A) {
                // block comment: up to the closing marker (or the end of the input)
                const end = str.indexOf("*/", pos + 2);
                pos = end === -1 ? str.length : end + 2;
            } else {
                break;
            }
        }
        return pos;
    }

    peek() {
        return this.jsonStr[this.index];
    }
}

module.exports = JsonParser;
