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

    test('Boolean değerler doğru tip olarak parse edilmeli', () => {
        const testCases = [
            { input: '{ "flag": true }', expected: { flag: true } },
            { input: '{ "flag": false }', expected: { flag: false } },
            { input: '{ flag: true }', expected: { flag: true } },
            { input: '{ flag: false }', expected: { flag: false } },
            { input: '{ "enabled": TRUE }', expected: { enabled: true } },
            { input: '{ "disabled": FALSE }', expected: { disabled: false } }
        ];

        testCases.forEach(({ input, expected }) => {
            const result = loads(input);
            expect(result).toEqual(expected);
            
            // Type kontrolü
            Object.keys(expected).forEach(key => {
                expect(typeof result[key]).toBe(typeof expected[key]);
            });
        });
    });

    test('LLM çıktısındaki boolean değerler doğru parse edilmeli', () => {
        const llmOutput = `I understand, here's a suitable JSON for you: \`\`\`json 
        { 
            "defaultValueStr": "false",
            "defaultValue": false,
            "enabled": true,
            "enabledStr": "true",
            "nullValue": null,
            "nullValueStr": "null"
        }`;

        const result = loads(llmOutput);
        
        expect(result.defaultValue).toBe(false);
        expect(result.enabled).toBe(true);
        expect(result.nullValue === null).toBe(true);

        expect(result.defaultValueStr).toBe("false");
        expect(result.enabledStr).toBe("true");
        expect(result.nullValueStr).toBe("null");
    });

    test('Dizi elemanlarındaki tırnaksız değerler doğru tipe çevrilmeli', () => {
        expect(loads('{"a": [true false null]}')).toEqual({ a: [true, false, null] });
        expect(loads('[true, FALSE, Null, 1, 2.5, -3]')).toEqual([true, false, null, 1, 2.5, -3]);
        // Tırnaklı değerler string olarak kalmalı
        expect(loads('{"a": ["true", "false", "null", "1"]}')).toEqual({ a: ["true", "false", "null", "1"] });
    });

    test('null değerleri doğru parse edilmeli', () => {
        expect(loads('{ a: null, b: NULL }')).toEqual({ a: null, b: null });
        expect(loads('{ "a": "null" }')).toEqual({ a: "null" });
    });

    test('Sayılar doğru parse edilmeli', () => {
        expect(loads('{ a: 1, b: -2, c: 3.14, d: 1e3, e: -1.5E-2 }'))
            .toEqual({ a: 1, b: -2, c: 3.14, d: 1000, e: -0.015 });
    });

    test('Infinity ve NaN sayıya çevrilmemeli (JSON\'da null olurlardı)', () => {
        expect(loads('{ a: Infinity }')).toEqual({ a: "Infinity" });
        expect(loads('{ a: nan }')).toEqual({ a: "nan" });
        expect(loads('[Infinity, NaN]')).toEqual(["Infinity", "NaN"]);
        expect(loads('[-Infinity]')).toEqual(["-Infinity"]);

        // Sonuç JSON string'e çevrildiğinde değer kaybolmamalı
        const out = JSON.parse(repairJson('{ a: Infinity, b: [-Infinity] }'));
        expect(out).toEqual({ a: "Infinity", b: ["-Infinity"] });
    });

    test('Sayı gibi görünen ama düz ondalık olmayan değerler sayıya çevrilmemeli', () => {
        expect(loads('{ a: 1.2.3 }')).toEqual({ a: "1.2.3" });
        expect(loads('{ a: hello }')).toEqual({ a: "hello" });
    });

});
