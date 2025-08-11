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
            "title": "Sample Title", 
            "defaultValue": false, 
            "enabled": true,
            "items": ["item1" "item2" "item3"] 
        }`;

        const result = loads(llmOutput);
        
        expect(result.defaultValue).toBe(false);
        expect(typeof result.defaultValue).toBe('boolean');
        expect(result.enabled).toBe(true);
        expect(typeof result.enabled).toBe('boolean');
        expect(result.title).toBe('Sample Title');
        expect(result.items).toEqual(['item1', 'item2', 'item3']);
    });

});
