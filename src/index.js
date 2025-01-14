const JsonParser = require('./JsonParser');

/**
 * Bozuk JSON string'ini onarır
 * @param {string} jsonStr - Onarılacak JSON string'i
 * @param {Object} options - Onarım seçenekleri
 * @param {boolean} options.returnObjects - true ise JavaScript objesi döner, false ise JSON string döner
 * @param {boolean} options.skipJsonParse - true ise JSON.parse kontrolünü atlar
 * @param {boolean} options.logging - true ise onarım loglarını da döner
 * @param {boolean} options.ensureAscii - false ise Unicode karakterleri korur
 * @returns {string|Object} Onarılmış JSON string'i veya objesi
 */
function repairJson(jsonStr = "", options = {}) {
    const {
        returnObjects = false,
        skipJsonParse = false,
        logging = false,
        ensureAscii = true
    } = options;

    // Önce normal JSON.parse ile dene
    if (!skipJsonParse) {
        try {
            const parsed = JSON.parse(jsonStr);
            return returnObjects ? parsed : JSON.stringify(parsed, null, 2);
        } catch (e) {
            // JSON.parse başarısız olursa devam et
        }
    }

    // JSON.parse başarısız olduysa veya atlanması istendiyse, onararak parse et
    const parser = new JsonParser(jsonStr, logging);
    const result = parser.parse();

    if (logging) {
        return result; // [parsedJson, logs] şeklinde döner
    }

    // String'e çevir veya obje olarak döndür
    if (returnObjects) {
        return result;
    }

    // JSON string'e çevir
    const indent = 2;
    const replacer = ensureAscii ? (key, value) => {
        if (typeof value === 'string') {
            return value.replace(/[^\x00-\x7F]/g, char => {
                return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
            });
        }
        return value;
    } : null;

    return JSON.stringify(result, replacer, indent);
}

/**
 * JSON.parse benzeri fonksiyon, ancak bozuk JSON'ları da onarır
 * @param {string} jsonStr - Parse edilecek JSON string'i
 * @param {Object} options - Parse seçenekleri
 * @param {boolean} options.skipJsonParse - true ise JSON.parse kontrolünü atlar
 * @param {boolean} options.logging - true ise onarım loglarını da döner
 * @returns {Object} Parse edilmiş JavaScript objesi
 */
function loads(jsonStr, options = {}) {
    return repairJson(jsonStr, { ...options, returnObjects: true });
}

/**
 * Dosyadan JSON okur ve onarır
 * @param {string} filename - JSON dosyasının yolu
 * @param {Object} options - Parse seçenekleri
 * @returns {Object} Parse edilmiş JavaScript objesi
 */
function fromFile(filename, options = {}) {
    const fs = require('fs');
    const content = fs.readFileSync(filename, 'utf8');
    return loads(content, options);
}

module.exports = {
    repairJson,
    loads,
    fromFile
};
