const { JsonContext, ContextValues } = require('./JsonContext');

const STRING_DELIMITERS = ['"', "'"];
const WHITESPACE = new Set([0x20, 0x09, 0x0A, 0x0D, 0xA0, 0xFEFF]); // space, tab, newline, return, NBSP, BOM
const QUOTES = new Set([0x22, 0x27]); // " and '
const DECIMAL_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

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
        if (STRING_DELIMITERS.includes(char)) return this.parseString();
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

            if (this.peek() === "}") {
                this.index++;
                break;
            }

            // Parse key
            this.context.set(ContextValues.OBJECT_KEY);
            const key = this.parseString() || this.parseUnquotedString();
            if (!key) break;

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

            if (key) {
                obj[key] = value;
            }

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

    parseString() {
        let char = this.peek();
        let isQuoted = STRING_DELIMITERS.includes(char);
        let stringAcc = "";

        // Skip leading whitespace
        while (char && /\s/.test(char)) {
            this.index++;
            char = this.peek();
        }

        if (isQuoted) {
            const quote = char;
            this.index++; // skip opening quote

            while (this.index < this.jsonStr.length) {
                char = this.peek();

                if (char === quote && this.jsonStr[this.index - 1] !== "\\") {
                    this.index++; // skip closing quote
                    break;
                }

                stringAcc += char;
                this.index++;
            }
        } else {
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
        }

        // Convert value types for object values and array elements
        if (!isQuoted && (this.context.current === ContextValues.OBJECT_VALUE || this.context.current === ContextValues.ARRAY)) {
            return this.convertStringToType(stringAcc.trim());
        }

        return stringAcc.trim();
    }

    parseNumber() {
        let numStr = "";

        while (this.index < this.jsonStr.length) {
            const char = this.peek();
            if (!/[-0-9.eE]/.test(char)) break;
            numStr += char;
            this.index++;
        }

        const num = Number(numStr);
        return isNaN(num) ? numStr : num;
    }

    parseUnquotedString() {
        let str = "";

        while (this.index < this.jsonStr.length) {
            const char = this.peek();
            if ([",", "}", "]", ":"].includes(char) || /\s/.test(char)) break;
            if (char === ")" && this.containers[this.containers.length - 1] === "(") break;
            str += char;
            this.index++;
        }

        // Convert value types for unquoted strings
        return this.convertStringToType(str.trim());
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
