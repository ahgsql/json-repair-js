const { JsonContext, ContextValues } = require('./JsonContext');

const STRING_DELIMITERS = ['"', "'"];
const WHITESPACE = new Set([0x20, 0x09, 0x0A, 0x0D]); // space, tab, newline, return
const QUOTES = new Set([0x22, 0x27]); // " and '

class JsonParser {
    constructor(jsonStr = "", logging = false) {
        this.jsonStr = jsonStr;
        this.index = 0;
        this.context = new JsonContext();
        this.logging = logging;
        this.logger = [];
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
        if (STRING_DELIMITERS.includes(char)) return this.parseString();
        if (/[-0-9]/.test(char)) return this.parseNumber();
        if (/[a-zA-Z]/.test(char)) return this.parseUnquotedString();

        this.index++;
        return "";
    }

    parseObject() {
        const obj = {};
        this.index++; // skip {

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

        return obj;
    }

    parseArray() {
        const arr = [];
        this.index++; // skip [
        this.context.set(ContextValues.ARRAY);

        while (this.index < this.jsonStr.length) {
            this.skipWhitespace();
            
            if (this.peek() === "]") {
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

        // Convert value types for object values
        if (!isQuoted && this.context.current === ContextValues.OBJECT_VALUE) {
            const trimmed = stringAcc.trim();
            
            // Try number
            const num = Number(trimmed);
            if (!isNaN(num)) return num;
            
            // Try boolean/null
            if (trimmed.toLowerCase() === "true") return true;
            if (trimmed.toLowerCase() === "false") return false;
            if (trimmed.toLowerCase() === "null") return null;
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
            str += char;
            this.index++;
        }

        return str;
    }

    skipWhitespace() {
        while (this.index < this.jsonStr.length) {
            const code = this.jsonStr.charCodeAt(this.index);
            if (!WHITESPACE.has(code)) break;
            this.index++;
        }
    }

    peek() {
        return this.jsonStr[this.index];
    }
}

module.exports = JsonParser;
