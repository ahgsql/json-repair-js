const { repairJson, loads } = require('../src');

describe('JSON Repair Tests', () => {
    test('LLM tarafından üretilen bozuk JSON düzeltilmeli', () => {
        const brokenJson = `Anlıyorum işte size uygun bir JSON: \`\`\`json { "title": "Türk Ceza Hukukunda Yağma Suçunun Kapsamı ve Hukuki Boyutları", "seoKeywords": [ "yağma suçu", "hırsızlık", "tehdit", "ceza hukuku", "TCK",6 ], }`;

        const result = loads(brokenJson);

        expect(result).toEqual({
            title: "Türk Ceza Hukukunda Yağma Suçunun Kapsamı ve Hukuki Boyutları",
            seoKeywords: ["yağma suçu", "hırsızlık", "tehdit", "ceza hukuku", "TCK", 6]
        });
    });

    test('Eksik tırnak işaretleri düzeltilmeli', () => {
        const brokenJson = '{ name: John, age: 30 }';
        const result = loads(brokenJson);
        expect(result).toEqual({ name: "John", age: 30 });
    });

    test('Eksik virgüller düzeltilmeli', () => {
        const brokenJson = '{ "name": "John" "age": 30 }';
        const result = loads(brokenJson);
        expect(result).toEqual({ name: "John", age: 30 });
    });

    test('Unicode karakterler korunmalı', () => {
        const json = '{ "test": "Türkçe" }';
        const result = repairJson(json, { ensureAscii: false });
        expect(result).toBe('{\n  "test": "Türkçe"\n}');
    });


});
